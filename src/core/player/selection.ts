import { LIST_IDS } from '@/config/constant'
import { bilibiliClient } from '@/utils/musicSdk/bi'
import { toNewMusicInfo } from '@/utils'
import settingState from '@/store/setting/state'
import { getListMusics, setTempList } from '@/core/list'
import playerActions from '@/store/player/action'
import { playList, playNext, appendQueueItems } from './player'

export const playAllFromPage = async(key: string, tracks: LX.Music.MusicInfo[], continuous = false) => select(async(isCurrent) => {
  if (!tracks.length) return
  if (settingState.setting['list.playAllMode'] == 'append' && appendQueueItems(tracks)) return
  await setTempList(key, [...tracks])
  if (isCurrent()) await playList(LIST_IDS.TEMP, 0, continuous)
})

export const playAllFromList = async(listId: string) => select(async(isCurrent) => {
  const tracks = await getListMusics(listId)
  if (!isCurrent() || !tracks.length) return
  if (settingState.setting['list.playAllMode'] == 'append' && appendQueueItems(tracks)) return
  await playList(listId, 0)
})

export const playAllFromLoader = async(key: string, load: () => Promise<LX.Music.MusicInfo[]>) => select(async(isCurrent) => {
  const tracks = await load()
  if (!isCurrent() || !tracks.length) return
  if (settingState.setting['list.playAllMode'] == 'append' && appendQueueItems(tracks)) return
  await setTempList(key, tracks)
  if (isCurrent()) await playList(LIST_IDS.TEMP, 0)
})

export const playSingle = async(musicInfo: LX.Music.MusicInfo, listId: string | null = LIST_IDS.PLAY_LATER) => {
  playerActions.addTempPlayList([{ listId, musicInfo, isTop: true }])
  await playNext()
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
  if (musicInfo.source == 'bi') { await playList(listId, index, true); return }
  if (settingState.setting['list.singlePlayMode'] == 'add') await playSingle(musicInfo, listId)
  else await playList(listId, index)
})

export const playFromPage = async(key: string, list: LX.Music.MusicInfo[], index: number, continuous = false) => select(async(isCurrent) => {
  const musicInfo = list[index]
  if (!musicInfo) return
  let tracks = list
  let selectedIndex = index
  let sequence = continuous
  // 多 P 使用完整播放上下文，不被“单曲插播”截成一首。
  if (musicInfo.source == 'bi' && !sequence) {
    const contents = await bilibiliClient.videoContents(String(musicInfo.meta.songId))
    if (!isCurrent()) return
    if (contents.parts.length > 1) {
      tracks = contents.parts.map(item => toNewMusicInfo(item) as LX.Music.MusicInfoOnline)
      const selected = tracks.findIndex(item => String(item.meta.songId) == String(musicInfo.meta.songId))
      selectedIndex = selected < 0 ? 0 : selected
      sequence = true
    }
  }
  if (!sequence && settingState.setting['list.singlePlayMode'] == 'add') { await playSingle(musicInfo); return }
  await setTempList(key, [...tracks])
  if (isCurrent()) await playList(LIST_IDS.TEMP, selectedIndex, sequence)
})
