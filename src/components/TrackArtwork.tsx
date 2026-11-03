import { memo } from 'react'
import Image, { type ImageProps } from '@/components/common/Image'
import useTrackArtwork from '@/utils/hooks/useTrackArtwork'

export default memo(({ item, style }: { item: LX.Music.MusicInfo, style: ImageProps['style'] }) => {
  const { url, onError, revision } = useTrackArtwork(item)
  return <Image key={`${item.id}:${revision}`} url={url} cache={revision == 0} onError={onError} style={style} />
})
