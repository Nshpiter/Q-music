import { onBeforeUnmount, watch } from '@common/utils/vueTools'
// import { setDesktopLyricInfo, onGetDesktopLyricInfo } from '@renderer/utils/ipc'
// import { musicInfo } from '@renderer/store/player/state'
import {
  pause,
  play,
  seek,
  setLyric,
  stop,
  init,
  sendInfo,
  setDisableAutoPauseBySource,
  sendDesktopLyricInfo,
  setPlaybackRate,
} from '@renderer/core/lyric'
import { appSetting } from '@renderer/store/setting'
import { musicInfo } from '@renderer/store/player/state'

import { playbackRate } from '@renderer/store/player/playbackRate'

export default () => {
  init()
  watch(() => appSetting['desktopLyric.taskbar'], (enabled, _, cleanup) => {
    setDisableAutoPauseBySource(enabled, 'taskbar')
    cleanup(() => { setDisableAutoPauseBySource(false, 'taskbar') })
  }, { immediate: true })
  watch(() => musicInfo.pic, pic => { sendDesktopLyricInfo({ action: 'set_cover', data: pic }) })

  const setPlayInfo = () => {
    stop()
    sendInfo()
  }

  watch(() => appSetting['player.isShowLyricTranslation'], setLyric)
  watch(() => appSetting['player.isShowLyricRoma'], setLyric)
  watch(() => appSetting['player.isSwapLyricTranslationAndRoma'], setLyric)
  watch(() => appSetting['player.isPlayLxlrc'], setLyric)

  window.app_event.on('play', play)
  window.app_event.on('setProgress', seek)
  window.app_event.on('pause', pause)
  window.app_event.on('stop', stop)
  window.app_event.on('error', pause)
  window.app_event.on('musicToggled', setPlayInfo)
  window.app_event.on('lyricUpdated', setLyric)
  watch(playbackRate, setPlaybackRate)

  onBeforeUnmount(() => {
    window.app_event.off('play', play)
    window.app_event.off('setProgress', seek)
    window.app_event.off('pause', pause)
    window.app_event.off('stop', stop)
    window.app_event.off('error', pause)
    window.app_event.off('musicToggled', setPlayInfo)
    window.app_event.off('lyricUpdated', setLyric)
  })
}
