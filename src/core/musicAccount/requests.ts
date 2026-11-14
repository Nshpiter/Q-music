import { buildCookieHeader, getProviderCookies, getQQCredentials, isNeteaseLoginCookieValid, isQQLoginCookieValid } from './cookies'
import { eapi, weapi } from '@/utils/musicSdk/wy/utils/crypto'
import type { MusicAccountProvider } from './types'
import { getQQRequestComm } from './qqCredentials'

export interface AccountSession {
  provider: MusicAccountProvider
  cookies: Record<string, string>
}
type Row = Record<string, any>
// 网易云风控/频率限制：-460 异常访问、-462 需要验证、405 操作频繁、-447 服务繁忙。
export const neteaseRestrictedCodes = new Set([-460, -462, 405, -447])
export const fail = (reason = 'unavailable'): never => { throw new Error(reason) }
export const checkCode = (code: unknown, success: number) => {
  if (code == null || Number(code) == success) return
  throw Object.assign(new Error([301, 401, 403, 1000, 104400, 104401].includes(Number(code)) ? 'login_required' : 'unavailable'), { platformCode: Number(code) })
}
export const openAccountSession = async(provider: MusicAccountProvider): Promise<AccountSession> => {
  if (provider == 'kg') fail('unavailable')
  const cookies = await getProviderCookies(provider)
  if (!(provider == 'tx' ? isQQLoginCookieValid(cookies) : isNeteaseLoginCookieValid(cookies))) fail('login_required')
  return { provider, cookies }
}
export const assertAccountSession = async(session: AccountSession) => {
  const current = await getProviderCookies(session.provider)
  if (session.provider == 'wy') {
    if (!current.MUSIC_U || current.MUSIC_U != session.cookies.MUSIC_U) fail('account_changed')
  } else {
    const before = getQQCredentials(session.cookies)
    const after = getQQCredentials(current)
    if (before.uin != after.uin || before.authst != after.authst || before.tmeLoginType != after.tmeLoginType) fail('account_changed')
  }
}

// 凭证只发给各平台官方 HTTPS 域名，不写入日志或备份。
export const request = async(url: string, cookies: Record<string, string>, init: RequestInit, signal?: AbortSignal): Promise<Row> => {
  if (!/^https:\/\/(?:[a-z0-9-]+\.)*(?:qq\.com|music\.163\.com)\//i.test(url)) fail('invalid_host')
  const controller = new AbortController()
  const abort = () => { controller.abort() }
  signal?.addEventListener('abort', abort)
  if (signal?.aborted) abort()
  const timer = setTimeout(abort, 15_000)
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      credentials: 'omit',
      headers: { ...init.headers, Cookie: buildCookieHeader(cookies) },
      signal: controller.signal,
    })
  } catch (error) {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
    if (signal?.aborted) fail('cancelled')
    // 超时或连接失败与平台拒绝分开提示。
    if (controller.signal.aborted || error instanceof TypeError) fail('network')
    throw error
  }
  try {
    if (!response.ok) throw Object.assign(new Error(response.status == 401 ? 'login_required' : response.status == 429 ? 'restricted' : 'unavailable'), { platformCode: response.status })
    return await response.json()
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}
export const qqRequest = async(session: AccountSession, calls: Row, signal?: AbortSignal, ct = 24) => {
  const result = await request('https://u.y.qq.com/cgi-bin/musicu.fcg', session.cookies, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=UTF-8', Referer: 'https://y.qq.com/', Origin: 'https://y.qq.com' },
    body: JSON.stringify({ comm: getQQRequestComm(session.cookies, ct), ...calls }),
  }, signal)
  checkCode(result.code, 0)
  for (const key of Object.keys(calls)) {
    checkCode(result[key]?.code, 0)
    if (!result[key]?.data) fail()
  }
  return result
}
export const wyRequest = async(session: AccountSession, path: string, data: Row, signal?: AbortSignal) => {
  const csrf = session.cookies.__csrf ?? ''
  const form = weapi({ ...data, csrf_token: csrf })
  const result = await request(`https://music.163.com/weapi/${path}?csrf_token=${encodeURIComponent(csrf)}`, session.cookies, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: 'https://music.163.com/', Origin: 'https://music.163.com' },
    body: new URLSearchParams(form).toString(),
  }, signal)
  if (result.code == null) fail()
  // 网易云 403 也可能是访问限制；只有明确未登录才要求重新授权。
  if (Number(result.code) == 403) fail('unavailable')
  if (neteaseRestrictedCodes.has(Number(result.code))) throw Object.assign(new Error('restricted'), { platformCode: Number(result.code) })
  checkCode(result.code, 200)
  return result
}

let playbackDeviceId = ''
const randomDigits = (length: number) => Array.from({ length }, () => Math.floor(Math.random() * 10)).join('')
// 播放日志只有 clientlog 域名的 eapi 且声明 osx 客户端时才会入库；weapi 返回 200 但会被静默丢弃。
export const wyClientLogRequest = async(session: AccountSession, log: Row, signal?: AbortSignal) => {
  const path = '/api/feedback/weblog'
  playbackDeviceId ||= session.cookies.deviceId || session.cookies._ntes_nuid || Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  const header: Record<string, string> = {
    osver: '15.5',
    deviceId: playbackDeviceId,
    os: 'osx',
    appver: '3.1.10.5100',
    versioncode: '140',
    mobilename: '',
    buildver: String(Math.floor(Date.now() / 1000)),
    resolution: '1920x1080',
    __csrf: session.cookies.__csrf ?? '',
    channel: 'netease',
    requestId: `${Date.now()}_${randomDigits(4)}`,
    MUSIC_U: session.cookies.MUSIC_U ?? '',
  }
  if (session.cookies.NMTID) header.NMTID = session.cookies.NMTID
  const result = await request('https://clientlog.music.163.com/eapi/feedback/weblog', header, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8', Referer: 'https://music.163.com/', Origin: 'https://music.163.com' },
    body: new URLSearchParams(eapi(path, { logs: JSON.stringify([log]), e_r: false, header })).toString(),
  }, signal)
  if (result.code == null) fail()
  checkCode(result.code, 200)
  return result
}
