interface Track { id: string, source: string, meta: { picUrl?: string | null } }

// 列表封面独立于播放，合并重复请求并限制并发，避免大歌单一次请求全部图片。
export const createArtworkLoader = <T extends Track>(fetchArtwork: (track: T, refresh: boolean) => Promise<string>) => {
  const cache = new Map<string, { url: string, original: string, refreshed: boolean, expires: number }>()
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
    const original = track.meta.picUrl ?? ''
    if (track.source == 'local') return original
    const key = `${track.source}:${track.id}`
    const saved = cache.get(key)
    // 刷新得到的新封面优先于歌单里失效的旧 URL，重新进入列表也能复用。
    if (saved && saved.original == original && saved.expires > Date.now() && (!refresh || saved.refreshed)) return saved.url
    if (original && !refresh) return original
    const running = pending.get(key)
    if (running) return running
    const request = new Promise<string>(resolve => {
      queue.push(async() => {
        let url = ''
        let blocked = false
        try { url = await fetchArtwork(track, refresh) || '' } catch (error) { blocked = error instanceof Error && error.message == 'verification_required' }
        if (cache.size >= 256) cache.delete(cache.keys().next().value!)
        cache.set(key, { url, original, refreshed: refresh || blocked, expires: Date.now() + (url ? 30 * 60_000 : refresh || blocked ? 30_000 : 1000) })
        pending.delete(key)
        resolve(url)
      })
    })
    pending.set(key, request)
    drain()
    return request
  }
}
