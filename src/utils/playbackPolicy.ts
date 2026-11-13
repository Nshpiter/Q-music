/** 换源策略只调整候选顺序，不改变脚本授权或歌曲匹配规则。 */
export const FALLBACK_PLATFORMS = ['wy', 'tx', 'kg', 'kw', 'mg'] as const
export const fallbackPlatformOrder = (value: string): string[] => [...new Set([
  ...value.split(',').filter(source => FALLBACK_PLATFORMS.some(item => item == source)),
  ...FALLBACK_PLATFORMS,
])]
export const orderFallbackCandidates = <T extends { source: string }>(items: T[], order: string): T[] => {
  const platforms = fallbackPlatformOrder(order)
  const rank = (source: string) => { const index = platforms.indexOf(source); return index < 0 ? platforms.length : index }
  return [...items].sort((a, b) => rank(a.source) - rank(b.source))
}
export const playbackQualitySteps = (quality: LX.Quality, downgrade: boolean): LX.Quality[] => {
  if (!downgrade) return [quality]
  const levels: LX.Quality[] = ['flac24bit', 'flac', 'wav', 'ape', '320k', '192k', '128k']
  const index = levels.indexOf(quality)
  return index < 0 ? [quality] : levels.slice(index)
}

// 每档音质先尝试原平台，再尝试其他平台；候选只搜索一次，取消后不继续搜索或请求。
export const resolveQualityFirst = async<T, C>(options: {
  quality: LX.Quality
  downgrade: boolean
  signal?: AbortSignal
  cancelledMessage: string
  original: (quality: LX.Quality) => Promise<T>
  alternatives: () => Promise<C[]>
  fallback: (candidates: C[], quality: LX.Quality) => Promise<T>
}): Promise<T> => {
  let candidates: C[] | undefined
  let lastError: unknown = new Error('music routes exhausted')
  const check = (error?: unknown) => {
    if (options.signal?.aborted === true || (error as Error | undefined)?.message == options.cancelledMessage) throw new Error(options.cancelledMessage)
  }
  for (const quality of playbackQualitySteps(options.quality, options.downgrade)) {
    check()
    try { return await options.original(quality) } catch (error) { check(error); lastError = error }
    if (!candidates) {
      check()
      try { candidates = await options.alternatives() } catch (error) { check(error); candidates = []; lastError = error }
    }
    check()
    if (!candidates.length) continue
    try { return await options.fallback([...candidates], quality) } catch (error) { check(error); lastError = error }
  }
  throw lastError
}

// 网易云可能静默降低请求音质，使用响应档位/码率识别实际结果。
export const neteasePlaybackQuality = (level: unknown, bitrate: unknown): LX.Quality | null => {
  const levels: Record<string, LX.Quality> = { standard: '128k', higher: '192k', exhigh: '320k', lossless: 'flac', hires: 'flac24bit' }
  if (typeof level == 'string' && levels[level]) return levels[level]
  const rate = Number(bitrate)
  if (!Number.isFinite(rate) || rate <= 0) return null
  return rate > 320_000 ? 'flac' : rate >= 320_000 ? '320k' : rate >= 192_000 ? '192k' : '128k'
}
