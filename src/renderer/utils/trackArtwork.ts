import { createArtworkLoader } from '@common/utils/artworkLoader'
import { getPicUrl } from '@renderer/core/music/online'
import { coverOverride } from '@renderer/store/coverOverrides'

const loadOriginalArtwork = createArtworkLoader<LX.Music.MusicInfo>(async(musicInfo, isRefresh) => {
  if (musicInfo.source == 'local') return ''
  return getPicUrl({ musicInfo, isRefresh, allowToggleSource: false })
})

export const loadTrackArtwork = async(track: LX.Music.MusicInfo, refresh = false) => coverOverride(track) || loadOriginalArtwork(track, refresh)
