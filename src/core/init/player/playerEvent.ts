import { handlePlaybackFailure, setMusicUrl } from '@/core/player/player'
import { setStatusText, setIsPlayPending } from '@/core/player/playStatus'
import { playbackRecovery } from '@/core/player/recovery'
import { getPosition, isEmpty, setStop } from '@/plugins/player'
import BackgroundTimer from 'react-native-background-timer'
import playerState from '@/store/player/state'
import { setNowPlayTime } from '@/core/player/progress'
import { excludeFailedUserApiUrl } from '@/core/music/userApiFallback'


export default () => {
  let retryNum = 0
  let prevTimeoutId: string | null = null

  let loadingTimeout: number | null = null
  const startLoadingTimeout = () => {
    // console.log('start load timeout')
    clearLoadingTimeout()
    const token = playbackRecovery.token()
    loadingTimeout = BackgroundTimer.setTimeout(() => {
      if (!playbackRecovery.isCurrent(token) || global.lx.isPlayedStop) return
      // if (global.lx.isPlayedStop) {
      //   prevTimeoutId = null
      //   setStatusText('')
      //   return
      // }

      // 如果加载超时，则尝试刷新URL
      excludeFailedUserApiUrl(playerState.musicInfo.apiSourceUrl ?? '')
      if (prevTimeoutId == playerState.musicInfo.id) {
        prevTimeoutId = null
        handlePlaybackFailure()
      } else {
        prevTimeoutId = playerState.musicInfo.id
        if (playerState.playMusicInfo.musicInfo) setMusicUrl(playerState.playMusicInfo.musicInfo, true)
      }
    }, 25000)
  }
  const clearLoadingTimeout = () => {
    if (!loadingTimeout) return
    // console.log('clear load timeout')
    BackgroundTimer.clearTimeout(loadingTimeout)
    loadingTimeout = null
  }

  const handleLoadstart = () => {
    console.log('handleLoadstart', playerState.isPlay)
    if (global.lx.isPlayedStop || playbackRecovery.isCancelled()) return
    setIsPlayPending(true)
    startLoadingTimeout()
    setStatusText(global.i18n.t('player__loading'))
  }

  // const handleLoadeddata = () => {
  //   setStatusText(global.i18n.t('player__loading'))
  // }

  // const handleCanplay = () => {
  //   setStatusText('')
  // }

  const handlePlaying = () => {
    if (playbackRecovery.isCancelled()) return
    setIsPlayPending(false)
    playbackRecovery.resetFailures()
    setStatusText('')
    clearLoadingTimeout()
  }

  const handleEmpied = () => {
    clearLoadingTimeout()
  }

  const handleWating = () => {
    if (playbackRecovery.isCancelled()) return
    setIsPlayPending(true)
    startLoadingTimeout()
    setStatusText(global.i18n.t('player__buffering'))
  }

  const handleError = () => {
    if (!playerState.musicInfo.id) return
    clearLoadingTimeout()
    if (global.lx.isPlayedStop || playbackRecovery.isCancelled()) return
    if (playerState.playMusicInfo.musicInfo && retryNum < 2) { // 若音频URL无效则尝试刷新2次URL
      excludeFailedUserApiUrl(playerState.musicInfo.apiSourceUrl ?? '')
      let musicInfo = playerState.playMusicInfo.musicInfo
      const token = playbackRecovery.token()
      retryNum++
      void getPosition().then((position) => {
        if (playbackRecovery.isCurrent(token) && position) setNowPlayTime(position)
      }).catch(() => {}).finally(() => {
        // console.log(this.retryNum)
        if (!playbackRecovery.isCurrent(token) || playerState.playMusicInfo.musicInfo !== musicInfo) return
        setMusicUrl(playerState.playMusicInfo.musicInfo, true)
        setStatusText(global.i18n.t('player__refresh_url'))
      })
      return
    }
    if (!isEmpty()) void setStop()

    handlePlaybackFailure()
  }

  const handleSetPlayInfo = () => {
    retryNum = 0
    prevTimeoutId = null
    clearLoadingTimeout()
  }

  // const handlePlayedStop = () => {
  //   clearDelayNextTimeout()
  //   clearLoadingTimeout()
  // }


  global.app_event.on('playerLoadstart', handleLoadstart)
  // global.app_event.on('playerLoadeddata', handleLoadeddata)
  // global.app_event.on('playerCanplay', handleCanplay)
  global.app_event.on('playerPlaying', handlePlaying)
  global.app_event.on('playerWaiting', handleWating)
  global.app_event.on('playerEmptied', handleEmpied)
  global.app_event.on('playerPause', clearLoadingTimeout)
  global.app_event.on('playerError', handleError)
  global.app_event.on('musicToggled', handleSetPlayInfo)
}
