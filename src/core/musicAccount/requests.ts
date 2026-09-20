import { buildCookieHeader, getProviderCookies, getQQCredentials, isNeteaseLoginCookieValid, isQQLoginCookieValid } from './cookies'
import { weapi } from '@/utils/musicSdk/wy/utils/crypto'
import type { MusicAccountProvider } from './types'

export interface AccountSession {
  provider: MusicAccountProvider
  cookies: Record<string, string>
}
type Row = Record<string, any>
export const fail = (reason = 'unavailable'): never => { throw new Error(reason) }
export const checkCode = (code: unknown, success: number) => {
  if (code == null || Number(code) == success) return
  fail([301, 401, 403, 1000, 104400, 104401].includes(Number(code)) ? 'login_required' : 'unavailable')
}
export const openAccountSession = async(provider: MusicAccountProvider): Promise<AccountSession> => {
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
    if (before.uin != after.uin || before.authst != after.authst) fail('account_changed')
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
  try {
    const response = await fetch(url, {
      ...init,
      credentials: 'omit',
      headers: { ...init.headers, Cookie: buildCookieHeader(cookies) },
      signal: controller.signal,
    })
    if (!response.ok) fail(response.status == 401 || response.status == 403 ? 'login_required' : 'unavailable')
    return await response.json()
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}
export const qqRequest = async(session: AccountSession, calls: Row, signal?: AbortSignal, ct = 24) => {
  const { uin, authst } = getQQCredentials(session.cookies)
  const result = await request('https://u.y.qq.com/cgi-bin/musicu.fcg', session.cookies, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=UTF-8', Referer: 'https://y.qq.com/', Origin: 'https://y.qq.com' },
    body: JSON.stringify({ comm: { uin, authst, ct, cv: 0, format: 'json' }, ...calls }),
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
  checkCode(result.code, 200)
  return result
}
