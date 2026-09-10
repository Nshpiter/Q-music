import { NativeModules } from 'react-native'
import type { MusicAccountProvider } from './types'

const { UtilsModule } = NativeModules

const COOKIE_URLS: Record<MusicAccountProvider, string[]> = {
  tx: ['https://y.qq.com', 'https://u.y.qq.com'],
  wy: ['https://music.163.com'],
}

/** 从 "k1=v1; k2=v2" 形式的 cookie 字符串解析出键值对 */
const parseCookieString = (raw: string | null | undefined): Record<string, string> => {
  if (!raw) return {}
  const cookies: Record<string, string> = {}
  for (const pair of raw.split(';')) {
    const eqIndex = pair.indexOf('=')
    if (eqIndex < 0) continue
    const name = pair.slice(0, eqIndex).trim()
    const value = pair.slice(eqIndex + 1).trim()
    if (name) cookies[name] = value
  }
  return cookies
}

export const getProviderCookies = async(provider: MusicAccountProvider): Promise<Record<string, string>> => {
  const cookies: Record<string, string> = {}
  for (const url of COOKIE_URLS[provider]) {
    // Android WebView CookieManager 为全局存储，原生层读取，多个 URL 合并去重
    const raw: string | null = await UtilsModule.getWebCookie(url)
    Object.assign(cookies, parseCookieString(raw))
  }
  return cookies
}

export const buildCookieHeader = (cookies: Record<string, string>): string => {
  return Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join('; ')
}

/** QQ：uin（账号）+ qm_keyst（凭证）存在视为已登录 */
export const isQQLoginCookieValid = (cookies: Record<string, string>): boolean => {
  return Boolean(cookies.uin && cookies.qm_keyst)
}

/** 网易：MUSIC_U 存在视为已登录 */
export const isNeteaseLoginCookieValid = (cookies: Record<string, string>): boolean => {
  return Boolean(cookies.MUSIC_U)
}

export const clearProviderCookies = async(provider: MusicAccountProvider) => {
  for (const url of COOKIE_URLS[provider]) {
    await UtilsModule.clearWebCookie(url)
  }
}
