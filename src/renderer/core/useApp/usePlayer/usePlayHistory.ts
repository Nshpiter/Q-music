import { onBeforeUnmount } from '@common/utils/vueTools'
import { playHistory } from '@renderer/core/playHistory'
import { musicInfo, playMusicInfo } from '@renderer/store/player/state'

export default () => {
  let lastPlay: { key: string } | null = null
  const changed = () => { lastPlay = null }
  const playing = () => {
    const current = playMusicInfo.musicInfo
    if (!current || current.id != musicInfo.id) return
    const track = 'progress' in current ? current.metadata.musicInfo : current
    const key = `${track.source}:${track.id}`
    if (lastPlay?.key == key) return
    const currentPlay = { key }
    lastPlay = currentPlay
    void playHistory.record(track).catch(() => { if (lastPlay === currentPlay) changed() })
  }
  window.app_event.on('musicToggled', changed)
  window.app_event.on('playerEnded', changed)
  window.app_event.on('playerPlaying', playing)
  onBeforeUnmount(() => {
    window.app_event.off('musicToggled', changed)
    window.app_event.off('playerEnded', changed)
    window.app_event.off('playerPlaying', playing)
  })
}
