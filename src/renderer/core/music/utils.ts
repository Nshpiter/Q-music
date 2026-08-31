import { apiSource, qualityList } from '@renderer/store'
import { assertApiSupport } from '@renderer/store/utils'
import musicSdk from '@renderer/utils/musicSdk'
import {
  // getOtherSource as getOtherSourceFromStore,
  // saveOtherSource as saveOtherSourceFromStore,
  getMusicAccountMusicUrl,
  getMusicUrl as getStoreMusicUrl,
  removeMusicUrl as removeStoreMusicUrl,
  getPlayerLyric as getStoreLyric,
} from '@renderer/utils/ipc'
import { appSetting } from '@renderer/store/setting'
import { langS2T, toNewMusicInfo, toOldMusicInfo } from '@renderer/utils'
import { requestMsg } from '@renderer/utils/message'
import { apis } from '@renderer/utils/musicSdk/api-source'
import type { MusicUrlRequestOptions } from './index'


interface OtherSourceRequestEntry {
  promise: Promise<LX.Music.MusicInfoOnline[]>
  discard: () => void
}

const getOtherSourcePromises = new Map<string, OtherSourceRequestEntry>()
const otherSourceCache = new Map<LX.Music.MusicInfo | LX.Download.ListItem, LX.Music.MusicInfoOnline[]>()
export const existTimeExp = /\[\d{1,2}:.*\d{1,4}\]/

const waitWithSignal = async<T>(promise: Promise<T>, signal?: AbortSignal, onAbort?: () => void): Promise<T> => {
  if (!signal) return promise
  if (signal.aborted) throw new Error(requestMsg.cancelRequest)

  return new Promise<T>((resolve, reject) => {
    let settled = false
    const cleanup = () => {
      signal.removeEventListener('abort', handleAbort)
    }
    const handleAbort = () => {
      if (settled) return
      settled = true
      cleanup()
      onAbort?.()
      reject(new Error(requestMsg.cancelRequest))
    }
    signal.addEventListener('abort', handleAbort, { once: true })
    void promise.then(value => {
      if (settled) return
      settled = true
      cleanup()
      resolve(value)
    }, error => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    })
  })
}

export const getOtherSource = async(musicInfo: LX.Music.MusicInfo | LX.Download.ListItem, isRefresh = false, signal?: AbortSignal): Promise<LX.Music.MusicInfoOnline[]> => {
  // if (!isRefresh && musicInfo.id) {
  //   const cachedInfo = await getOtherSourceFromStore(musicInfo.id)
  //   if (cachedInfo.length) return cachedInfo
  // }
  if (signal?.aborted) throw new Error(requestMsg.cancelRequest)
  if (!isRefresh && otherSourceCache.has(musicInfo)) return otherSourceCache.get(musicInfo)!
  let key: string
  let searchMusicInfo: {
    name: string
    singer: string
    source: string
    albumName: string
    interval: string
  }
  if ('progress' in musicInfo) {
    key = `local_${musicInfo.id}`
    searchMusicInfo = {
      name: musicInfo.metadata.musicInfo.name,
      singer: musicInfo.metadata.musicInfo.singer,
      source: musicInfo.metadata.musicInfo.source,
      albumName: musicInfo.metadata.musicInfo.meta.albumName,
      interval: musicInfo.metadata.musicInfo.interval ?? '',
    }
  } else {
    key = `${musicInfo.source}_${musicInfo.id}`
    searchMusicInfo = {
      name: musicInfo.name,
      singer: musicInfo.singer,
      source: musicInfo.source,
      albumName: musicInfo.meta.albumName,
      interval: musicInfo.interval ?? '',
    }
  }
  const requestKey = isRefresh ? `${key}_refresh` : key
  const pendingRequest = getOtherSourcePromises.get(requestKey)
  if (pendingRequest) {
    return waitWithSignal(pendingRequest.promise, signal, pendingRequest.discard)
  }

  let discardResult = false
  const promise = new Promise<LX.Music.MusicInfoOnline[]>((resolve, reject) => {
    let timeout: null | NodeJS.Timeout = setTimeout(() => {
      timeout = null
      discardResult = true
      reject(new Error('find music timeout'))
    }, 15_000)
    musicSdk.findMusic(searchMusicInfo).then((otherSource) => {
      const source = otherSource.map(toNewMusicInfo) as LX.Music.MusicInfoOnline[]
      if (!discardResult) {
        if (otherSourceCache.size > 10) otherSourceCache.clear()
        otherSourceCache.set(musicInfo, source)
      }
      resolve(source)
    }).catch(reject).finally(() => {
      if (timeout) clearTimeout(timeout)
    })
  }).then((otherSource) => {
    // if (otherSource.length) void saveOtherSourceFromStore(musicInfo.id, otherSource)
    return otherSource
  }).finally(() => {
    if (getOtherSourcePromises.get(requestKey)?.promise == promise) getOtherSourcePromises.delete(requestKey)
  })
  const requestEntry: OtherSourceRequestEntry = {
    promise,
    discard() {
      discardResult = true
    },
  }
  getOtherSourcePromises.set(requestKey, requestEntry)
  return waitWithSignal(promise, signal, requestEntry.discard)
}


