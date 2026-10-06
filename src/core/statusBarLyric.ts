import { NativeModules } from 'react-native'
import TrackPlayer, { State } from 'react-native-track-player'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'
import { isInitialized } from '@/plugins/player'
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

// 事件用于触发复查；界面状态与曲目缓存可能晚于原生播放事件更新。
let playbackRequest = 0
let songRequest = 0
export const syncStatusBarLyricPlayback = async() => {
  if (!enabled() || !isInitialized()) return
  const request = ++playbackRequest
  const id = playerState.musicInfo.id
  try {
    const index = await TrackPlayer.getCurrentTrack()
    const [track, state, time] = await Promise.all([
      index == null ? null : TrackPlayer.getTrack(index),
      TrackPlayer.getState(),
      TrackPlayer.getPosition(),
    ])
    const currentIndex = await TrackPlayer.getCurrentTrack()
    // 暂停、连续切歌、歌词清空或退出后，丢弃尚未完成的旧快照。
    if (request != playbackRequest || !enabled() || id != playerState.musicInfo.id || index != currentIndex) return
    const trackId = String(track?.id ?? '')
    const current = !!id && trackId.startsWith(`${id}__//`) && !/\/\/default(?:\/\/restorePlay)?$/.test(trackId)
    await native.setPlayback(current && state == State.Playing, current ? time * 1000 : -1)
  } catch (error) { ignoreError(error) }
}

export const getStatusBarLyricStatus = async(): Promise<StatusBarLyricStatus> => native.getStatus().catch(() => 'unavailable')

export const setStatusBarLyricOptions = () => {
  if (!enabled()) return
  const setting = settingState.setting
  void native.setOptions(setting['player.playbackRate'], setting['player.isShowLyricTranslation'], setting['player.isShowLyricRoma']).catch(ignoreError)
}

export const setStatusBarLyric = async(lyric: string, translation = '', roma = '') => {
  if (!enabled()) return
  const request = ++songRequest
  playbackRequest++
  const info = playerState.musicInfo
  const duration = playerState.progress.maxPlayTime * 1000
  await native.setSong(lyric && info.id ? {
    id: info.id,
    name: info.name,
    artist: info.singer,
    duration,
    lines: buildStatusBarLyrics(lyric, translation, roma, duration),
  } : null).then(async() => {
    if (request == songRequest && lyric && info.id) await syncStatusBarLyricPlayback()
  }).catch(ignoreError)
}

export const enableStatusBarLyric = async(value: boolean): Promise<StatusBarLyricStatus> => {
  active = value
  playbackRequest++
  songRequest++
  const status = await native.setEnabled(value).catch(() => 'unavailable' as const)
  if (value && active && status != 'unsupported' && status != 'unavailable') {
    setStatusBarLyricOptions()
    const info = playerState.musicInfo
    await setStatusBarLyric(info.lrc ?? '', info.tlrc ?? '', info.rlrc ?? '')
    return getStatusBarLyricStatus()
  }
  return status
}
