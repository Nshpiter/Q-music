import type { MusicAccountProvider } from './types'

/** 官方 URL 短时缓存 TTL，对齐桌面端 5 分钟 */
const CACHE_TTL = 5 * 60_000

interface CacheEntry {
  url: string
  quality: LX.Quality
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

const buildKey = (provider: MusicAccountProvider, songId: string, mediaId: string, quality: LX.Quality) => {
  return `${provider}:${songId}:${mediaId}:${quality}`
}

export const getOfficialUrlCache = (provider: MusicAccountProvider, songId: string, mediaId: string, quality: LX.Quality): CacheEntry | null => {
  const entry = cache.get(buildKey(provider, songId, mediaId, quality))
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    cache.delete(buildKey(provider, songId, mediaId, quality))
    return null
  }
  return entry
}

export const setOfficialUrlCache = (
  provider: MusicAccountProvider,
  songId: string,
  mediaId: string,
  quality: LX.Quality,
  url: string,
  resolvedQuality: LX.Quality,
) => {
  cache.set(buildKey(provider, songId, mediaId, quality), {
    url,
    quality: resolvedQuality,
    expiresAt: Date.now() + CACHE_TTL,
  })
}

export const clearOfficialUrlCache = () => {
  cache.clear()
}
