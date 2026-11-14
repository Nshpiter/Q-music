import { onBeforeUnmount } from '@common/utils/vueTools'
import { getCurrentTime } from '@renderer/plugins/player'
import { playbackSourceInfo, playMusicInfo } from '@renderer/store/player/state'
import { reportMusicAccountPlayback, type MusicAccountProvider } from '@renderer/utils/ipc'
import { playbackReportInfo } from '@renderer/core/music/playbackReport'

const MIN_REPORT_DURATION = 5_000
const MAX_PLAYBACK_RATE = 4
const MAX_REPORT_ATTEMPTS = 2

type ReportPhase = 'start' | 'finish'

interface ReportState {
  done: boolean
  inFlight: Promise<void> | null
  attempts: number
}

interface PlaybackReportSession {
  key: string
  musicKey: string
  provider: MusicAccountProvider
  songId: string
  mediaId?: string
  sourceId?: string
  startedAt: number
  playedDuration: number
  lastPosition: number | null
  lastTickAt: number | null
  start: ReportState
  finish: ReportState
}

const createReportState = (): ReportState => ({ done: false, inFlight: null, attempts: 0 })

const getOfficialPlaybackInfo = () => {
  const currentMusic = playMusicInfo.musicInfo
  const currentMusicInfo = currentMusic && 'progress' in currentMusic
    ? currentMusic.metadata.musicInfo
    : currentMusic
  const currentMusicKey = currentMusicInfo ? `${currentMusicInfo.source}:${currentMusicInfo.id}` : ''
  const info = playbackReportInfo(playbackSourceInfo.value, currentMusicKey)
  return info ? { ...info, musicKey: currentMusicKey } : null
}

export default () => {
  let playbackGeneration = 0
  let session: PlaybackReportSession | null = null
  let isUnmounted = false
  const retryTimers = new Set<NodeJS.Timeout>()

  const updatePlayedDuration = () => {
    if (session?.lastPosition == null) return
    const current = getOfficialPlaybackInfo()
    if (!current || current.musicKey != session.musicKey || current.provider != session.provider || current.songId != session.songId) {
      session.lastPosition = null
      session.lastTickAt = null
      return
    }
    const currentPosition = getCurrentTime()
    if (!Number.isFinite(currentPosition)) return
    const now = performance.now()
    const progressDelta = currentPosition - session.lastPosition
    const elapsed = session.lastTickAt == null ? 0 : Math.max(0, (now - session.lastTickAt) / 1_000)
    session.lastPosition = currentPosition
    session.lastTickAt = now
    if (progressDelta > 0 && progressDelta <= elapsed * MAX_PLAYBACK_RATE + 1) {
      session.playedDuration += progressDelta * 1_000
    }
  }

  const pauseSession = () => {
    updatePlayedDuration()
    if (session) {
      session.lastPosition = null
      session.lastTickAt = null
      void reportPhase(session, 'start')
    }
  }

  const scheduleReportRetry = (target: PlaybackReportSession, phase: ReportPhase) => {
    if (isUnmounted || target[phase].attempts >= MAX_REPORT_ATTEMPTS) return
    const retryTimer = setTimeout(() => {
      retryTimers.delete(retryTimer)
      void reportPhase(target, phase)
    }, 2_000)
    retryTimers.add(retryTimer)
  }

  const reportPhase = async(target: PlaybackReportSession, phase: ReportPhase): Promise<void> => {
    const state = target[phase]
    if (state.inFlight) return state.inFlight
    if (
      state.done ||
      state.attempts >= MAX_REPORT_ATTEMPTS ||
      target.playedDuration < MIN_REPORT_DURATION
    ) return
    state.attempts++
    const request = reportMusicAccountPlayback({
      provider: target.provider,
      songId: target.songId,
      mediaId: target.mediaId,
      sourceId: target.sourceId,
      playedSeconds: target.playedDuration / 1_000,
      startedAt: target.startedAt,
      phase,
    }).then(result => {
      state.inFlight = null
      if (result.status == 'reported') {
        state.done = true
        return
      }
      if (result.status == 'login_required') {
        target.start.attempts = MAX_REPORT_ATTEMPTS
        target.finish.attempts = MAX_REPORT_ATTEMPTS
      } else scheduleReportRetry(target, phase)
    }).catch(error => {
      state.inFlight = null
      console.warn('[officialPlaybackReport] playback report unavailable', error)
      scheduleReportRetry(target, phase)
    })
    state.inFlight = request
    return request
  }

  const finishSession = () => {
    pauseSession()
    const target = session
    session = null
    if (!target || target.provider != 'wy' || target.playedDuration < MIN_REPORT_DURATION) return
    // 网易云在播放结束时按实际收听秒数计入听歌排行，满 5 秒就发送会把每首都记成 5 秒的完整播放。
    void reportPhase(target, 'start').then(async() => reportPhase(target, 'finish'))
  }

  const handlePlaying = () => {
    const sourceInfo = getOfficialPlaybackInfo()
    if (!sourceInfo) {
      finishSession()
      return
    }

    const key = `${playbackGeneration}:${sourceInfo.provider}:${sourceInfo.songId}`
    if (session?.key != key) {
      finishSession()
      session = {
        key,
        ...sourceInfo,
        startedAt: Math.floor(Date.now() / 1_000),
        playedDuration: 0,
        lastPosition: getCurrentTime(),
        lastTickAt: performance.now(),
        start: createReportState(),
        finish: createReportState(),
      }
      return
    }
    if (session.lastPosition == null) {
      session.lastPosition = getCurrentTime()
      session.lastTickAt = performance.now()
    }
  }

  const handleMusicToggled = () => {
    finishSession()
    playbackGeneration++
  }

  const handleProgressChanged = (progress: number) => {
    if (session?.lastPosition == null) return
    updatePlayedDuration()
    session.lastPosition = progress
    session.lastTickAt = performance.now()
  }

  const reportTimer = setInterval(() => {
    if (!session) return
    updatePlayedDuration()
    void reportPhase(session, 'start')
  }, 1_000)

  window.app_event.on('playerPlaying', handlePlaying)
  window.app_event.on('playerPause', pauseSession)
  window.app_event.on('playerWaiting', pauseSession)
  window.app_event.on('playerError', pauseSession)
  window.app_event.on('playerEnded', finishSession)
  window.app_event.on('stop', finishSession)
  window.app_event.on('musicToggled', handleMusicToggled)
  window.app_event.on('setProgress', handleProgressChanged)

  onBeforeUnmount(() => {
    clearInterval(reportTimer)
    finishSession()
    isUnmounted = true
    for (const retryTimer of retryTimers) clearTimeout(retryTimer)
    retryTimers.clear()
    window.app_event.off('playerPlaying', handlePlaying)
    window.app_event.off('playerPause', pauseSession)
    window.app_event.off('playerWaiting', pauseSession)
    window.app_event.off('playerError', pauseSession)
    window.app_event.off('playerEnded', finishSession)
    window.app_event.off('stop', finishSession)
    window.app_event.off('musicToggled', handleMusicToggled)
    window.app_event.off('setProgress', handleProgressChanged)
  })
}
