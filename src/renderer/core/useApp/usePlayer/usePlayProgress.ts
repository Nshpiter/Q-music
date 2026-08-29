import { onBeforeUnmount, watch } from '@common/utils/vueTools'
import { formatPlayTime2 } from '@common/utils/common'
import { throttle } from '@common/utils'
import { savePlayInfo } from '@renderer/utils/ipc'
import { onTimeupdate, getCurrentTime, getDuration, setCurrentTime, onVisibilityChange } from '@renderer/plugins/player'
import { playProgress, setNowPlayTime, setMaxplayTime } from '@renderer/store/player/playProgress'
import { musicInfo, playMusicInfo, playInfo } from '@renderer/store/player/state'
// import { getList } from '@renderer/store/utils'
import { appSetting } from '@renderer/store/setting'
import { updateListMusics } from '@renderer/store/list/action'

const delaySavePlayInfo = throttle(savePlayInfo, 2000)

export default () => {
  let restorePlayTime = 0

  const setProgress = (time: number, maxTime?: number) => {
    if (!musicInfo.id) return
    if (maxTime != null) setMaxplayTime(maxTime)
    console.log('setProgress', time, maxTime)
    if (time > 0) restorePlayTime = time
    setNowPlayTime(time)
    setCurrentTime(time)

    // if (!isPlay) audio.play()
  }

  const handleStop = () => {
    setNowPlayTime(0)
    setMaxplayTime(0)
  }

  const handleError = () => {
    restorePlayTime ||= getCurrentTime() // 记录出错的播放时间
    console.log('handleError')
  }

  const handleLoadeddata = () => {
    setMaxplayTime(getDuration())

    if (playMusicInfo.musicInfo && 'source' in playMusicInfo.musicInfo && !playMusicInfo.musicInfo.interval) {
      // console.log(formatPlayTime2(playProgress.maxPlayTime))

      if (playMusicInfo.listId) {
        void updateListMusics([{
          id: playMusicInfo.listId,
          musicInfo: {
            ...playMusicInfo.musicInfo,
            interval: formatPlayTime2(playProgress.maxPlayTime),
          },
        }])
      }
    }
  }

  const handlePlaying = () => {
    console.log('handlePlaying', restorePlayTime)
    if (restorePlayTime) {
      setCurrentTime(restorePlayTime)
      restorePlayTime = 0
    }
  }

  const handleSetPlayInfo = () => {
    // restorePlayTime = playProgress.nowPlayTime
    setCurrentTime(restorePlayTime = playProgress.nowPlayTime)
    // setMaxplayTime(playProgress.maxPlayTime)
    if (!playMusicInfo.isTempPlay && playMusicInfo.listId) {
      delaySavePlayInfo({
        time: playProgress.nowPlayTime,
        maxTime: playProgress.maxPlayTime,
        listId: playMusicInfo.listId,
        index: playInfo.playIndex,
      })
    }
  }

  watch(() => playProgress.nowPlayTime, (newValue, oldValue) => {
    if (Math.abs(newValue - oldValue) > 2) window.app_event.activePlayProgressTransition()
    if (appSetting['player.isSavePlayTime'] && !playMusicInfo.isTempPlay) {
      delaySavePlayInfo({
        time: newValue,
        maxTime: playProgress.maxPlayTime,
        listId: playMusicInfo.listId as string,
        index: playInfo.playIndex,
      })
    }
  })
  watch(() => playProgress.maxPlayTime, maxPlayTime => {
    if (!playMusicInfo.isTempPlay) {
      delaySavePlayInfo({
        time: playProgress.nowPlayTime,
        maxTime: maxPlayTime,
        listId: playMusicInfo.listId as string,
        index: playInfo.playIndex,
      })
    }
  })

  // window.app_event.on('play', handlePlay)
  window.app_event.on('stop', handleStop)
  window.app_event.on('error', handleError)
  window.app_event.on('setProgress', setProgress)
  // window.app_event.on(eventPlayerNames.restorePlay, handleRestorePlay)
  window.app_event.on('playerLoadeddata', handleLoadeddata)
  window.app_event.on('playerPlaying', handlePlaying)
  window.app_event.on('musicToggled', handleSetPlayInfo)

  const rOnTimeupdate = onTimeupdate(() => {
    setNowPlayTime(getCurrentTime())
  })

  let currentPlayTime = 0
  const rVisibilityChange = onVisibilityChange(() => {
    if (document.hidden) {
      currentPlayTime = playProgress.nowPlayTime
    } else {
      if (Math.abs(playProgress.nowPlayTime - currentPlayTime) > 2) {
        window.app_event.activePlayProgressTransition()
      }
    }
  })

  onBeforeUnmount(() => {
    rOnTimeupdate()
    rVisibilityChange()
    // window.app_event.off('play', handlePlay)
    window.app_event.off('stop', handleStop)
    window.app_event.off('error', handleError)
    window.app_event.off('setProgress', setProgress)
    // window.app_event.off(eventPlayerNames.restorePlay, handleRestorePlay)
    window.app_event.off('playerLoadeddata', handleLoadeddata)
    window.app_event.off('playerPlaying', handlePlaying)
    window.app_event.off('musicToggled', handleSetPlayInfo)
  })
}
