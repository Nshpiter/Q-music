import { playHistory } from '@/core/playHistory'
import playerState from '@/store/player/state'

export default () => {
  let lastKey = ''
  global.app_event.on('musicToggled', () => { lastKey = '' })
  global.app_event.on('playerPlaying', () => {
    const current = playerState.playMusicInfo.musicInfo
    if (!current || current.id != playerState.musicInfo.id) return
    const track = 'progress' in current ? current.metadata.musicInfo : current
    const key = `${track.source}:${track.id}`
    if (key == lastKey) return
    lastKey = key
    void playHistory.record(track).catch(() => { lastKey = '' })
  })
}
