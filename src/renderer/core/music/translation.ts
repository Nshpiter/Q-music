import musicSdk from '@renderer/utils/musicSdk'
import { toNewMusicInfo, toOldMusicInfo } from '@renderer/utils'
import { saveLyric } from '@renderer/utils/ipc'
import { getOtherSource } from './utils'
import { closeDuration, matchTranslation, sameTitle } from './translationMatch'

const lastAttempts = new Map<string, number>()

const getSearchCandidates = async(musicInfo: LX.Music.MusicInfoOnline): Promise<LX.Music.MusicInfoOnline[]> => {
  try {
    const target = musicInfo.source == 'tx' ? 'wy' : 'tx'
    const title = musicInfo.name.replace(/\s*[（(][\u3400-\u9fff\s]+[）)]\s*$/, '')
    const result = await musicSdk[target].musicSearch.search(title, 1, 40)
    return result.list.map(toNewMusicInfo) as LX.Music.MusicInfoOnline[]
  } catch {
    return []
  }
}

export const findMatchedTranslation = async(musicInfo: LX.Music.MusicInfoOnline, lyricInfo: LX.Player.LyricInfo): Promise<string> => {
  if (!['tx', 'wy'].includes(musicInfo.source) || (lyricInfo.tlyric?.length ?? 0) > 0 || !lyricInfo.lyric ||
    !/[A-Za-z]{3,}|[\u3040-\u30ff\uac00-\ud7af]/.test(lyricInfo.lyric)) return ''

  const key = `${musicInfo.source}:${musicInfo.id}`
  const lastAttempt = lastAttempts.get(key)
  if (lastAttempt && Date.now() - lastAttempt < 30 * 60_000) return ''
  lastAttempts.set(key, Date.now())
  if (lastAttempts.size > 60) lastAttempts.delete(lastAttempts.keys().next().value!)

  const checked = new Set<string>()
  const tryCandidates = async(candidates: LX.Music.MusicInfoOnline[]): Promise<string> => {
    const matches = candidates.filter(item => item.source != musicInfo.source &&
      sameTitle(item.name, musicInfo.name) && closeDuration(item.interval, musicInfo.interval),
    ).slice(0, 8)
    for (const candidate of matches) {
      if (checked.has(candidate.id)) continue
      checked.add(candidate.id)
      try {
        const alternate = await (musicSdk[candidate.source].getLyric(toOldMusicInfo(candidate)) as any).promise as LX.Music.LyricInfo
        if (!alternate.lyric || !alternate.tlyric) continue
        const tlyric = matchTranslation(lyricInfo.lyric, alternate.lyric, alternate.tlyric)
        if (!tlyric) continue
        void saveLyric(musicInfo, { ...lyricInfo, tlyric }).catch(() => {})
        return tlyric
      } catch {}
    }
    return ''
  }

  try {
    return await tryCandidates(await getSearchCandidates(musicInfo)) ||
      await tryCandidates(await getOtherSource(musicInfo))
  } catch {
    return ''
  }
}
