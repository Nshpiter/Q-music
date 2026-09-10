import { httpFetch } from '@/utils/request'
import { weapi } from '@/utils/musicSdk/wy/utils/crypto'
import { getProviderCookies, isQQLoginCookieValid, isNeteaseLoginCookieValid, buildCookieHeader } from '@/core/musicAccount/cookies'

const officialUrlCache = new Map<string, { url: string, quality: LX.Quality, expiresAt: number }>()

const getQualityFallbacks = (quality: LX.Quality): LX.Quality[] => {
  switch (quality) {
    case 'flac24bit': return ['flac24bit', 'flac', '320k', '128k']
    case 'flac': return ['flac', '320k', '128k']
    case '320k': return ['320k', '128k']
    default: return ['128k']
  }
}

const qqQualityFile = {
  flac24bit: { prefix: 'RS01', extension: '.flac' },
  flac: { prefix: 'F000', extension: '.flac' },
  '320k': { prefix: 'M800', extension: '.mp3' },
  '128k': { prefix: 'M500', extension: '.mp3' },
} as const

const getQQMusicUrl = async(musicInfo: LX.Music.MusicInfo_tx, quality: LX.Quality) => {
  const songId = String(musicInfo.meta.songId ?? '')
  const mediaId = String(musicInfo.meta.strMediaMid || songId)
  const candidates = getQualityFallbacks(quality)
    .filter((item): item is keyof typeof qqQualityFile => item in qqQualityFile)
    .map(item => ({ quality: item, filename: `${qqQualityFile[item].prefix}${mediaId}${qqQualityFile[item].extension}` }))
  if (!songId || !mediaId || !candidates.length) return null

  // 登录态优先（qm_keyst 即 authst 凭证，可解锁高音质与会员曲目），失败回落游客态
  let credential: { uin: string, authst: string } | null = null
  try {
    const cookies = await getProviderCookies('tx')
    if (isQQLoginCookieValid(cookies)) credential = { uin: cookies.uin, authst: cookies.qm_keyst }
  } catch {}

  const request = httpFetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    method: 'post',
    headers: {
      Referer: 'https://y.qq.com/',
      Origin: 'https://y.qq.com',
      ...(credential ? { Cookie: buildCookieHeader(await getProviderCookies('tx')) } : {}),
    },
    body: {
      comm: credential
        ? { uin: credential.uin, format: 'json', ct: 24, cv: 0, authst: credential.authst }
        : { uin: '0', format: 'json', ct: 24, cv: 0 },
      url: {
        module: 'vkey.GetVkeyServer',
        method: 'CgiGetVkey',
        param: {
          guid: String(Math.floor(Math.random() * 9_000_000_000) + 1_000_000_000),
          songmid: candidates.map(() => songId),
          songtype: candidates.map(() => 0),
          filename: candidates.map(item => item.filename),
          loginflag: credential ? 1 : 0,
          platform: '20',
        },
      },
    },
  })
  const { body } = await request.promise
  if (body?.url?.code != null && body.url.code != 0) return null
  const sip = body?.url?.data?.sip?.find(Boolean) ?? ''
  const urlInfos: Array<{ filename?: string, purl?: string }> = body?.url?.data?.midurlinfo ?? []
  for (const candidate of candidates) {
    const info = urlInfos.find(item => item.filename == candidate.filename)
    if (!info?.purl) continue
    return {
      url: /^https?:\/\//i.test(info.purl) ? info.purl : `${sip}${info.purl}`,
      quality: candidate.quality as LX.Quality,
    }
  }
  // 登录态请求未取到时回落游客态再试一次
  if (credential) {
    const fallback = await getQQMusicUrlGuest(musicInfo, quality)
    if (fallback) return fallback
  }
  return null
}