export const buildLyricInfo = async(lyricInfo: MakeOptional<LX.Player.LyricInfo, 'rawlrcInfo'>): Promise<LX.Player.LyricInfo> => {
  if (!appSetting['player.isS2t']) {
    // @ts-expect-error
    if (lyricInfo.rawlrcInfo) return lyricInfo
    return { ...lyricInfo, rawlrcInfo: { ...lyricInfo } }
  }

  if (appSetting['player.isS2t']) {
    const tasks = [
      lyricInfo.lyric ? langS2T(lyricInfo.lyric) : Promise.resolve(''),
      lyricInfo.tlyric ? langS2T(lyricInfo.tlyric) : Promise.resolve(''),
      lyricInfo.rlyric ? langS2T(lyricInfo.rlyric) : Promise.resolve(''),
      lyricInfo.lxlyric ? langS2T(lyricInfo.lxlyric) : Promise.resolve(''),
    ]
    if (lyricInfo.rawlrcInfo) {
      tasks.push(lyricInfo.lyric ? langS2T(lyricInfo.lyric) : Promise.resolve(''))
      tasks.push(lyricInfo.tlyric ? langS2T(lyricInfo.tlyric) : Promise.resolve(''))
      tasks.push(lyricInfo.rlyric ? langS2T(lyricInfo.rlyric) : Promise.resolve(''))
      tasks.push(lyricInfo.lxlyric ? langS2T(lyricInfo.lxlyric) : Promise.resolve(''))
    }
    return Promise.all(tasks).then(([lyric, tlyric, rlyric, lxlyric, lyric_raw, tlyric_raw, rlyric_raw, lxlyric_raw]) => {
      const rawlrcInfo = lyric_raw ? {
        lyric: lyric_raw,
        tlyric: tlyric_raw,
        rlyric: rlyric_raw,
        lxlyric: lxlyric_raw,
      } : {
        lyric,
        tlyric,
        rlyric,
        lxlyric,
      }
      return {
        lyric,
        tlyric,
        rlyric,
        lxlyric,
        rawlrcInfo,
      }
    })
  }

  // @ts-expect-error
  return lyricInfo.rawlrcInfo ? lyricInfo : { ...lyricInfo, rawlrcInfo: { ...lyricInfo } }
}

export const getCachedLyricInfo = async(musicInfo: LX.Music.MusicInfo): Promise<LX.Player.LyricInfo | null> => {
  let lrcInfo = await getStoreLyric(musicInfo)
  // lrcInfo = {} as unknown as LX.Player.LyricInfo
  if (existTimeExp.test(lrcInfo.lyric)) {
    if (lrcInfo.tlyric != null) {
      // if (musicInfo.lrc.startsWith('\ufeff[id:$00000000]')) {
      //   let str = musicInfo.lrc.replace('\ufeff[id:$00000000]\n', '')
      //   commit('setLrc', { musicInfo, lyric: str, tlyric: musicInfo.tlrc, lxlyric: musicInfo.tlrc })
      // } else if (musicInfo.lrc.startsWith('[id:$00000000]')) {
      //   let str = musicInfo.lrc.replace('[id:$00000000]\n', '')
      //   commit('setLrc', { musicInfo, lyric: str, tlyric: musicInfo.tlrc, lxlyric: musicInfo.tlrc })
      // }

      if (lrcInfo.lxlyric == null) {
        switch (musicInfo.source) { // 以下源支持lxlyric 重新获取
          case 'kg':
          case 'kw':
          case 'mg':
          case 'wy':
          case 'tx':
            break
          default:
            return lrcInfo
        }
      } else if (lrcInfo.rlyric == null) {
        // 以下源支持 rlyric 重新获取
        if (!['wy', 'kg', 'tx'].includes(musicInfo.source)) return lrcInfo
      } else return lrcInfo
    }
    if (musicInfo.source == 'local') return lrcInfo
  }
  return null
}

