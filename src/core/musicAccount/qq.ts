import { buildCookieHeader, getProviderCookies, isQQLoginCookieValid } from './cookies'

/** 音质降级顺序（官方线路仅支持此四档），对齐桌面端 getQualityFallbacks */
const QQ_QUALITY_FALLBACKS: LX.Quality[] = ['flac24bit', 'flac', '320k', '128k']

const qqQualityFile = {
  flac24bit: { prefix: 'RS01', extension: '.flac' },
  flac: { prefix: 'F000', extension: '.flac' },
  '320k': { prefix: 'M800', extension: '.mp3' },
  '128k': { prefix: 'M500', extension: '.mp3' },
} as const

const REQUEST_TIMEOUT = 10_000

/** 带超时的 AbortController（Hermes 无 AbortSignal.timeout） */
const createTimeoutSignal = () => {
  const controller = new AbortController()
  const timer = setTimeout(() => { controller.abort() }, REQUEST_TIMEOUT)
  return { signal: controller.signal, cleanup: () => { clearTimeout(timer) } }
}

const requestQQMusicU = async<T extends object>(requests: Record<string, unknown>): Promise<T> => {
  const cookies = await getProviderCookies('tx')
  if (!isQQLoginCookieValid(cookies)) throw new Error('login_required')

  // qm_keyst 即登录态凭证 authst
  const body = {
    comm: { uin: cookies.uin, format: 'json', ct: 24, cv: 0, authst: cookies.qm_keyst },
    ...requests,
  }
  const { signal, cleanup } = createTimeoutSignal()
  try {
    const response = await fetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        Origin: 'https://y.qq.com',
        Referer: 'https://y.qq.com/',
        Cookie: buildCookieHeader(cookies),
      },
      body: JSON.stringify(body),
      signal,
    })
    if (!response.ok) throw new Error(response.status == 401 || response.status == 403 ? 'login_required' : `QQ request failed: ${response.status}`)
    const result = await response.json() as T & { code?: number }
    if (result.code != null && result.code != 0) throw new Error(`QQ request failed: ${result.code}`)
    return result
  } finally {
    cleanup()
  }
}

const getQualityFallbacks = (quality: LX.Quality): LX.Quality[] => {
  const index = QQ_QUALITY_FALLBACKS.indexOf(quality)
  return index < 0 ? ['128k'] : QQ_QUALITY_FALLBACKS.slice(index)
}

/**
 * QQ 音乐官方线路取 URL（vkey.GetVkeyServer）。
 * songId：歌曲数字 id；mediaId：文件的 media mid（strMediaMid）
 */
export const getQQOfficialMusicUrl = async(songId: string, mediaId: string, quality: LX.Quality): Promise<{ url: string, quality: LX.Quality } | null> => {
  if (!songId || !mediaId) return null
  const candidates = getQualityFallbacks(quality)
    .filter((item): item is keyof typeof qqQualityFile => item in qqQualityFile)
    .map(item => ({ quality: item, filename: `${qqQualityFile[item].prefix}${mediaId}${qqQualityFile[item].extension}` }))
  if (!candidates.length) return null

  const result = await requestQQMusicU<{
    url?: {
      code?: number
      data?: {
        sip?: string[]
        midurlinfo?: Array<{ filename?: string, purl?: string }>
      }
    }
  }>({
    url: {
      module: 'vkey.GetVkeyServer',
      method: 'CgiGetVkey',
      param: {
        guid: String(Math.floor(Math.random() * 9_000_000_000) + 1_000_000_000),
        songmid: candidates.map(() => songId),
        songtype: candidates.map(() => 0),
        filename: candidates.map(item => item.filename),
        loginflag: 1,
        platform: '20',
      },
    },
  })

  const urlResult = result.url
  if (urlResult?.code != null && urlResult.code != 0) return null
  const sip = urlResult?.data?.sip?.find(Boolean) ?? ''
  const urlInfos = urlResult?.data?.midurlinfo ?? []
  for (const candidate of candidates) {
    const info = urlInfos.find(item => item.filename == candidate.filename)
    if (!info?.purl) continue
    const url = /^https?:\/\//i.test(info.purl) ? info.purl : `${sip}${info.purl}`
    if (url) return { url, quality: candidate.quality as LX.Quality }
  }
  return null
}

export const hasQQLoginCookie = async(): Promise<boolean> => {
  const cookies = await getProviderCookies('tx')
  return isQQLoginCookieValid(cookies)
}
