import { bilibiliClient } from '@renderer/utils/musicSdk/bi'
import { toNewMusicInfo } from '@renderer/utils'
import { LIST_IDS } from '@common/constants'
import { appSetting } from '@renderer/store/setting'
import { getListMusics, setTempList } from '@renderer/store/list/action'
import { addTempPlayList } from '@renderer/store/player/action'
import { playMusicInfo } from '@renderer/store/player/state'
import { playList, playNext, appendQueueItems } from './action'

export const playAllFromPage = async(key: string, tracks: LX.Music.MusicInfo[], continuous = false) => select(async(isCurrent) => {
  if (!tracks.length) return
  if (appSetting['list.playAllMode'] == 'append' && appendQueueItems(tracks)) return
  await setTempList(key, [...tracks])
  if (isCurrent()) playList(LIST_IDS.TEMP, 0, continuous)
})

export const playAllFromList = async(listId: string) => select(async(isCurrent) => {
  const tracks = await getListMusics(listId)
  if (!isCurrent() || !tracks.length) return
  if (appSetting['list.playAllMode'] == 'append' && appendQueueItems(tracks)) return
  playList(listId, 0)
})

export const playAllFromLoader = async(key: string, load: () => Promise<LX.Music.MusicInfo[]>) => select(async(isCurrent) => {
  const tracks = await load()
  if (!isCurrent() || !tracks.length) return
  if (appSetting['list.playAllMode'] == 'append' && appendQueueItems(tracks)) return
  await setTempList(key, tracks)
  if (isCurrent()) playList(LIST_IDS.TEMP, 0)
})

export const playSingle = (musicInfo: LX.Music.MusicInfo, listId: string | null = LIST_IDS.PLAY_LATER) => {
  const wasPlaying = !!playMusicInfo.musicInfo
  addTempPlayList([{ listId, musicInfo, isTop: true }])
  if (wasPlaying) void playNext()
}

let revision = 0
let pending = Promise.resolve()
const select = async(action: (isCurrent: () => boolean) => Promise<void>) => {
  const current = ++revision
  pending = pending.catch(() => {}).then(async() => {
    if (current == revision) await action(() => current == revision)
  })
  return pending
}

export const playFromList = async(listId: string, index: number) => select(async(isCurrent) => {
  const musicInfo = (await getListMusics(listId))[index]
  if (!musicInfo || !isCurrent()) return
  if (musicInfo.source == 'bi') { playList(listId, index, true); return }
  if (appSetting['list.singlePlayMode'] == 'add') playSingle(musicInfo, listId)
  else playList(listId, index)
})

export const playFromPage = async(key: string, list: LX.Music.MusicInfo[], index: number, continuous = false) => select(async(isCurrent) => {
  const musicInfo = list[index]
  if (!musicInfo) return
  let tracks = list
  let selectedIndex = index
  let sequence = continuous
  if (musicInfo.source == 'bi' && !sequence) {
    const contents = await bilibiliClient.videoContents(String(musicInfo.meta.songId))
    if (!isCurrent()) return
    if (contents.parts.length > 1) {
      tracks = contents.parts.map(item => toNewMusicInfo(item))
      const selected = tracks.findIndex(item => String(item.meta.songId) == String(musicInfo.meta.songId))
      selectedIndex = selected < 0 ? 0 : selected
      sequence = true
    }
  }
  if (!sequence && appSetting['list.singlePlayMode'] == 'add') { playSingle(musicInfo); return }
  await setTempList(key, [...tracks])
  if (isCurrent()) playList(LIST_IDS.TEMP, selectedIndex, sequence)
})
