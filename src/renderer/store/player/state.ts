import { reactive, shallowReactive, ref } from '@common/utils/vueTools'

export interface PlayerMusicInfo {
  id: string | null
  pic: string | null
  lrc: string | null
  tlrc: string | null
  rlrc: string | null
  lxlrc: string | null
  rawlrc: string | null
  // url: string | null
  name: string
  singer: string
  album: string
}

export const musicInfo = window.lxData.musicInfo = reactive<PlayerMusicInfo>({
  id: null,
  pic: null,
  lrc: null,
  tlrc: null,
  rlrc: null,
  lxlrc: null,
  rawlrc: null,
  // url: null,
  name: '',
  singer: '',
  album: '',
})

export const isPlay = ref(false)

export const status = window.lxData.status = ref('')

export const statusText = ref('')

export const isShowPlayerDetail = ref(false)

export const isShowPlayComment = ref(false)

export const isShowLrcSelectContent = ref(false)

export const isShowPlayQueue = ref(false)

export interface PlaybackSourceInfo {
  /** 用于避免切歌/切源请求尚未完成时显示上一首的线路信息。 */
  musicKey: string
  requestedSource: LX.Source
  resolvedSource: LX.Source
  quality: LX.Quality | null
  mode: 'official' | 'api' | 'fallback' | 'cache' | 'local' | 'download'
  isFallback: boolean
  resolvedSongId: string
  resolvedMediaId: string
  officialSourceId: string
  /** 解析音源所使用的 API/缓存提供方，便于在播放面板中说明实际线路。 */
  cacheProviderId?: string
}

export const playbackSourceInfo = ref<PlaybackSourceInfo | null>(null)

export const playMusicInfo = shallowReactive<{
  /**
   * 当前播放歌曲的列表 id
   */
  musicInfo: LX.Player.PlayMusicInfo['musicInfo'] | null
  /**
   * 当前播放歌曲的列表 id
   */
  listId: LX.Player.PlayMusicInfo['listId'] | null
  /**
   * 是否属于 “稍后播放”
   */
  isTempPlay: boolean
}>({
  listId: null,
  musicInfo: null,
  isTempPlay: false,
})
export const playInfo = shallowReactive<LX.Player.PlayInfo>({
  playIndex: -1,
  playerListId: null,
  playerPlayIndex: -1,
})


export const playedList = window.lxData.playedList = shallowReactive<LX.Player.PlayMusicInfo[]>([])

export const tempPlayList = shallowReactive<LX.Player.PlayMusicInfo[]>([])

window.lxData.playInfo = playInfo
window.lxData.playMusicInfo = playMusicInfo
