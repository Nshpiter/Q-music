import { NativeModules } from 'react-native'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'
import { getPosition, isInitialized } from '@/plugins/player'
import { buildStatusBarLyrics } from '@/utils/statusBarLyrics'

export type StatusBarLyricStatus = 'disabled' | 'connected' | 'waiting' | 'timeout' | 'not_installed' | 'unsupported' | 'unavailable'
const native = NativeModules.StatusBarLyricModule as {
  setEnabled: (enabled: boolean) => Promise<StatusBarLyricStatus>
  getStatus: () => Promise<StatusBarLyricStatus>
  setSong: (song: null | { id: string, name: string, artist: string, duration: number, lines: ReturnType<typeof buildStatusBarLyrics> }) => Promise<void>
  setPlayback: (playing: boolean, time: number) => Promise<void>
  setOptions: (rate: number, translation: boolean, roma: boolean) => Promise<void>
}

// 自动接入；仅应用退出时停止推送，不依赖设置页或历史开关值。
let active = true
const enabled = () => active
const ignoreError = (error: unknown) => { console.warn('Status bar lyrics:', error) }

// 以播放器真实状态为准：切歌取地址期间的播放事件会被应用层忽略，不能只依赖 play/pause 事件。
let playing = false
let playbackRequest = 0
const pushPlayback = async(value: boolean) => {
  playing = value
  if (!enabled() || !isInitialized()) return
  const request = ++playbackRequest
  const time = await getPosition().catch(() => 0)
  if (request == playbackRequest && enabled()) await native.setPlayback(value, time * 1000).catch(ignoreError)
}

export const syncStatusBarLyricPlayback = (value: boolean) => {
  if (value != playing) void pushPlayback(value)
}

export const getStatusBarLyricStatus = async(): Promise<StatusBarLyricStatus> => native.getStatus().catch(() => 'unavailable')

export const setStatusBarLyricOptions = () => {
  if (!enabled()) return
  const setting = settingState.setting
  void native.setOptions(setting['player.playbackRate'], setting['player.isShowLyricTranslation'], setting['player.isShowLyricRoma']).catch(ignoreError)
}

export const setStatusBarLyric = (lyric: string, translation = '', roma = '') => {
  if (!enabled()) return
  const info = playerState.musicInfo
  const duration = playerState.progress.maxPlayTime * 1000
  void native.setSong(lyric && info.id ? {
    id: info.id,
    name: info.name,
    artist: info.singer,
    duration,
    lines: buildStatusBarLyrics(lyric, translation, roma, duration),
  } : null).then(async() => {
    if (lyric && info.id) await pushPlayback(playing)
  }).catch(ignoreError)
}

export const playStatusBarLyric = (time: number) => {
  playing = true
  playbackRequest++
  if (enabled()) void native.setPlayback(true, time).catch(ignoreError)
}
export const seekStatusBarLyric = (time: number) => {
  playbackRequest++
  if (enabled()) void native.setPlayback(playing, time).catch(ignoreError)
}
export const pauseStatusBarLyric = () => {
  playing = false
  playbackRequest++
  if (enabled()) void native.setPlayback(false, -1).catch(ignoreError)
}

export const enableStatusBarLyric = async(value: boolean): Promise<StatusBarLyricStatus> => {
  active = value
  const status = await native.setEnabled(value).catch(() => 'unavailable' as const)
  if (value && active && status != 'unsupported' && status != 'unavailable') {
    setStatusBarLyricOptions()
    const info = playerState.musicInfo
    playing = playerState.isPlay
    setStatusBarLyric(info.lrc ?? '', info.tlrc ?? '', info.rlrc ?? '')
    await pushPlayback(playing)
  }
  return status
}
