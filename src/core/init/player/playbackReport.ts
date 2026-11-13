import BackgroundTimer from 'react-native-background-timer'
import playerState from '@/store/player/state'
import { getPosition } from '@/plugins/player'
import { getCurrentTrack, isTempTrack } from '@/plugins/player/playList'
import { originalPlaybackIdentity, openPlaybackSession, reportPlayback } from '@/core/musicAccount/playbackReport'

export default () => {
  let current: {
    identity: NonNullable<ReturnType<typeof originalPlaybackIdentity>>
    session: ReturnType<typeof openPlaybackSession>
    seconds: number
    attempts: number
    done: boolean
    sending: boolean
    retryAt: number
  } | null = null
  let timer: number | null = null
  let generation = 0
  const sampling = { active: false }
  let baseline: { trackId: string, position: number, at: number } | null = null

  const stop = () => {
    generation++
    baseline = null
    if (timer != null) BackgroundTimer.clearInterval(timer)
    timer = null
  }
  const sample = async() => {
    if (sampling.active) return
    sampling.active = true
    const version = generation
    try {
      const identity = originalPlaybackIdentity(playerState.playMusicInfo.musicInfo)
      if (!identity || identity.key != playerState.musicInfo.id) { stop(); return }
      const track = await getCurrentTrack()
      const position = await getPosition()
      const after = await getCurrentTrack()
      if (version != generation || !playerState.isPlay || identity.key != playerState.musicInfo.id) return
      if (!track || typeof track.id != 'string' || track.id != after?.id || track.musicId != identity.key || isTempTrack(track.id) || !Number.isFinite(position)) {
        baseline = null
        return
      }
      // 本地缓存不回传，也不为它保留后台轮询。
      if (typeof track.url != 'string' || !/^https?:\/\//i.test(track.url)) { stop(); return }
      if (!current || current.identity.key != identity.key) {
        const session = openPlaybackSession()
        // 未登录时不产生未处理拒绝；本次播放不会在后台改用另一账号。
        void session.catch(() => {})
        current = { identity, session, seconds: 0, attempts: 0, done: false, sending: false, retryAt: 0 }
      }
      const entry = current
      const now = performance.now()
      if (baseline?.trackId == track.id) {
        const elapsed = Math.max(0, (now - baseline.at) / 1000)
        const delta = position - baseline.position
        // 不把拖动、缓冲或暂停的时间算成有效播放，倍速也不能放大实际收听时长。
        if (delta > 0 && delta <= elapsed * 4 + 1) entry.seconds += Math.min(delta, elapsed)
      }
      baseline = { trackId: track.id, position, at: now }
      if (entry.done || entry.attempts >= 2) { stop(); return }
      if (entry.seconds < 5 || entry.sending || now < entry.retryAt) return
      entry.sending = true
      entry.attempts++
      try {
        const session = await entry.session
        if (version != generation || current != entry) return
        await reportPlayback(session, entry.identity, entry.seconds)
        entry.done = true
      } catch (error) {
        if (['login_required', 'account_changed'].includes((error as Error).message)) entry.done = true
        entry.retryAt = performance.now() + 2000
      } finally {
        entry.sending = false
        if (current == entry && (entry.done || entry.attempts >= 2)) stop()
      }
    } catch {
      // 旧采样失败不能清除新一轮播放的进度基线。
      // eslint-disable-next-line require-atomic-updates
      if (version == generation) baseline = null
    } finally {
      sampling.active = false
    }
  }
  const start = () => {
    if (timer != null) return
    timer = BackgroundTimer.setInterval(() => { void sample() }, 1000)
    void sample()
  }
  const reset = () => { stop(); current = null }
  global.app_event.on('playerPlaying', start)
  global.app_event.on('musicToggled', reset)
  global.app_event.on('playerEmptied', reset)
  global.app_event.on('stop', reset)
  global.app_event.on('playerPause', stop)
  global.app_event.on('pause', stop)
  global.app_event.on('playerWaiting', stop)
  global.app_event.on('playerError', stop)
  global.app_event.on('playerLoadstart', stop)
  global.app_event.on('playerEnded', reset)
  global.app_event.on('setProgress', () => { generation++; baseline = null })
}
