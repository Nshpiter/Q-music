import { reactive, watch } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'
import { musicInfo, playMusicInfo } from '@renderer/store/player/state'
import { setMusicInfo } from '@renderer/store/player/action'
import { getLyricEdited, saveLyricEdited, translateLyrics } from '@renderer/utils/ipc'
import { hasDisplayLyrics } from '@common/utils/lyricStatus'
import { getLyricInfo } from '@renderer/core/music'
import { getListMusics } from '@renderer/store/list/action'
import { lyricFiles } from '@renderer/core/music/lyricFile'

// 手动和自动翻译共用同一项请求，快速切歌只翻译最后停留的歌曲。
const requests = new Map<string, Promise<boolean>>()
async function translateTrack(track: LX.Music.MusicInfo, info: LX.Music.LyricInfo) {
  const text = info.lyric
  if (!text || !!info.tlyric) return false
  const lines = text.split(/\r?\n/).map(line => ({ text: line.replace(/\[[^\]]*\]/g, '').trim() }))
  if (!hasDisplayLyrics(lines, track.name)) return false
  const path = lyricFiles.get(track)
  const key = JSON.stringify([track.source, track.id, path, text])
  const existing = requests.get(key)
  if (existing) return existing
  const job = (async() => {
    const before = await getLyricEdited(track)
    const translated = await translateLyrics(text)
    const after = await getLyricEdited(track)
    if (lyricFiles.get(track) !== path || before?.lyric !== after?.lyric || before?.tlyric !== after?.tlyric) return false
    if (musicInfo.id === track.id && (musicInfo.lrc !== text || musicInfo.tlrc)) return false
    await saveLyricEdited(track, { lyric: text, tlyric: translated, rlyric: after?.rlyric ?? info.rlyric ?? '', lxlyric: after?.lxlyric ?? info.lxlyric ?? '' })
    if (musicInfo.id === track.id && musicInfo.lrc === text && !musicInfo.tlrc) {
      setMusicInfo({ tlrc: translated })
      window.app_event.lyricUpdated()
    }
    return true
  })().finally(() => { requests.delete(key) })
  requests.set(key, job)
  return job
}
export async function translateCurrentLyrics() {
  const item = playMusicInfo.musicInfo
  const track = item && ('progress' in item ? item.metadata.musicInfo : item)
  const original = musicInfo.lrc
  const id = musicInfo.id
  if (!track || item?.id !== id || !original || musicInfo.tlrc) return Promise.resolve(false)
  return translateTrack(track, { lyric: original, rlyric: musicInfo.rlrc ?? '', lxlyric: musicInfo.lxlrc ?? '' })
}

export const translationBatch = reactive({ active: false, stopping: false, total: 0, saved: 0, skipped: 0, current: '', failures: [] as string[] })

export async function translatePlaylist(listId: string) {
  if (translationBatch.active) return
  const batch = translationBatch
  Object.assign(batch, { active: true, stopping: false, total: 0, saved: 0, skipped: 0, current: '', failures: [] })
  try {
    const tracks = [...await getListMusics(listId)]
    batch.total = tracks.length
    for (const track of tracks) {
      if (batch.stopping) break
      batch.current = track.name
      try {
        const info = await getLyricInfo({ musicInfo: track })
        if (batch.stopping) break
        if (await translateTrack(track, info)) batch.saved++
        else batch.skipped++
      } catch (error) {
        batch.failures.push(track.name + ' · ' + String(error instanceof Error ? error.message : error))
        if (/HTTP (?:401|403|429)/.test(String(error))) break
      }
    }
  } finally {
    Object.assign(batch, { active: false, current: '', stopping: false })
  }
}

export function useAutomaticTranslation() {
  let busy = false
  let waiting = false
  const next = async() => {
    if (busy) { waiting = true; return }
    busy = true
    try {
      do {
        waiting = false
        if (appSetting['playDetail.automaticTranslation']) await translateCurrentLyrics().catch(() => false)
      } while (waiting)
    } finally {
      // 其他调用在 busy 为 true 时只设置 waiting，只有当前消费者能清除 busy。
      // eslint-disable-next-line require-atomic-updates
      busy = false
    }
  }
  watch([() => appSetting['playDetail.automaticTranslation'], () => musicInfo.id, () => musicInfo.lrc, () => musicInfo.tlrc], ([enabled, id, text, translated], _, cleanup) => {
    waiting = false
    if (!enabled || !id || !text || translated) return
    const timer = setTimeout(() => { void next() }, 1500)
    cleanup(() => { clearTimeout(timer) })
  }, { immediate: true })
}
