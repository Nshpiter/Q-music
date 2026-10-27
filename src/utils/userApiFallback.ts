/** 自定义脚本之间的备用切换；不修改用户选中的主源，也不负责跨平台找歌。 */
const QUALITY_ORDER: LX.Quality[] = ['flac24bit', 'flac', 'wav', 'ape', '320k', '192k', '128k']
export const USER_API_CANCELLED = 'Cancel request'

export const getUserApiProviderIds = (primary: string, backups: readonly string[], imported: ReadonlyArray<{ id: string }>) => {
  if (!/^user_api/.test(primary)) return []
  const known = new Set(imported.map(api => api.id))
  return [...new Set([primary, ...backups])].filter(id => known.has(id))
}

export interface UserApiUrlResult {
  url: string
  quality: LX.Quality
  providerId: string
  providerName: string
  isFromCache: boolean
}

interface Cancelable<T> { promise: Promise<T>, cancel?: () => void }
interface FallbackOptions {
  providers: string[]
  source: LX.Source
  quality: LX.Quality
  signal?: AbortSignal
  isCurrent?: () => boolean
  getInfo: (id: string) => Promise<LX.UserApi.UserApiInfo>
  request: (id: string, quality: LX.Quality) => Cancelable<string>
  readCache?: (id: string, quality: LX.Quality) => Promise<string | null | undefined>
  isExcluded?: (id: string, quality: LX.Quality, cached: boolean) => boolean
  isProviderBlocked?: (id: string) => boolean
  excludedUrls?: ReadonlySet<string>
  onFailure?: (id: string, quality: LX.Quality | null, error: Error, url?: string) => void
  timeoutMs?: number
  budgetMs?: number
}

export const resolveUserApiFallback = async(options: FallbackOptions): Promise<UserApiUrlResult> => {
  const deadline = Date.now() + (options.budgetMs ?? 40_000)
  const timeoutMs = options.timeoutMs ?? 8_000
  const assertCurrent = () => {
    if (options.signal?.aborted === true || options.isCurrent?.() === false) throw new Error(USER_API_CANCELLED)
  }
  const wait = async<T>(operation: Cancelable<T>): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let abort: (() => void) | undefined
    try {
      assertCurrent()
      return await Promise.race([
        operation.promise,
        new Promise<T>((resolve, reject) => {
          timer = setTimeout(() => {
            operation.cancel?.()
            reject(new Error('music API request timeout'))
          }, Math.max(1, Math.min(timeoutMs, deadline - Date.now())))
          abort = () => {
            operation.cancel?.()
            reject(new Error(USER_API_CANCELLED))
          }
          options.signal?.addEventListener('abort', abort, { once: true })
        }),
      ])
    } finally {
      if (timer) clearTimeout(timer)
      if (abort) options.signal?.removeEventListener('abort', abort)
      if (options.signal?.aborted === true || options.isCurrent?.() === false) operation.cancel?.()
    }
  }
  const normalize = (value: string) => {
    const url = typeof value === 'string' ? value.trim() : ''
    if (!/^https?:\/\/[^\s/]+(?:[/?#]|$)/i.test(url)) throw new Error('invalid music URL')
    if (options.excludedUrls?.has(url)) throw new Error('music URL already failed')
    return url
  }
  const qualityIndex = QUALITY_ORDER.indexOf(options.quality)
  const qualitys = QUALITY_ORDER.slice(qualityIndex < 0 ? -1 : qualityIndex)
  let lastError = new Error('no enabled music API supports this song')
  for (const id of [...new Set(options.providers)]) {
    assertCurrent()
    if (Date.now() >= deadline) break
    if (options.isProviderBlocked?.(id)) continue
    if (options.readCache) {
      for (const quality of qualitys) {
        if (options.isExcluded?.(id, quality, true)) continue
        try {
          const cached = await wait({ promise: options.readCache(id, quality) })
          assertCurrent()
          if (cached) return { url: normalize(cached), quality, providerId: id, providerName: '', isFromCache: true }
        } catch (error) {
          assertCurrent()
          if ((error as Error).message === USER_API_CANCELLED) throw error
          // 无效缓存不能阻止向同一脚本重新取址。
        }
      }
    }
    let info: LX.UserApi.UserApiInfo
    try {
      info = await wait({ promise: options.getInfo(id) })
      assertCurrent()
    } catch (error) {
      assertCurrent()
      lastError = error as Error
      if (lastError.message === USER_API_CANCELLED) throw error
      options.onFailure?.(id, null, lastError)
      continue
    }
    const source = info.sources?.[options.source]
    if (source?.type !== 'music' || !source.actions.includes('musicUrl')) continue
    for (const quality of (options.source === 'local' ? [options.quality] : qualitys.filter(quality => source.qualitys.includes(quality)))) {
      assertCurrent()
      if (Date.now() >= deadline) break
      if (options.isExcluded?.(id, quality, false)) continue
      let url: string | undefined
      try {
        url = await wait(options.request(id, quality))
        assertCurrent()
        return { url: normalize(url), quality, providerId: id, providerName: info.name, isFromCache: false }
      } catch (error) {
        assertCurrent()
        lastError = error as Error
        if (lastError.message === USER_API_CANCELLED) throw error
        options.onFailure?.(id, quality, lastError, url)
        // 连接失败/超时不逐档重复等待，直接尝试下一个脚本。
        if (/timeout|timed?\s*out|network|ECONN|ETIMEDOUT|too many requests|429|超时|无法连接|服务器繁忙/i.test(lastError.message)) break
      }
    }
  }
  assertCurrent()
  throw lastError
}
