import initPlayer from './player'
import initPlayInfo from './playInfo'
import initPlayStatus from './playStatus'
import initPlayerEvent from './playerEvent'
import initWatchList from './watchList'
import initPlayProgress from './playProgress'
import initPreloadNextMusic from './preloadNextMusic'
import initLyric from './lyric'
import initPlayHistory from './playHistory'
import initPlaybackReport from './playbackReport'

export default async(setting: LX.AppSetting) => {
  await initPlayer(setting)
  await initLyric(setting)
  await initPlayInfo(setting)
  initPlayStatus()
  initPlayerEvent()
  initPlayHistory()
  initPlaybackReport()
  initWatchList()
  initPlayProgress()
  initPreloadNextMusic()
}
