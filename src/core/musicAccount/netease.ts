import { buildCookieHeader, getProviderCookies, isNeteaseLoginCookieValid } from './cookies'

const NETEASE_QUALITY_FALLBACKS: LX.Quality[] = ['flac24bit', 'flac', '320k', '128k']

/** 老版 /api 接口的音质码（br）：hires 适配用 999000 上限由服务端裁定 */
const qualityBr = (quality: LX.Quality): number => {
  switch (quality) {
    case 'flac24bit': return 999_000
    case 'flac': return 999_000
    case '320k': return 320_000
    default: return 128_000
  }
}

const qualityLevel = {
  flac24bit: 'hires',
  flac: 'lossless',
  '320k': 'exhigh',
  '128k': 'standard',
} as const

const REQUEST_TIMEOUT = 10_000

/** 带超时的 AbortController（Hermes 无 AbortSignal.timeout） */
const createTimeoutSignal = () => {
  const controller = new AbortController()
  const timer = setTimeout(() => { controller.abort() }, REQUEST_TIMEOUT)
  return { signal: controller.signal, cleanup: () => { clearTimeout(timer) } }
}

const parseQualityFromBr = (br: number | undefined, fallback: LX.Quality): LX.Quality => {
  if (br == null) return fallback
  if (br >= 999_000) return 'flac24bit'
  if (br >= 320_000) return '320k'
  return '128k'
}

/**
 * 网易云音乐官方线路取 URL。
 * 使用老版 /api 接口（song/enhance/player/url）避免 weapi 加密依赖，
 * 登录态由 MUSIC_U cookie 提供。
 */
export const getNeteaseOfficialMusicUrl = async(songId: string, quality: LX.Quality): Promise<{ url: string, quality: LX.Quality } | null> => {
  if (!/^\d+$/.test(songId)) return null
  const cookies = await getProviderCookies('wy')
  if (!isNeteaseLoginCookieValid(cookies)) throw new Error('login_required')

  const candidates = NETEASE_QUALITY_FALLBACKS.slice(NETEASE_QUALITY_FALLBACKS.indexOf(quality))
    .filter(item => item in qualityLevel)
  for (const candidate of candidates) {
    const params = new URLSearchParams({
      ids: JSON.stringify([Number(songId)]),
      br: String(qualityBr(candidate)),
    })
    const { signal, cleanup } = createTimeoutSignal()
    try {
      const response = await fetch('https://music.163.com/api/song/enhance/player/url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: 'https://music.163.com/',
          Cookie: buildCookieHeader(cookies),
        },
        body: params.toString(),
        signal,
      })
      if (!response.ok) continue
      const result = await response.json() as {
        code?: number
        data?: Array<{ url?: string | null, code?: number, br?: number }>
      }
      const item = result.data?.[0]
      if (result.code == 200 && item?.code == 200 && item.url) {
        return { url: item.url, quality: parseQualityFromBr(item.br, candidate) }
      }
    } finally {
      cleanup()
    }
  }
  return null
}

export const hasNeteaseLoginCookie = async(): Promise<boolean> => {
  const cookies = await getProviderCookies('wy')
  return isNeteaseLoginCookieValid(cookies)
}