export const getOnlineOtherSourceMusicUrlByLocal = async(musicInfo: LX.Music.MusicInfoLocal, isRefresh: boolean, requestOptions: MusicUrlRequestOptions = {}): Promise<{
  url: string
  quality: LX.Quality
  isFromCache: boolean
  routeKey: string
  transportMode: 'cache' | 'api'
  cacheProviderId: string
}> => {
  const quality: LX.Quality = '128k'
  const providerId = getMusicUrlCacheProviderId()
  const tryCachedRoute = async(targetProviderId: string) => {
    const cacheRouteKey = createMusicRouteKey('cache', musicInfo, quality, targetProviderId)
    const shouldRefreshCache = isRefresh || (requestOptions.refreshRouteKeys?.has(cacheRouteKey) ?? false)
    if (shouldRefreshCache || requestOptions.excludedRouteKeys?.has(cacheRouteKey)) return null
    const cachedUrl = await getStoreMusicUrl(musicInfo, quality, targetProviderId)
    if (cachedUrl) {
      try {
        const url = normalizeOnlineMusicUrl(cachedUrl)
        if (!requestOptions.excludedUrls?.has(url)) return { url, quality, isFromCache: true, routeKey: cacheRouteKey, transportMode: 'cache' as const, cacheProviderId: targetProviderId }
      } catch {}
      requestOptions.onRouteFailed?.(cacheRouteKey, cachedUrl)
      void removeStoreMusicUrl(musicInfo, quality, targetProviderId)
    }
    return null
  }

  const cachedResult = await tryCachedRoute(providerId)
  if (cachedResult) return cachedResult
  const blockedProviderError = requestOptions.blockedApiProviders?.get(providerId)
  if (blockedProviderError) throw blockedProviderError
  const apiInitRouteKey = `api-init:${providerId}`
  if (requestOptions.excludedRouteKeys?.has(apiInitRouteKey)) throw new Error('source init unavailable')

  let apiProviderId = providerId
  let apiRouteKey = createMusicRouteKey('api', musicInfo, quality, apiProviderId)
  try {
    const isApiReady = await withTimeout(window.lx.apiInitPromise[0], MUSIC_URL_REQUEST_TIMEOUT, 'source init timeout', { signal: requestOptions.signal })
    if (!isApiReady) throw new Error('source init failed')
  } catch (error: any) {
    if (error.message == requestMsg.cancelRequest) throw error
    const failedProviderId = getMusicUrlCacheProviderId()
    if (failedProviderId != providerId) {
      const failedProviderCachedResult = await tryCachedRoute(failedProviderId)
      if (failedProviderCachedResult) return failedProviderCachedResult
    }
    const initError = error instanceof Error ? error : new Error('source init unavailable')
    for (const targetProviderId of new Set([providerId, failedProviderId])) {
      requestOptions.blockedApiProviders?.set(targetProviderId, initError)
      requestOptions.onRouteFailed?.(`api-init:${targetProviderId}`)
    }
    throw error
  }

  apiProviderId = getMusicUrlCacheProviderId()
  if (apiProviderId != providerId) {
    const refreshedCachedResult = await tryCachedRoute(apiProviderId)
    if (refreshedCachedResult) return refreshedCachedResult
  }
  const currentBlockedProviderError = requestOptions.blockedApiProviders?.get(apiProviderId)
  if (currentBlockedProviderError) throw currentBlockedProviderError
  apiRouteKey = createMusicRouteKey('api', musicInfo, quality, apiProviderId)
  if (requestOptions.excludedRouteKeys?.has(apiRouteKey)) throw new Error('local music API route already failed')

  try {
    const sourceApi = apis('local')
    const request = sourceApi.getMusicUrl(toOldMusicInfo(musicInfo), null)
    const { url: rawUrl } = await withTimeout(
      request.promise as Promise<{ url: string }>,
      MUSIC_URL_REQUEST_TIMEOUT,
      'local music API request timeout',
      { signal: requestOptions.signal, onCancel: request.canceleFn },
    )
    const url = normalizeOnlineMusicUrl(rawUrl)
    if (requestOptions.excludedUrls?.has(url)) {
      requestOptions.onRouteFailed?.(apiRouteKey, url)
      throw new Error('music URL already failed')
    }
    return { url, quality, isFromCache: false, routeKey: apiRouteKey, transportMode: 'api', cacheProviderId: apiProviderId }
  } catch (err: any) {
    if (err.message == requestMsg.cancelRequest) throw err
    const routeError = err instanceof Error ? err : new Error('local music API route failed')
    if (err.message == requestMsg.tooManyRequests) {
      requestOptions.blockedApiProviders?.set(apiProviderId, routeError)
      requestOptions.onRouteRateLimited?.(`api-provider:${apiProviderId}`)
      requestOptions.onRouteRateLimited?.(apiRouteKey)
    } else if (!requestOptions.excludedRouteKeys?.has(apiRouteKey)) {
      if (isMusicApiProviderTransportFailure(err)) requestOptions.blockedApiProviders?.set(apiProviderId, routeError)
      requestOptions.onRouteFailed?.(apiRouteKey)
    }
    throw err
  }
}

export const getOnlineOtherSourceLyricByLocal = async(musicInfo: LX.Music.MusicInfoLocal, isRefresh: boolean): Promise<{
  lyricInfo: LX.Music.LyricInfo
  isFromCache: boolean
}> => {
  if (!await window.lx.apiInitPromise[0]) throw new Error('source init failed')

  const lyricInfo = await getCachedLyricInfo(musicInfo)
  if (lyricInfo && !isRefresh) return { lyricInfo, isFromCache: true }

  let reqPromise
  try {
    reqPromise = apis('local').getLyric(toOldMusicInfo(musicInfo)).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }

  return reqPromise.then((lyricInfo: LX.Music.LyricInfo) => {
    return { lyricInfo, isFromCache: false }
  })
}

export const getOnlineOtherSourcePicByLocal = async(musicInfo: LX.Music.MusicInfoLocal): Promise<{
  url: string
}> => {
  if (!await window.lx.apiInitPromise[0]) throw new Error('source init failed')

  let reqPromise
  try {
    reqPromise = apis('local').getPic(toOldMusicInfo(musicInfo)).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }

  return reqPromise.then((url: string) => {
    return { url }
  })
}

export const TRY_QUALITYS_LIST = ['flac24bit', 'flac', '320k'] as const
const QUALITY_FALLBACKS: LX.Quality[] = ['flac24bit', 'flac', 'wav', 'ape', '320k', '192k', '128k']
const OFFICIAL_QUALITYS: LX.Quality[] = ['flac24bit', 'flac', '320k', '128k']
const MUSIC_URL_REQUEST_TIMEOUT = 12_000

