import {
  saveLyric,
  saveMusicUrl,
  getMusicUrl as getStoreMusicUrl,
} from '@/utils/data'
import { updateListMusics } from '@/core/list'
import settingState from '@/store/setting/state'

import {
  buildLyricInfo,
  getOtherSource,
  getPlayQuality,
  isCustomApiSource,
  handleGetOnlineLyricInfo,
  handleGetOnlineMusicUrl,
  handleGetOnlinePicUrl,
  getCachedLyricInfo,
} from './utils'
import musicSdk from '@/utils/musicSdk'
import { toNewMusicInfo, toOldMusicInfo } from '@/utils'

const translationAttempts = new Map<string, number>()
const normalized = (value: string) => value.toLowerCase().replace(/[\s.,!?，。！？、・「」()（）·'"—…：:；;~～-]/g, '')
const baseTitle = (value: string) => normalized(value.replace(/\s*[（(][\u3400-\u9fff\s]+[）)]\s*$/, ''))
const seconds = (value?: string | null) => value ? value.split(':').reduce((time, part) => time * 60 + Number(part), 0) : 0
const lyricRows = (value: string) => value.split(/\r?\n/).flatMap(line => {
  const match = /^(\[\d+:(\d+)(?:\.(\d+))?\])(.+)$/.exec(line.trim())
  if (!match) return []
  const text = normalized(match[4])
  return text ? [{ stamp: match[1], time: Number(match[1].slice(1).split(':')[0]) * 60 + Number(match[2]) + Number(`0.${match[3] ?? 0}`), text, value: match[4].trim() }] : []
})
const lyricSimilarity = (left: string, right: string) => {
  if (left == right || left.includes(right) || right.includes(left)) return 1
  const pairs = new Set(Array.from({ length: left.length - 1 }, (_, index) => left.slice(index, index + 2)))
  const otherPairs = new Set(Array.from({ length: right.length - 1 }, (_, index) => right.slice(index, index + 2)))
  let shared = 0
  for (const pair of pairs) if (otherPairs.has(pair)) shared++
  return shared / Math.max(1, Math.min(pairs.size, otherPairs.size))
}

const getTranslationCandidates = async(musicInfo: LX.Music.MusicInfoOnline): Promise<LX.Music.MusicInfoOnline[]> => {
  if (musicInfo.source == 'tx' || musicInfo.source == 'wy') {
    try {
      const target = musicInfo.source == 'tx' ? 'wy' : 'tx'
      const title = musicInfo.name.replace(/\s*[（(][\u3400-\u9fff\s]+[）)]\s*$/, '')
      const result = await musicSdk[target].musicSearch.search(title, 1, 40)
      const rows = result.list as LX.Music.MusicInfo[]
      return rows.map(item => toNewMusicInfo(item) as LX.Music.MusicInfoOnline)
    } catch {}
  }
  return []
}

export const findMatchedTranslation = async(musicInfo: LX.Music.MusicInfoOnline, lyricInfo: LX.Player.LyricInfo): Promise<string> => {
  if ((lyricInfo.tlyric?.length ?? 0) > 0 || !lyricInfo.lyric || !/[A-Za-z]{3,}|[\u3040-\u30ff\uac00-\ud7af]/.test(lyricInfo.lyric)) return ''
  const lastAttempt = translationAttempts.get(musicInfo.id)
  if (lastAttempt && Date.now() - lastAttempt < 30 * 60_000) return ''
  translationAttempts.set(musicInfo.id, Date.now())
  if (translationAttempts.size > 60) translationAttempts.delete(translationAttempts.keys().next().value!)
  try {
    const originals = lyricRows(lyricInfo.lyric)
    if (originals.length < 4) return ''
    const checked = new Set<string>()
    const tryCandidates = async(candidates: LX.Music.MusicInfoOnline[]): Promise<string> => {
      const matching = candidates.filter(item =>
        item.source != musicInfo.source &&
        baseTitle(item.name) == baseTitle(musicInfo.name) &&
        (!seconds(item.interval) || !seconds(musicInfo.interval) || Math.abs(seconds(item.interval) - seconds(musicInfo.interval)) <= 8),
      ).slice(0, 8)
      for (const candidate of matching) {
        if (checked.has(candidate.id)) continue
        checked.add(candidate.id)
        try {
          const alternate = await (musicSdk[candidate.source].getLyric(toOldMusicInfo(candidate)) as any).promise as LX.Music.LyricInfo
          if (!alternate.lyric || !alternate.tlyric) continue
          const otherOriginals = lyricRows(alternate.lyric)
          const otherTranslations = lyricRows(alternate.tlyric)
          const assigned = new Set<number>()
          const matches = originals.flatMap(row => {
            const options = otherOriginals.filter(other => row.text.length >= 4 && other.text.length >= 4 &&
              lyricSimilarity(other.text, row.text) >= 0.78 && Math.abs(other.time - row.time) <= 12,
            ).sort((a, b) => Math.abs(a.time - row.time) - Math.abs(b.time - row.time))
            const original = options.find(other => !assigned.has(other.time)) ?? options[0]
            if (original) assigned.add(original.time)
            return original ? [{ row, original }] : []
          })
          const covered = matches.reduce((total, match) => total + match.row.text.length, 0)
          const total = originals.reduce((sum, row) => sum + row.text.length, 0)
          if (matches.length < 4 || covered / total < 0.45) continue
          const used = new Set<number>()
          const aligned = matches.flatMap(({ row, original }) => {
            if (used.has(original.time)) return []
            const translation = otherTranslations.find(other => Math.abs(other.time - original.time) <= 2.5)
            if (!translation) return []
            used.add(original.time)
            return [`${row.stamp}${translation.value}`]
          })
          if (aligned.length < 4) continue
          const tlyric = aligned.join('\n')
          void saveLyric(musicInfo, { ...lyricInfo, tlyric })
          return tlyric
        } catch {}
      }
      return ''
    }
    const fromSearch = await tryCandidates(await getTranslationCandidates(musicInfo))
    if (fromSearch) return fromSearch
    return await tryCandidates(await getOtherSource(musicInfo))
  } catch {}
  return ''
}

/* export const setMusicUrl = ({ musicInfo, type, url }: {
  musicInfo: LX.Music.MusicInfo
  type: LX.Quality
  url: string
}) => {
  saveMusicUrl(musicInfo, type, url)
}

export const setPic = (datas: {
  listId: string
  musicInfo: LX.Music.MusicInfo
  url: string
}) => {
  datas.musicInfo.img = datas.url
  updateMusicInfo({
    listId: datas.listId,
    id: datas.musicInfo.songmid,
    data: { img: datas.url },
    musicInfo: datas.musicInfo,
  })
}
 */


export const getMusicUrl = async({ musicInfo, quality, isRefresh, allowToggleSource = true, onToggleSource = () => {} }: {
  musicInfo: LX.Music.MusicInfoOnline
  quality?: LX.Quality
  isRefresh: boolean
  allowToggleSource?: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<string> => {
  // if (!musicInfo._types[type]) {
  //   // 兼容旧版酷我源搜索列表过滤128k音质的bug
  //   if (!(musicInfo.source == 'kw' && type == '128k')) throw new Error('该歌曲没有可播放的音频')

  //   // return Promise.reject(new Error('该歌曲没有可播放的音频'))
  // }
  const targetQuality = quality ?? getPlayQuality(settingState.setting['player.playQuality'], musicInfo)
  if (!isCustomApiSource() && musicInfo.source != 'tx' && musicInfo.source != 'wy') {
    const cachedUrl = await getStoreMusicUrl(musicInfo, targetQuality)
    if (cachedUrl && !isRefresh) return cachedUrl
  }

  return handleGetOnlineMusicUrl({ musicInfo, quality, onToggleSource, isRefresh, allowToggleSource }).then(({ url, quality: targetQuality, musicInfo: targetMusicInfo, isFromCache, isOfficial }) => {
    if (isOfficial) return url
    if (targetMusicInfo.id != musicInfo.id && !isFromCache) void saveMusicUrl(targetMusicInfo, targetQuality, url)
    void saveMusicUrl(musicInfo, targetQuality, url)
    return url
  })
}

/**
 * 获取播放 URL 并附带实际音质（音源降级/官方线路后可能与请求档位不同）
 */
export const getMusicPlayUrlInfo = async({ musicInfo, quality, isRefresh, allowToggleSource = true, onToggleSource = () => {} }: {
  musicInfo: LX.Music.MusicInfoOnline
  quality?: LX.Quality
  isRefresh: boolean
  allowToggleSource?: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<{ url: string, quality: LX.Quality }> => {
  const targetQuality = quality ?? getPlayQuality(settingState.setting['player.playQuality'], musicInfo)
  if (!isCustomApiSource() && musicInfo.source != 'tx' && musicInfo.source != 'wy') {
    const cachedUrl = await getStoreMusicUrl(musicInfo, targetQuality)
    if (cachedUrl && !isRefresh) return { url: cachedUrl, quality: targetQuality }
  }

  return handleGetOnlineMusicUrl({ musicInfo, quality, onToggleSource, isRefresh, allowToggleSource }).then(({ url, quality: targetQuality, musicInfo: targetMusicInfo, isFromCache, isOfficial }) => {
    if (isOfficial) return { url, quality: targetQuality }
    if (targetMusicInfo.id != musicInfo.id && !isFromCache) void saveMusicUrl(targetMusicInfo, targetQuality, url)
    void saveMusicUrl(musicInfo, targetQuality, url)
    return { url, quality: targetQuality }
  })
}

export const getPicUrl = async({ musicInfo, listId, isRefresh, allowToggleSource = true, onToggleSource = () => {} }: {
  musicInfo: LX.Music.MusicInfoOnline
  listId?: string | null
  isRefresh: boolean
  allowToggleSource?: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<string> => {
  if (musicInfo.meta.picUrl && !isRefresh) return musicInfo.meta.picUrl
  return handleGetOnlinePicUrl({ musicInfo, onToggleSource, isRefresh, allowToggleSource }).then(({ url, musicInfo: targetMusicInfo, isFromCache }) => {
    // picRequest = null
    if (listId) {
      musicInfo.meta.picUrl = url
      void updateListMusics([{ id: listId, musicInfo }])
    }
    // savePic({ musicInfo, url, listId })
    return url
  })
}
export const getLyricInfo = async({ musicInfo, isRefresh, allowToggleSource = true, onToggleSource = () => {} }: {
  musicInfo: LX.Music.MusicInfoOnline
  isRefresh: boolean
  allowToggleSource?: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<LX.Player.LyricInfo> => {
  if (!isRefresh) {
    const lyricInfo = await getCachedLyricInfo(musicInfo)
    if (lyricInfo) return buildLyricInfo(lyricInfo)
  }

  // lrcRequest = music[musicInfo.source].getLyric(musicInfo)
  return handleGetOnlineLyricInfo({ musicInfo, onToggleSource, isRefresh, allowToggleSource }).then(async({ lyricInfo, musicInfo: targetMusicInfo, isFromCache }) => {
    // lrcRequest = null
    if (isFromCache) return buildLyricInfo(lyricInfo)
    if (targetMusicInfo.id == musicInfo.id) void saveLyric(musicInfo, lyricInfo)
    else void saveLyric(targetMusicInfo, lyricInfo)

    return buildLyricInfo(lyricInfo)
  })
}