const getQQMusicUrlGuest = async(musicInfo: LX.Music.MusicInfo_tx, quality: LX.Quality) => {
  const songId = String(musicInfo.meta.songId ?? '')
  const mediaId = String(musicInfo.meta.strMediaMid || songId)
  const candidates = getQualityFallbacks(quality)
    .filter((item): item is keyof typeof qqQualityFile => item in qqQualityFile)
    .map(item => ({ quality: item, filename: `${qqQualityFile[item].prefix}${mediaId}${qqQualityFile[item].extension}` }))
  if (!songId || !mediaId || !candidates.length) return null

  const request = httpFetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    method: 'post',
    headers: {
      Referer: 'https://y.qq.com/',
      Origin: 'https://y.qq.com',
    },
    body: {
      comm: { uin: '0', format: 'json', ct: 24, cv: 0 },
      url: {
        module: 'vkey.GetVkeyServer',
        method: 'CgiGetVkey',
        param: {
          guid: String(Math.floor(Math.random() * 9_000_000_000) + 1_000_000_000),
          songmid: candidates.map(() => songId),
          songtype: candidates.map(() => 0),
          filename: candidates.map(item => item.filename),
          loginflag: 0,
          platform: '20',
        },
      },
    },
  })
  const { body } = await request.promise
  if (body?.url?.code != null && body.url.code != 0) return null
  const sip = body?.url?.data?.sip?.find(Boolean) ?? ''
  const urlInfos: Array<{ filename?: string, purl?: string }> = body?.url?.data?.midurlinfo ?? []
  for (const candidate of candidates) {
    const info = urlInfos.find(item => item.filename == candidate.filename)
    if (!info?.purl) continue
    return {
      url: /^https?:\/\//i.test(info.purl) ? info.purl : `${sip}${info.purl}`,
      quality: candidate.quality as LX.Quality,
    }
  }
  return null
}

const neteaseQualityLevel = {
  flac24bit: 'hires',
  flac: 'lossless',
  '320k': 'exhigh',
  '128k': 'standard',
} as const

const getNeteaseMusicUrl = async(musicInfo: LX.Music.MusicInfo_online_common, quality: LX.Quality) => {
  const songId = String(musicInfo.meta.songId ?? '')
  if (!/^\d+$/.test(songId)) return null
  const candidates = getQualityFallbacks(quality)
    .filter((item): item is keyof typeof neteaseQualityLevel => item in neteaseQualityLevel)

  // 登录态（MUSIC_U）可解锁 VIP 曲目与高音质；读取失败按游客态处理
  let cookieHeader: string | null = null
  try {
    const cookies = await getProviderCookies('wy')
    if (isNeteaseLoginCookieValid(cookies)) cookieHeader = buildCookieHeader(cookies)
  } catch {}

  for (const candidate of candidates) {
    const request = httpFetch('https://music.163.com/weapi/song/enhance/player/url/v1', {
      method: 'post',
      headers: {
        Referer: `https://music.163.com/song?id=${songId}`,
        Origin: 'https://music.163.com',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      form: weapi({
        ids: JSON.stringify([Number(songId)]),
        level: neteaseQualityLevel[candidate],
        encodeType: 'flac',
      }),
    })
    const { body } = await request.promise
    const item = body?.data?.[0]
    if (body?.code == 200 && item?.code == 200 && item.url) {
      return { url: item.url as string, quality: candidate as LX.Quality }
    }
  }
  return null
}

export const getOfficialMusicUrl = async(musicInfo: LX.Music.MusicInfoOnline, quality: LX.Quality, refresh = false) => {
  if (musicInfo.source != 'tx' && musicInfo.source != 'wy') return null
  const cacheKey = `${musicInfo.id}:${quality}`
  const cached = officialUrlCache.get(cacheKey)
  if (!refresh && cached && cached.expiresAt > Date.now()) return { url: cached.url, quality: cached.quality }

  try {
    const result = musicInfo.source == 'tx'
      ? await getQQMusicUrl(musicInfo, quality)
      : await getNeteaseMusicUrl(musicInfo, quality)
    if (!result) return null
    officialUrlCache.set(cacheKey, { ...result, expiresAt: Date.now() + 5 * 60_000 })
    return result
  } catch (error) {
    console.warn(`[officialMusicUrl] ${musicInfo.source} unavailable`, error)
    return null
  }
}