export const getMusicUrlCacheProviderId = () => {
  const configuredSource = appSetting['common.apiSource']
  const activeSource = apiSource.value
  // 设置变更通过 IPC 同步，activeSource 可能比设置值晚一个事件循环。
  // 切换期间使用配置中的 provider id，避免误读上一个接口留下的缓存。
  if (configuredSource && activeSource && configuredSource != activeSource) return configuredSource
  return activeSource || configuredSource || 'no_api'
}

/**
 * 自定义 API 是用户主动配置的音源，默认播放时应优先使用它。
 *
 * 这里不要用 `apiSource.value != 'temp'` 之类的白名单判断：内置接口列表
 * 会随版本变化，而用户 API 的 id 始终带有 `user_api` 前缀。
 */
export const isCustomApiSource = (source?: string | null): boolean => {
  const selectedSource = source ?? appSetting['common.apiSource'] ?? apiSource.value
  return /^user_api(?:_|$)/.test(selectedSource ?? '')
}

const getQualityFallbacks = (quality: LX.Quality) => {
  const index = QUALITY_FALLBACKS.indexOf(quality)
  return index < 0 ? ['128k'] as LX.Quality[] : QUALITY_FALLBACKS.slice(index)
}

export const getPlayQualityCandidates = (highQuality: LX.Quality, musicInfo: LX.Music.MusicInfoOnline): LX.Quality[] => {
  const supportedQualitys = qualityList.value[musicInfo.source]
  const fallbackQualitys = getQualityFallbacks(highQuality)
  const metadataQualitys = musicInfo.meta?._qualitys ?? {}
  // 自定义 API 的 qualitys 声明就是该接口可尝试的音质范围。
  // 与官方/内置接口不同，它不一定能在搜索结果的歌曲元数据中完整标注，
  // 因此不能再用歌曲元数据把自定义高音质提前过滤掉。
  const isUserApi = isCustomApiSource()
  if (!supportedQualitys?.length) {
    // 自定义接口刚切换或仍在初始化时 qualityList 可能暂时为空。
    // 不要立即把用户选择降成 128K：接口声明未知时先按自定义接口
    // 的完整回退链尝试；内置接口则只相信歌曲元数据，避免无意义请求。
    if (isUserApi) return fallbackQualitys
    const metadataCandidates = fallbackQualitys.filter(quality => {
      if (quality == '128k') return true
      if (quality == 'flac' && (metadataQualitys.flac ?? metadataQualitys.ape ?? metadataQualitys.wav)) return true
      return !!metadataQualitys[quality]
    })
    return metadataCandidates.length ? metadataCandidates : ['128k']
  }
  const candidates = fallbackQualitys.filter(quality => {
    return supportedQualitys.includes(quality) && (isUserApi || quality == '128k' || !!metadataQualitys[quality])
  })
  if (candidates.length) return candidates

  const lowestSupportedQuality = [...fallbackQualitys].reverse().find(quality => supportedQualitys.includes(quality))
  return [lowestSupportedQuality ?? '128k']
}

export const getPlayQuality = (highQuality: LX.Quality, musicInfo: LX.Music.MusicInfoOnline): LX.Quality => {
  return getPlayQualityCandidates(highQuality, musicInfo)[0]
}

const getCacheQualityCandidates = (highQuality: LX.Quality) => getQualityFallbacks(highQuality)

type MusicUrlTransportMode = 'official' | 'cache' | 'api'

interface OnlineMusicUrlResult {
  url: string
  musicInfo: LX.Music.MusicInfoOnline
  quality: LX.Quality
  isFromCache: boolean
  isOfficial: boolean
  routeKey: string
  transportMode: MusicUrlTransportMode
  cacheProviderId: string
  officialReportSongId?: string
}

const createMusicRouteKey = (mode: MusicUrlTransportMode, musicInfo: LX.Music.MusicInfo, quality: LX.Quality, providerId?: string) => {
  return mode == 'official'
    ? `${mode}:${musicInfo.source}:${musicInfo.id}:${quality}`
    : `${mode}:${providerId ?? 'no_api'}:${musicInfo.source}:${musicInfo.id}:${quality}`
}

const normalizeOnlineMusicUrl = (url: string) => {
  const normalizedUrl = typeof url == 'string' ? url.trim() : ''
  if (!normalizedUrl) throw new Error('empty music URL')
  const parsedUrl = new URL(normalizedUrl)
  if ((parsedUrl.protocol != 'http:' && parsedUrl.protocol != 'https:') || !parsedUrl.hostname) {
    throw new Error('invalid music URL')
  }
  return normalizedUrl
}

