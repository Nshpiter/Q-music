import { onBeforeUnmount, watch } from '@common/utils/vueTools'
import { onTimeupdate, getCurrentTime, getPlaybackRate, endCrossfade, canCrossfade } from '@renderer/plugins/player'
import { playProgress } from '@renderer/store/player/playProgress'
import { isPlay, musicInfo, tempPlayList } from '@renderer/store/player/state'
// import { getList } from '@renderer/store/utils'
import { getNextPlayMusicInfo, playNext, resetRandomNextMusicInfo } from '@renderer/core/player'
import { getMusicUrl } from '@renderer/core/music'
import { appSetting } from '@renderer/store/setting'

let audio: HTMLAudioElement
let cancelProbe: (() => void) | null = null
const initAudio = () => {
  if (audio) return
  audio = new Audio()
  audio.controls = false
  audio.preload = 'auto'
  audio.crossOrigin = 'anonymous'
  audio.muted = true
  audio.volume = 0
}
const checkMusicUrl = async(url: string): Promise<boolean> => {
  initAudio()
  cancelProbe?.()
  return new Promise((resolve) => {
    const finish = (ready: boolean) => {
      clearTimeout(timer)
      cancelProbe = null
      audio.removeEventListener('error', handleErr)
      audio.removeEventListener('canplay', handlePlay)
      resolve(ready)
    }
    const handleErr = () => { finish(false) }
    const handlePlay = () => { finish(true) }
    const timer = setTimeout(handleErr, 8000)
    cancelProbe = handleErr
    audio.addEventListener('error', handleErr)
    audio.addEventListener('canplay', handlePlay)
    audio.src = url
  })
}

const preloadMusicInfo = {
  isLoading: false,
  preProgress: 0,
  info: null as LX.Player.PlayMusicInfo | null,
  ready: false,
}
let revision = 0
const resetPreloadInfo = () => {
  ++revision
  cancelProbe?.()
  if (audio?.hasAttribute('src')) {
    audio.removeAttribute('src')
    audio.load()
  }
  preloadMusicInfo.ready = false
  preloadMusicInfo.preProgress = 0
  preloadMusicInfo.info = null
  preloadMusicInfo.isLoading = false
}
const preloadNextMusicUrl = async(curTime: number) => {
  if (preloadMusicInfo.isLoading || curTime - preloadMusicInfo.preProgress < 3) return
  preloadMusicInfo.isLoading = true
  const token = revision
  console.log('preload next music url')
  preloadMusicInfo.preProgress = curTime
  const info = await getNextPlayMusicInfo().catch(() => null)
  if (token !== revision) return
  if (info) {
    preloadMusicInfo.info = info
    const url = await getMusicUrl({ musicInfo: info.musicInfo }).catch(() => '')
    if (token !== revision) return
    if (url) {
      console.log('preload url', url)
      const result = await checkMusicUrl(url)
      if (token !== revision) return
      preloadMusicInfo.ready = result
      if (!result) {
        const url = await getMusicUrl({ musicInfo: info.musicInfo, isRefresh: true }).catch(() => '')
        if (token !== revision) return
        const playable = !!url && await checkMusicUrl(url)
        if (token !== revision) return
        preloadMusicInfo.ready = playable
        console.log('preload url refresh', url)
      }
    }
  }
  preloadMusicInfo.isLoading = false
}

export default () => {
  const setProgress = (time: number) => {
    if (!musicInfo.id) return
    preloadMusicInfo.preProgress = time
  }

  const handleSetPlayInfo = () => {
    resetPreloadInfo()
  }

  watch(() => appSetting['player.togglePlayMethod'], () => {
    if (!preloadMusicInfo.info || preloadMusicInfo.info.isTempPlay) return
    resetRandomNextMusicInfo()
    resetPreloadInfo()
    preloadMusicInfo.preProgress = playProgress.nowPlayTime
  })
  watch(() => appSetting['player.crossfadeSeconds'], seconds => { if (!seconds) endCrossfade() })
  watch(() => tempPlayList[0], resetPreloadInfo)

  window.app_event.on('setProgress', setProgress)
  window.app_event.on('musicToggled', handleSetPlayInfo)

  const rOnTimeupdate = onTimeupdate(() => {
    const time = getCurrentTime()
    const duration = playProgress.maxPlayTime
    const seconds = appSetting['player.crossfadeSeconds']
    const left = (duration - time) / getPlaybackRate()
    if (seconds > 0 && duration > seconds * 2 && left <= seconds && left > 0.15 && isPlay.value && !window.lx.isPlayedStop && preloadMusicInfo.ready && preloadMusicInfo.info?.musicInfo.id !== musicInfo.id && canCrossfade()) {
      preloadMusicInfo.ready = false
      void playNext(true, true)
      return
    }
    if (duration > 10 && left < Math.max(10, seconds + 6) && !preloadMusicInfo.info) {
      void preloadNextMusicUrl(time)
    }
  })


  onBeforeUnmount(() => {
    resetPreloadInfo()
    endCrossfade()
    rOnTimeupdate()
    window.app_event.off('setProgress', setProgress)
    window.app_event.off('musicToggled', handleSetPlayInfo)
  })
}
