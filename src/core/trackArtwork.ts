import { createArtworkLoader } from '@/utils/artworkLoader'
import { getPicUrl } from '@/core/music/online'

export const loadTrackArtwork = createArtworkLoader<LX.Music.MusicInfo>(async(musicInfo, isRefresh) => {
  if (musicInfo.source == 'local') return ''
  return getPicUrl({ musicInfo, isRefresh, allowToggleSource: false })
})
