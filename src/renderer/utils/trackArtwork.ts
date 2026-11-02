import { createArtworkLoader } from '@common/utils/artworkLoader'
import { getPicUrl } from '@renderer/core/music/online'

export const loadTrackArtwork = createArtworkLoader<LX.Music.MusicInfo>(async(musicInfo, isRefresh) => {
  if (musicInfo.source == 'local') return ''
  return getPicUrl({ musicInfo, isRefresh, allowToggleSource: false })
})
