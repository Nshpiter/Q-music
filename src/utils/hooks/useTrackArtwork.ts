import { useCallback, useEffect, useRef, useState } from 'react'
import { loadTrackArtwork } from '@/core/trackArtwork'

export default (item?: LX.Music.MusicInfo) => {
  const [url, setUrl] = useState(item?.meta.picUrl ?? '')
  const lifecycle = useRef({ active: false })
  const retried = useRef(false)
  useEffect(() => {
    const current = { active: true }
    lifecycle.current = current
    retried.current = false
    setUrl(item?.meta.picUrl ?? '')
    if (item && !item.meta.picUrl) {
      void loadTrackArtwork(item).then(next => { if (current.active) setUrl(next) })
    }
    return () => { current.active = false }
  }, [item, item?.meta.picUrl])
  const onError = useCallback(() => {
    setUrl('')
    if (!item || retried.current) return
    retried.current = true
    const current = lifecycle.current
    void loadTrackArtwork(item, true).then(next => { if (current.active) setUrl(next) })
  }, [item])
  return { url, onError }
}
