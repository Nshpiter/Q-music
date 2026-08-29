import { onBeforeUnmount } from '@common/utils/vueTools'
import { getCurrentTime } from '@renderer/plugins/player'
import { playbackSourceInfo } from '@renderer/store/player/state'
import { reportMusicAccountPlayback, type MusicAccountProvider } from '@renderer/utils/ipc'

const MIN_REPORT_DURATION = 5_000
const MAX_PLAYBACK_RATE = 4
const MAX_REPORT_ATTEMPTS = 2

interface PlaybackReportSession {
  key: string
  provider: MusicAccountProvider
  songId: string
  mediaId?: string
  sourceId?: string
  startedAt: number
  playedDuration: number
  lastPosition: number | null
  lastTickAt: number | null
  reported: boolean
  reportInFlight: boolean
  reportAttempts: number
}

const getOfficialPlaybackInfo = () => {
  const sourceInfo = playbackSourceInfo.value
  if (
    sourceInfo?.mode != 'official' ||
    (sourceInfo.resolvedSource != 'tx' && sourceInfo.resolvedSource != 'wy') ||
    !sourceInfo.resolvedSongId ||
    (sourceInfo.resolvedSource == 'wy' && !/^\d+$/.test(sourceInfo.resolvedSongId))
  ) return null

  return {
    provider: sourceInfo.resolvedSource,
    songId: sourceInfo.resolvedSongId,
    mediaId: sourceInfo.resolvedMediaId || undefined,
    sourceId: sourceInfo.officialSourceId || undefined,
  }
}

export default () => {
  let playbackGeneration = 0
  let session: PlaybackReportSession | null = null
  let isUnmounted = false
  const retryTimers = new Set<NodeJS.Timeout>()

  const updatePlayedDuration = () => {
    if (session?.lastPosition == null) return
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
    }
  }

  const scheduleReportRetry = (target: PlaybackReportSession) => {
    if (isUnmounted || target.reportAttempts >= MAX_REPORT_ATTEMPTS) return
    const retryTimer = setTimeout(() => {
      retryTimers.delete(retryTimer)
      reportSession(target)
    }, 2_000)
    retryTimers.add(retryTimer)
  }

  const reportSession = (target: PlaybackReportSession) => {
    if (
      target.reported ||
      target.reportInFlight ||
      target.reportAttempts >= MAX_REPORT_ATTEMPTS ||
      target.playedDuration < MIN_REPORT_DURATION
    ) return
    target.reportInFlight = true
    target.reportAttempts++
    void reportMusicAccountPlayback({
      provider: target.provider,
      songId: target.songId,
      mediaId: target.mediaId,
      sourceId: target.sourceId,
      playedSeconds: target.playedDuration / 1_000,
      startedAt: target.startedAt,
    }).then(result => {
      target.reportInFlight = false
      if (result.status == 'reported') {
        target.reported = true
        return
      }
      if (result.status == 'login_required') target.reportAttempts = MAX_REPORT_ATTEMPTS
      else scheduleReportRetry(target)
    }).catch(error => {
      target.reportInFlight = false
      console.warn('[officialPlaybackReport] playback report unavailable', error)
      scheduleReportRetry(target)
    })
  }

  const finishSession = () => {
    pauseSession()
    if (session) reportSession(session)
    session = null
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
        reported: false,
        reportInFlight: false,
        reportAttempts: 0,
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
    if (!session || session.reported) return
    updatePlayedDuration()
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
