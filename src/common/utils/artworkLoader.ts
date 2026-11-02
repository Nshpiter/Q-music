interface Track { id: string, source: string, meta: { picUrl?: string | null } }

// 列表封面独立于播放，合并重复请求并限制并发，避免大歌单一次请求全部图片。
export const createArtworkLoader = <T extends Track>(fetchArtwork: (track: T, refresh: boolean) => Promise<string>) => {
  const cache = new Map<string, { url: string, expires: number }>()
  const pending = new Map<string, Promise<string>>()
  const queue: Array<() => Promise<void>> = []
  let active = 0
  const drain = () => {
    while (active < 3 && queue.length) {
      active++
      void queue.shift()!().finally(() => { active--; drain() })
    }
  }
  return async(track: T, refresh = false) => {
    if (track.meta.picUrl && !refresh) return track.meta.picUrl
    if (track.source == 'local') return ''
    const key = `${track.source}:${track.id}:${refresh ? 'refresh' : 'cached'}`
    const saved = cache.get(key)
    if (saved && saved.expires > Date.now()) return saved.url
    const running = pending.get(key)
    if (running) return running
    const request = new Promise<string>(resolve => {
      queue.push(async() => {
        let url = ''
        try { url = await fetchArtwork(track, refresh) || '' } catch {}
        if (cache.size >= 256) cache.delete(cache.keys().next().value!)
        cache.set(key, { url, expires: Date.now() + (url ? 30 * 60_000 : 30_000) })
        pending.delete(key)
        resolve(url)
      })
    })
    pending.set(key, request)
    drain()
    return request
  }
}
