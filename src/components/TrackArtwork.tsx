import { memo } from 'react'
import Image, { type ImageProps } from '@/components/common/Image'
import useTrackArtwork from '@/utils/hooks/useTrackArtwork'

export default memo(({ item, style }: { item: LX.Music.MusicInfo, style: ImageProps['style'] }) => {
  const { url, onError } = useTrackArtwork(item)
  return <Image url={url} onError={onError} style={style} />
})