const withTimeout = async<T>(promise: Promise<T>, timeoutMs: number, message: string, options: {
  signal?: AbortSignal
  onCancel?: () => void
} = {}): Promise<T> => {
  let timeout: NodeJS.Timeout | null = null
  let abortListener: (() => void) | null = null
  let cancelCalled = false
  const cancel = () => {
    if (cancelCalled) return
    cancelCalled = true
    options.onCancel?.()
  }
  try {
    if (options.signal?.aborted) {
      cancel()
      throw new Error(requestMsg.cancelRequest)
    }
    return await Promise.race([
      promise,
      new Promise<T>((resolve, reject) => {
        timeout = setTimeout(() => {
          cancel()
          reject(new Error(message))
        }, timeoutMs)
      }),
      new Promise<T>((resolve, reject) => {
        if (!options.signal) return
        abortListener = () => {
          cancel()
          reject(new Error(requestMsg.cancelRequest))
        }
        options.signal.addEventListener('abort', abortListener, { once: true })
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
    if (abortListener) options.signal?.removeEventListener('abort', abortListener)
  }
}

const isMusicApiProviderTransportFailure = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  if ([
    'music API request timeout',
    requestMsg.timeout,
    requestMsg.notConnectNetwork,
    requestMsg.unachievable,
  ].some(item => message.includes(item))) return true

  return /(?:ECONN(?:ABORTED|REFUSED|RESET)|ETIMEDOUT|network\s*error|fetch failed|socket hang up)/i.test(message)
}

const isMusicApiTransportFailure = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  return isMusicApiProviderTransportFailure(error) || ['source init timeout', 'source init failed', 'Api is not found'].includes(message)
}

const getOfficialQuality = (quality: LX.Quality) => {
  if (OFFICIAL_QUALITYS.includes(quality)) return quality
  return getQualityFallbacks(quality).find(item => OFFICIAL_QUALITYS.includes(item)) ?? '128k'
}

const resolveOnlineMusicUrl = async({ musicInfo, quality, isRefresh, requestOptions = {} }: {
  musicInfo: LX.Music.MusicInfoOnline
  quality: LX.Quality
  isRefresh: boolean
  requestOptions?: MusicUrlRequestOptions
}): Promise<OnlineMusicUrlResult> => {
  const routeStrategy = requestOptions.routeStrategy ?? 'all'
  let cacheProviderId = getMusicUrlCacheProviderId()
  const isUrlExcluded = (url: string) => requestOptions.excludedUrls?.has(url) ?? false
  const isRouteExcluded = (routeKey: string) => requestOptions.excludedRouteKeys?.has(routeKey) ?? false
  const shouldRefreshRoute = (routeKey: string) => isRefresh || (requestOptions.refreshRouteKeys?.has(routeKey) ?? false)
  const checkedCacheRoutes = new Set<string>()
  const tryCachedRoutes = async(providerId: string, targetQualitys: LX.Quality[]): Promise<OnlineMusicUrlResult | null> => {
    for (const targetQuality of targetQualitys) {
      const cacheRouteKey = createMusicRouteKey('cache', musicInfo, targetQuality, providerId)
      if (checkedCacheRoutes.has(cacheRouteKey)) continue
      checkedCacheRoutes.add(cacheRouteKey)
      if (shouldRefreshRoute(cacheRouteKey) || isRouteExcluded(cacheRouteKey)) continue
      const cachedUrl = await getStoreMusicUrl(musicInfo, targetQuality, providerId)
      if (!cachedUrl) continue
      try {
        const url = normalizeOnlineMusicUrl(cachedUrl)
        if (!isUrlExcluded(url)) {
          return {
            musicInfo,
            url,
            quality: targetQuality,
            isFromCache: true,
            isOfficial: false,
            routeKey: cacheRouteKey,
            transportMode: 'cache',
            cacheProviderId: providerId,
          }
        }
      } catch {
        // Invalid cached URLs are removed below.
      }
      requestOptions.onRouteFailed?.(cacheRouteKey, cachedUrl)
      void removeStoreMusicUrl(musicInfo, targetQuality, providerId)
    }
    return null
  }

  const preferCustomApi = isCustomApiSource() && routeStrategy == 'all'
  const tryOfficialRoute = async(): Promise<OnlineMusicUrlResult | null> => {
    if ((musicInfo.source != 'tx' && musicInfo.source != 'wy') || routeStrategy == 'api') return null
    const officialQuality = getOfficialQuality(quality)
    const routeKey = createMusicRouteKey('official', musicInfo, officialQuality)
    if (!isRouteExcluded(routeKey)) {
      let failedUrl = ''
      try {
        const officialResult = await withTimeout(
          getMusicAccountMusicUrl(musicInfo, officialQuality, shouldRefreshRoute(routeKey)),
          10_000,
          'official music URL timeout',
          { signal: requestOptions.signal },
        )
        if (officialResult?.status == 'available' && officialResult.url) {
          const url = normalizeOnlineMusicUrl(officialResult.url)
          failedUrl = url
          if (!isUrlExcluded(url)) {
            return {
              musicInfo,
              url,
              quality: officialResult.quality,
              isFromCache: false,
              isOfficial: true,
              routeKey,
              transportMode: 'official',
              cacheProviderId,
              officialReportSongId: officialResult.reportSongId || undefined,
            }
          }
        }
      } catch (error: any) {
        if (error.message == requestMsg.cancelRequest) throw error
        console.warn('[music] official URL request failed', error)
      }
      requestOptions.onRouteFailed?.(routeKey, failedUrl || undefined)
    }
    return null
  }

  // 选择自定义 API 时，官方账号线路只作为兜底；未选择自定义 API 时
  // 保持原有的官方优先行为，避免改变普通用户的播放习惯。
  if (!preferCustomApi) {
    const officialResult = await tryOfficialRoute()
    if (officialResult) return officialResult
  }

  if (routeStrategy == 'official') throw new Error('official music URL unavailable')
  try {
    const initialProviderId = getMusicUrlCacheProviderId()
    const initialQualitys = getCacheQualityCandidates(quality)
    const initialCachedResult = await tryCachedRoutes(initialProviderId, initialQualitys)
    if (initialCachedResult) return initialCachedResult

    const blockedProviderError = requestOptions.blockedApiProviders?.get(initialProviderId)
    if (blockedProviderError) throw blockedProviderError
    const apiInitRouteKey = `api-init:${initialProviderId}`
    if (isRouteExcluded(apiInitRouteKey)) throw new Error('source init unavailable')
    try {
      const isApiReady = await withTimeout(window.lx.apiInitPromise[0], MUSIC_URL_REQUEST_TIMEOUT, 'source init timeout', { signal: requestOptions.signal })
      if (!isApiReady) throw new Error('source init failed')
    } catch (error: any) {
      if (error.message == requestMsg.cancelRequest) throw error
      const failedProviderId = getMusicUrlCacheProviderId()
      if (failedProviderId != initialProviderId) {
        const failedProviderCachedResult = await tryCachedRoutes(failedProviderId, initialQualitys)
        if (failedProviderCachedResult) return failedProviderCachedResult
      }
      const initError = error instanceof Error ? error : new Error('source init unavailable')
      for (const targetProviderId of new Set([initialProviderId, failedProviderId])) {
        requestOptions.blockedApiProviders?.set(targetProviderId, initError)
        requestOptions.onRouteFailed?.(`api-init:${targetProviderId}`)
      }
      throw error
    }

    cacheProviderId = getMusicUrlCacheProviderId()
    const targetQualitys = getPlayQualityCandidates(quality, musicInfo)
    const apiProviderId = cacheProviderId
    const cachedResult = await tryCachedRoutes(apiProviderId, targetQualitys)
    if (cachedResult) return cachedResult

    const currentBlockedProviderError = requestOptions.blockedApiProviders?.get(apiProviderId)
    if (currentBlockedProviderError) throw currentBlockedProviderError
    if (targetQualitys.every(targetQuality => isRouteExcluded(createMusicRouteKey('api', musicInfo, targetQuality, apiProviderId)))) {
      throw new Error('music API routes exhausted')
    }
    let sourceApi: ReturnType<typeof apis>
    try {
      if (!assertApiSupport(musicInfo.source)) throw new Error('source not supported by current API')
      sourceApi = apis(musicInfo.source)
    } catch (error: any) {
      if (error.message == requestMsg.cancelRequest) throw error
      for (const targetQuality of targetQualitys) {
        requestOptions.onRouteFailed?.(createMusicRouteKey('api', musicInfo, targetQuality, apiProviderId))
      }
      throw error
    }
    let lastError: Error | null = null
    let rateLimitError: Error | null = null
    for (const targetQuality of targetQualitys) {
      const apiRouteKey = createMusicRouteKey('api', musicInfo, targetQuality, apiProviderId)
      let failedUrl = ''
      try {
        if (isRouteExcluded(apiRouteKey)) continue
        const request = sourceApi.getMusicUrl(toOldMusicInfo(musicInfo), targetQuality)
        const { url: rawUrl, type } = await withTimeout(
          request.promise as Promise<{ url: string, type: LX.Quality }>,
          MUSIC_URL_REQUEST_TIMEOUT,
          'music API request timeout',
          { signal: requestOptions.signal, onCancel: request.canceleFn },
        )
        const url = normalizeOnlineMusicUrl(rawUrl)
        failedUrl = url
        if (isUrlExcluded(url)) throw new Error('music URL already failed')
        return {
          musicInfo,
          url,
          quality: type,
          isFromCache: false,
          isOfficial: false,
          routeKey: apiRouteKey,
          transportMode: 'api',
          cacheProviderId: apiProviderId,
        }
      } catch (err: any) {
        if (err.message == requestMsg.cancelRequest) throw err
        lastError = err instanceof Error ? err : new Error('music API route failed')
        if (err.message == requestMsg.tooManyRequests) {
          rateLimitError = lastError
          requestOptions.blockedApiProviders?.set(apiProviderId, lastError)
          requestOptions.onRouteRateLimited?.(`api-provider:${apiProviderId}`)
          for (const fallbackQuality of targetQualitys) {
            requestOptions.onRouteRateLimited?.(createMusicRouteKey('api', musicInfo, fallbackQuality, apiProviderId))
          }
        } else {
          requestOptions.onRouteFailed?.(apiRouteKey, failedUrl || undefined)
          if (isMusicApiTransportFailure(err)) {
            if (isMusicApiProviderTransportFailure(err)) requestOptions.blockedApiProviders?.set(apiProviderId, lastError)
            for (const fallbackQuality of targetQualitys) {
              requestOptions.onRouteFailed?.(createMusicRouteKey('api', musicInfo, fallbackQuality, apiProviderId))
            }
            break
          }
        }
      }
    }
    throw rateLimitError ?? lastError ?? new Error('music API routes exhausted')
  } catch (error: any) {
    // 自定义 API 的所有线路都失败后，再尝试官方账号线路，保证“优先自定义”
    // 不会退化成“只能自定义、失败就跳过歌曲”。
    if (preferCustomApi && error.message != requestMsg.cancelRequest) {
      const officialResult = await tryOfficialRoute()
      if (officialResult) return officialResult
    }
    throw error
  }
}

const isOfficialSource = (source: LX.Source) => source == 'tx' || source == 'wy'
const createMusicCandidateKey = (musicInfo: LX.Music.MusicInfoOnline) => `${musicInfo.source}:${musicInfo.id}`

export const getOnlineOtherSourceMusicUrl = async({ musicInfos, quality, onToggleSource, isRefresh, retryedMusic = [], requestOptions }: {
  musicInfos: LX.Music.MusicInfoOnline[]
  quality?: LX.Quality
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  isRefresh: boolean
  retryedMusic?: string[]
  requestOptions?: MusicUrlRequestOptions
}): Promise<OnlineMusicUrlResult> => {
  const desiredQuality = quality ?? appSetting['player.playQuality']
  let rateLimitMessage = ''
  const strategy = requestOptions?.routeStrategy ?? 'all'
  const preferCustomApi = isCustomApiSource()
  const candidates = musicInfos.filter((musicInfo, index, list) => {
    const key = createMusicCandidateKey(musicInfo)
    return !retryedMusic.includes(key) && list.findIndex(item => createMusicCandidateKey(item) == key) == index
  })

  const tryCandidates = async(routeStrategy: 'official' | 'api', items: LX.Music.MusicInfoOnline[]) => {
    for (const musicInfo of items) {
      const candidateKey = createMusicCandidateKey(musicInfo)
      if (routeStrategy == 'official' && !isOfficialSource(musicInfo.source)) continue
      console.log('try toggle to: ', musicInfo.source, musicInfo.name, musicInfo.singer, musicInfo.interval, routeStrategy)
      onToggleSource(musicInfo)
      try {
        return await resolveOnlineMusicUrl({
          musicInfo,
          quality: desiredQuality,
          isRefresh,
          requestOptions: { ...requestOptions, routeStrategy },
        })
      } catch (err: any) {
        if (err.message == requestMsg.cancelRequest) throw err
        if (err.message == requestMsg.tooManyRequests) rateLimitMessage = err.message
        else console.warn('[music] fallback route failed', candidateKey, routeStrategy, err)
      }
    }
    return null
  }

  // 自定义 API 是默认首选时，跨平台回退也保持同样的顺序：先尝试
  // 自定义接口返回的所有候选，再使用官方账号线路兜底。
  if (preferCustomApi && strategy != 'official') {
    const result = await tryCandidates('api', candidates)
    if (result) return result
  }
  if (strategy != 'api') {
    const result = await tryCandidates('official', candidates.filter(item => isOfficialSource(item.source)))
    if (result) return result
  }
  if (!preferCustomApi && strategy != 'official') {
    const result = await tryCandidates('api', candidates)
    if (result) return result
  }
  if (rateLimitMessage) throw new Error(rateLimitMessage)
  throw new Error(window.i18n.t('toggle_source_failed'))
}

/**
 * 获取在线音乐URL
 */
export const handleGetOnlineMusicUrl = async({ musicInfo, quality, onToggleSource, isRefresh, allowToggleSource, requestOptions }: {
  musicInfo: LX.Music.MusicInfoOnline
  quality?: LX.Quality
  isRefresh: boolean
  allowToggleSource: boolean
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  requestOptions?: MusicUrlRequestOptions
}): Promise<OnlineMusicUrlResult> => {
  const targetQuality = quality ?? appSetting['player.playQuality']
  try {
    return await resolveOnlineMusicUrl({ musicInfo, quality: targetQuality, isRefresh, requestOptions })
  } catch (err: any) {
    console.warn('[music] requested route failed', createMusicCandidateKey(musicInfo), err)
    if (!allowToggleSource) throw err
    onToggleSource()
    const otherSource = await getOtherSource(musicInfo, isRefresh, requestOptions?.signal)
    console.log('find otherSource', otherSource)
    if (!otherSource.length) throw err
    try {
      return await getOnlineOtherSourceMusicUrl({
        musicInfos: [...otherSource],
        onToggleSource,
        quality: targetQuality,
        isRefresh,
        retryedMusic: [createMusicCandidateKey(musicInfo)],
        requestOptions,
      })
    } catch (fallbackError: any) {
      if (err.message == requestMsg.tooManyRequests && fallbackError.message != requestMsg.tooManyRequests) throw err
      throw fallbackError
    }
  }
}


export const getOnlineOtherSourcePicUrl = async({ musicInfos, onToggleSource, isRefresh, retryedSource = [] }: {
  musicInfos: LX.Music.MusicInfoOnline[]
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  isRefresh: boolean
  retryedSource?: LX.OnlineSource[]
}): Promise<{
  url: string
  musicInfo: LX.Music.MusicInfoOnline
  isFromCache: boolean
}> => {
  let musicInfo: LX.Music.MusicInfoOnline | null = null
  // eslint-disable-next-line no-cond-assign
  while (musicInfo = (musicInfos.shift()!)) {
    if (retryedSource.includes(musicInfo.source)) continue
    retryedSource.push(musicInfo.source)
    // if (!assertApiSupport(musicInfo.source)) continue
    console.log('try toggle to: ', musicInfo.source, musicInfo.name, musicInfo.singer, musicInfo.interval)
    onToggleSource(musicInfo)
    break
  }
  if (!musicInfo) throw new Error(window.i18n.t('toggle_source_failed'))

  if (musicInfo.meta.picUrl && !isRefresh) return { musicInfo, url: musicInfo.meta.picUrl, isFromCache: true }

  let reqPromise
  try {
    reqPromise = musicSdk[musicInfo.source].getPic(toOldMusicInfo(musicInfo))
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }
  // retryedSource.includes(musicInfo.source)
  return reqPromise.then((url: string) => {
    return { musicInfo, url, isFromCache: false }
    // eslint-disable-next-line @typescript-eslint/promise-function-async
  }).catch((err: any) => {
    console.log(err)
    return getOnlineOtherSourcePicUrl({ musicInfos, onToggleSource, isRefresh, retryedSource })
  })
}

/**
 * 获取在线歌曲封面
 */
export const handleGetOnlinePicUrl = async({ musicInfo, isRefresh, onToggleSource, allowToggleSource }: {
  musicInfo: LX.Music.MusicInfoOnline
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  isRefresh: boolean
  allowToggleSource: boolean
}): Promise<{
  url: string
  musicInfo: LX.Music.MusicInfoOnline
  isFromCache: boolean
}> => {
  // console.log(musicInfo.source)
  let reqPromise
  try {
    reqPromise = musicSdk[musicInfo.source].getPic(toOldMusicInfo(musicInfo))
  } catch (err) {
    reqPromise = Promise.reject(err)
  }
  return reqPromise.then((url: string) => {
    return { musicInfo, url, isFromCache: false }
  }).catch(async(err: any) => {
    console.log(err)
    if (!allowToggleSource) throw err
    onToggleSource()
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    return getOtherSource(musicInfo).then(otherSource => {
      console.log('find otherSource', otherSource)
      if (otherSource.length) {
        return getOnlineOtherSourcePicUrl({
          musicInfos: [...otherSource],
          onToggleSource,
          isRefresh,
          retryedSource: [musicInfo.source],
        })
      }
      throw err
    })
  })
}


export const getOnlineOtherSourceLyricInfo = async({ musicInfos, onToggleSource, isRefresh, retryedSource = [] }: {
  musicInfos: LX.Music.MusicInfoOnline[]
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  isRefresh: boolean
  retryedSource?: LX.OnlineSource[]
}): Promise<{
  lyricInfo: LX.Music.LyricInfo | LX.Player.LyricInfo
  musicInfo: LX.Music.MusicInfoOnline
  isFromCache: boolean
}> => {
  let musicInfo: LX.Music.MusicInfoOnline | null = null
  // eslint-disable-next-line no-cond-assign
  while (musicInfo = (musicInfos.shift()!)) {
    if (retryedSource.includes(musicInfo.source)) continue
    retryedSource.push(musicInfo.source)
    // if (!assertApiSupport(musicInfo.source)) continue
    console.log('try toggle to: ', musicInfo.source, musicInfo.name, musicInfo.singer, musicInfo.interval)
    onToggleSource(musicInfo)
    break
  }
  if (!musicInfo) throw new Error(window.i18n.t('toggle_source_failed'))

  if (!isRefresh) {
    const lyricInfo = await getCachedLyricInfo(musicInfo)
    if (lyricInfo) return { musicInfo, lyricInfo, isFromCache: true }
  }

  let reqPromise
  try {
    // TODO: remove any type
    reqPromise = (musicSdk[musicInfo.source].getLyric(toOldMusicInfo(musicInfo)) as any).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }
  // retryedSource.includes(musicInfo.source)
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  return reqPromise.then((lyricInfo: LX.Music.LyricInfo) => {
    return existTimeExp.test(lyricInfo.lyric) ? {
      lyricInfo,
      musicInfo,
      isFromCache: false,
    } : Promise.reject(new Error('failed'))
    // eslint-disable-next-line @typescript-eslint/promise-function-async
  }).catch((err: any) => {
    console.log(err)
    return getOnlineOtherSourceLyricInfo({ musicInfos, onToggleSource, isRefresh, retryedSource })
  })
}

/**
 * 获取在线歌词信息
 */
export const handleGetOnlineLyricInfo = async({ musicInfo, onToggleSource, isRefresh, allowToggleSource }: {
  musicInfo: LX.Music.MusicInfoOnline
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  isRefresh: boolean
  allowToggleSource: boolean
}): Promise<{
  musicInfo: LX.Music.MusicInfoOnline
  lyricInfo: LX.Music.LyricInfo | LX.Player.LyricInfo
  isFromCache: boolean
}> => {
  // console.log(musicInfo.source)
  let reqPromise
  try {
    // TODO: remove any type
    reqPromise = (musicSdk[musicInfo.source].getLyric(toOldMusicInfo(musicInfo)) as any).promise
  } catch (err) {
    reqPromise = Promise.reject(err)
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  return reqPromise.then((lyricInfo: LX.Music.LyricInfo) => {
    return existTimeExp.test(lyricInfo.lyric) ? {
      musicInfo,
      lyricInfo,
      isFromCache: false,
    } : Promise.reject(new Error('failed'))
  }).catch(async(err: any) => {
    console.log(err)
    if (!allowToggleSource) throw err

    onToggleSource()
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    return getOtherSource(musicInfo).then(otherSource => {
      console.log('find otherSource', otherSource)
      if (otherSource.length) {
        return getOnlineOtherSourceLyricInfo({
          musicInfos: [...otherSource],
          onToggleSource,
          isRefresh,
          retryedSource: [musicInfo.source],
        })
      }
      throw err
    })
  })
}
