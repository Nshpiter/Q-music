import { clearOfficialUrlCache, getOfficialUrlCache, setOfficialUrlCache } from './cache'
import { getQQOfficialMusicUrl, hasQQLoginCookie } from './qq'
import { getNeteaseOfficialMusicUrl, hasNeteaseLoginCookie } from './netease'
import type { MusicAccountProvider, MusicAccountUrlResult } from './types'

export type { MusicAccountProvider, MusicAccountConnectionState, MusicAccountUrlResult } from './types'
export { clearProviderCookies } from './cookies'

export const isMusicAccountConnected = async(provider: MusicAccountProvider): Promise<boolean> => {
  // 原生桥或 CookieManager 异常时一律按未登录处理，绝不向上抛
  try {
    return provider == 'tx' ? await hasQQLoginCookie() : await hasNeteaseLoginCookie()
  } catch (err) {
    console.warn('[musicAccount] cookie check failed', err)
    return false
  }
}

export const logoutMusicAccount = async(provider: MusicAccountProvider) => {
  const { clearProviderCookies } = await import('./cookies')
  await clearProviderCookies(provider)
  clearOfficialUrlCache()
}

const getOfficialQualityFallbacks = (quality: LX.Quality): LX.Quality[] => {
  const officialQualitys: LX.Quality[] = ['flac24bit', 'flac', '320k', '128k']
  const index = officialQualitys.indexOf(quality)
  return index < 0 ? ['128k'] : officialQualitys.slice(index)
}

/**
 * 官方账号线路取 URL（带 5 分钟短时缓存与音质降级），
 * 语义对齐桌面端 getMusicAccountMusicUrl。
 */
export const getMusicAccountMusicUrl = async(
  provider: MusicAccountProvider,
  songId: string,
  mediaId: string,
  quality: LX.Quality,
  isRefresh = false,
): Promise<MusicAccountUrlResult> => {
  const unavailable = (status: MusicAccountUrlResult['status']): MusicAccountUrlResult => ({
    provider,
    status,
    url: '',
    quality,
  })

  if (!await isMusicAccountConnected(provider)) return unavailable('login_required')

  const cached = getOfficialUrlCache(provider, songId, mediaId, quality)
  if (cached && !isRefresh) {
    return { provider, status: 'available', url: cached.url, quality: cached.quality }
  }

  try {
    const result = provider == 'tx'
      ? await getQQOfficialMusicUrl(songId, mediaId, quality)
      : await getNeteaseOfficialMusicUrl(songId, quality)
    if (!result) return unavailable('unavailable')
    setOfficialUrlCache(provider, songId, mediaId, quality, result.url, result.quality)
    return { provider, status: 'available', url: result.url, quality: result.quality }
  } catch (err: any) {
    console.warn('[musicAccount] official url unavailable', err?.message)
    return unavailable(err?.message == 'login_required' ? 'login_required' : 'error')
  }
}

export { getOfficialQualityFallbacks }
