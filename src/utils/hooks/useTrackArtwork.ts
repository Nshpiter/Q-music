import { useCallback, useEffect, useRef, useState } from 'react'
import { loadTrackArtwork } from '@/core/trackArtwork'

export default (item?: LX.Music.MusicInfo) => {
  const [url, setUrl] = useState(item?.meta.picUrl ?? '')
  const [revision, setRevision] = useState(0)
  const lifecycle = useRef<{ active: boolean, item?: LX.Music.MusicInfo, retried: boolean, timer?: ReturnType<typeof setTimeout> }>({ active: false, retried: false })
  useEffect(() => {
    const current: typeof lifecycle.current = { active: true, item, retried: false }
    lifecycle.current = current
    setRevision(0)
    setUrl('')
    if (item) {
      void loadTrackArtwork(item).then(next => {
        if (!current.active) return
        setUrl(next)
        // 临时离线后允许一次延迟恢复，避免占位图一直等到播放才更新。
        if (!next && item.source != 'local') {
          current.timer = setTimeout(() => {
            if (!current.active || current.retried) return
            current.retried = true
            setRevision(value => value + 1)
            void loadTrackArtwork(item, true).then(value => { if (current.active) setUrl(value) })
          }, 1200)
        }
      })
    }
    return () => { current.active = false; clearTimeout(current.timer) }
  }, [item, item?.meta.picUrl])
  const onError = useCallback(() => {
    const current = lifecycle.current
    if (!current.active || current.item !== item) return
    setUrl('')
    if (!item || current.retried) return
    current.retried = true
    clearTimeout(current.timer)
    setRevision(value => value + 1)
    void loadTrackArtwork(item, true).then(next => { if (current.active) setUrl(next) })
  }, [item])
  return { url, onError, revision }
}
