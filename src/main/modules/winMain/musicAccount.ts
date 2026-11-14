import { neteasePlaybackQuality } from '@common/utils/playbackPolicy'
import { accountFailureKind, neteaseRestrictedCodes, type AccountFailureKind } from '@common/utils/accountFailure'
import { BrowserWindow, safeStorage, session, shell, type Session, type WebContents } from 'electron'
import { getProxy } from '@main/utils'
import { setWindowNavigationPolicy } from '@main/utils/navigationPolicy'
import getStore from '@main/utils/store'
import { constants, createCipheriv, createHash, publicEncrypt, randomBytes } from 'node:crypto'
import { getQQCredentials, getQQRequestComm, getQQWebRequestComm } from '@common/utils/qqCredentials'
import { signQQRequest } from '@common/utils/qqSign'
import { getQQAccountCatalog } from '@common/utils/qqAccountCatalog'
import { collectQQPlaylistIds } from '@common/utils/qqPlaylist'
import { type QQFavoriteRequest, type QQFavoriteResult } from '@common/types/qqFavorite'
import { isQQPlaylistId, resolveQQPlaylistTarget, checkQQPlaylistSong, getQQPlaylistTargets, resolveQQPlaylistReadTarget, getQQPlaylistReadPage } from '@common/utils/qqPlaylistTarget'
import { createNeteaseFavoriteClient } from '@common/utils/neteaseFavorite'
import { closeOfficialAccountLogin, openOfficialAccountLogin } from './officialAccountLogin'
import { allowAccountLoginNavigation, upgradeAccountLoginNavigation } from './accountLoginNavigation'
import { fitAccountLoginWindow, getAccountLoginBounds } from './accountLoginLayout'
import { getKugouDailyHashes, getKugouPlaylistHashes, getKugouPlaylists, logoutKugou, openKugouLogin, readKugouSession, saveKugouSession } from './kugouAccount'
import { parseSnapshotAccounts, type CloudSnapshot } from '@common/utils/cloudSnapshot'

export type MusicAccountProvider = 'tx' | 'wy' | 'kg'

// 仅在用户勾选账号备份后调用；不导出 QQ/微信通用站点 Cookie。
export const exportSnapshotAccounts = async(): Promise<NonNullable<CloudSnapshot['accounts']>> => {
  const result: NonNullable<CloudSnapshot['accounts']> = {}
  const { uin, authst, isWeChat } = await getQQAccountCredentials()
  if (uin && authst) result.tx = { qqmusic_uin: uin, qqmusic_key: authst, musicid: uin, musickey: authst, login_type: isWeChat ? '2' : '1', ...(isWeChat ? { wxuin: uin } : { uin }) }
  const wy = Object.fromEntries((await session.fromPartition(providerConfig.wy.partition).cookies.get({ url: 'https://music.163.com/' })).filter(cookie => ['MUSIC_U', '__csrf'].includes(cookie.name)).map(cookie => [cookie.name, cookie.value]))
  if (wy.MUSIC_U) result.wy = wy
  const kg = readKugouSession()
  if (kg) result.kg = { ...kg }
  return parseSnapshotAccounts(result)
}

export const restoreSnapshotAccounts = async(value: NonNullable<CloudSnapshot['accounts']>) => {
  const accounts = parseSnapshotAccounts(value)
  for (const provider of ['tx', 'wy', 'kg'] as const) {
    const data = accounts[provider]
    if (!data) continue
    if (provider == 'kg') { saveKugouSession(data); continue }
    const store = session.fromPartition(providerConfig[provider].partition).cookies
    const urls = provider == 'tx' ? ['https://y.qq.com/', 'https://u.y.qq.com/'] : ['https://music.163.com/']
    const names = new Set(provider == 'tx' ? ['qqmusic_key', 'qm_keyst', 'musickey', 'qqmusic_uin', 'musicid', 'login_type', 'wxuin', 'uin'] : ['MUSIC_U', '__csrf'])
    for (const cookie of await store.get({})) {
      if (names.has(cookie.name) && cookie.domain) await store.remove(`https://${cookie.domain.replace(/^\./, '')}${cookie.path ?? '/'}`, cookie.name)
    }
    for (const url of urls) {
      for (const [name, content] of Object.entries(data)) await store.set({ url, name, value: content, path: '/', secure: true, httpOnly: true, expirationDate: Date.now() / 1000 + 30 * 86400 })
    }
    await store.flushStore()
  }
  accountValidationCache.clear()
  officialMusicUrlCache.clear()
}

export type MusicAccountConnectionState = 'connected' | 'expired' | 'disconnected' | 'unavailable'

export interface MusicAccountProfile {
  state: MusicAccountConnectionState
  displayName: string
  avatar: string
  accountHint: string
  hasSession: boolean
}

export interface MusicAccountStatus {
  tx: boolean
  wy: boolean
  kg: boolean
  accounts: Record<MusicAccountProvider, MusicAccountProfile>
}

export interface MusicAccountLoginResult {
  provider: MusicAccountProvider
  status: 'connected' | 'cancelled'
}

export interface MusicAccountLogoutResult {
  provider: MusicAccountProvider
  status: 'disconnected' | 'error'
}

export interface MusicAccountDailyResult {
  provider: MusicAccountProvider
  ids: string[]
  status: 'personalized' | 'login_required' | 'unavailable'
  kind?: 'official_daily' | 'radar' | 'netease_daily' | 'kugou_daily'
}

export interface QQDailyKeyStatus {
  configured: boolean
  encryptionAvailable: boolean
}

export interface QQDailyKeySaveResult extends QQDailyKeyStatus {
  status: 'saved' | 'invalid' | 'unavailable' | 'cancelled'
  songCount: number
}

export interface MusicAccountPlaylist {
  writable?: boolean
  accountId?: string
  id: string
  name: string
  cover: string
  trackCount: number
  creator: string
  kind?: 'created' | 'favorite'
}

export interface MusicAccountPlaylistsResult {
  partial?: boolean
  provider: MusicAccountProvider
  playlists: MusicAccountPlaylist[]
  status: 'available' | 'login_required' | 'unavailable' | 'verification_required' | AccountFailureKind
}

export interface MusicAccountPlaylistDetailResult {
  accountId?: string
  tracks?: Array<Record<string, any>>
  privileges?: Array<Record<string, any>>
  provider: MusicAccountProvider
  id: string
  ids: string[]
  status: 'available' | 'login_required' | 'unavailable' | 'verification_required' | 'account_changed' | 'playlist_incomplete' | AccountFailureKind
}

export interface MusicAccountMusicUrlRequest {
  provider: MusicAccountProvider
  songId: string
  mediaId?: string
  reportSongId?: string
  quality: LX.Quality
  refresh?: boolean
  allowQualityFallback?: boolean
}

export interface MusicAccountMusicUrlResult {
  provider: MusicAccountProvider
  status: 'available' | 'login_required' | 'unavailable' | 'error'
  url: string
  quality: LX.Quality
  reportSongId?: string
}

export interface MusicAccountPlaybackReportRequest {
  provider: MusicAccountProvider
  songId: string
  mediaId?: string
  sourceId?: string
  playedSeconds: number
  startedAt: number
  // start：达到有效时长时登记「最近播放」；finish：本次播放结束时按实际秒数计入听歌排行。
  phase?: 'start' | 'finish'
}

export interface MusicAccountPlaybackReportResult {
  provider: MusicAccountProvider
  status: 'reported' | 'login_required' | 'unavailable'
}

const providerConfig = {
  kg: {
    partition: 'persist:qmusic-account-kugou',
    title: '酷狗音乐账号登录',
    loginUrl: 'https://www.kugou.com/',
    domains: ['kugou.com'],
  },
  tx: {
    partition: 'persist:qmusic-account-qq',
    title: 'QQ音乐账号登录',
    loginUrl: 'https://y.qq.com/n/ryqq/profile',
    domains: ['qq.com', 'weixin.qq.com', 'weixin.com', 'qcloud.com', 'gtimg.com'],
  },
  wy: {
    partition: 'persist:qmusic-account-netease',
    title: '网易云音乐账号登录',
    loginUrl: 'https://music.163.com/#/login',
    domains: ['163.com', '126.com', 'netease.com'],
  },
} as const

const accountValidationCache = new Map<MusicAccountProvider, { connected: boolean, state: MusicAccountConnectionState, expiresAt: number }>()
const officialMusicUrlCache = new Map<string, { url: string, quality: LX.Quality, reportSongId?: string, expiresAt: number }>()
let qqPlaybackGuid = ''
let neteasePlaybackDeviceId = ''
let qqDailyKeyWindow: BrowserWindow | null = null
let qqDailyKeyTask: Promise<QQDailyKeySaveResult> | null = null
const qqDailyKeyStoreName = 'music_account_credentials'
const qqDailyKeyStoreField = 'qqDailyApiKey'
const qqDailyKeyPage = 'https://y.qq.com/n/ryqq_v2/qqmusic_skills'
const neteaseIv = Buffer.from('0102030405060708')
const neteasePresetKey = Buffer.from('0CoJUm6Qyw8W8jud')
const neteaseEapiKey = Buffer.from('e82ckenh8dichen8')
const neteaseBase62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const neteasePublicKey = '-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB\n-----END PUBLIC KEY-----'
const neteasePlaybackLogPath = '/api/feedback/weblog'
const playbackReportTimeout = 10_000

const aesEncrypt = (buffer: Buffer, key: Buffer) => {
  const cipher = createCipheriv('aes-128-cbc', key, neteaseIv)
  return Buffer.concat([cipher.update(buffer), cipher.final()])
}

const buildNeteaseWeapiForm = (data: Record<string, unknown>) => {
  const secretKey = Buffer.from(Array.from(randomBytes(16), value => neteaseBase62.charCodeAt(value % neteaseBase62.length)))
  const firstPass = aesEncrypt(Buffer.from(JSON.stringify(data)), neteasePresetKey).toString('base64')
  const params = aesEncrypt(Buffer.from(firstPass), secretKey).toString('base64')
  const reversedKey = Buffer.from(secretKey).reverse()
  const paddedKey = Buffer.concat([Buffer.alloc(128 - reversedKey.length), reversedKey])
  const encSecKey = publicEncrypt({ key: neteasePublicKey, padding: constants.RSA_NO_PADDING }, paddedKey).toString('hex')
  return new URLSearchParams({ params, encSecKey })
}

const buildNeteaseEapiForm = (path: string, data: Record<string, unknown>) => {
  const text = JSON.stringify(data)
  const digest = createHash('md5').update(`nobody${path}use${text}md5forencrypt`).digest('hex')
  const payload = `${path}-36cd479b6b5-${text}-36cd479b6b5-${digest}`
  const cipher = createCipheriv('aes-128-ecb', neteaseEapiKey, null)
  const params = Buffer.concat([cipher.update(Buffer.from(payload)), cipher.final()]).toString('hex').toUpperCase()
  return new URLSearchParams({ params })
}

const isAllowedHost = (provider: MusicAccountProvider, target: string) => {
  return allowAccountLoginNavigation(provider, target, providerConfig[provider].domains)
}

const hasLoginCookie = async(provider: MusicAccountProvider) => {
  if (provider == 'kg') return Boolean(readKugouSession())
  if (provider == 'tx') {
    const { uin, authst } = await getQQAccountCredentials()
    return Boolean(uin && authst)
  }
  const cookies = await session.fromPartition(providerConfig[provider].partition).cookies.get({})
  const names = new Set(cookies.map(cookie => cookie.name.toLowerCase()))
  return names.has('music_u') || names.has('music_a')
}

const configureAccountSessionProxy = async(provider: MusicAccountProvider) => {
  const accountSession = session.fromPartition(providerConfig[provider].partition)
  const proxy = getProxy()
  let timer: NodeJS.Timeout | undefined
  try {
    await Promise.race([
      accountSession.setProxy(proxy?.host
        ? { mode: 'fixed_servers', proxyRules: `http://${proxy.host}:${proxy.port}` }
        : { mode: 'system' }),
      new Promise<never>((resolve, reject) => { timer = setTimeout(() => { reject(new Error('Account proxy timeout')) }, 12_000) }),
    ])
  } finally { clearTimeout(timer) }
  return accountSession
}

const getQQAccountCredentials = async() => {
  const accountSession = session.fromPartition(providerConfig.tx.partition)
  const cookies = (await Promise.all(['https://u.y.qq.com/', 'https://y.qq.com/'].map(async url => accountSession.cookies.get({ url })))).flat()
  const cookieMap = Object.fromEntries(cookies.map(cookie => [cookie.name.toLowerCase(), cookie.value]))
  return {
    accountSession,
    ...getQQCredentials(cookieMap),
    cookies: cookieMap,
  }
}

const normalizeRemoteImageUrl = (value: unknown) => {
  const url = String(value ?? '').trim()
  if (!url) return ''
  return url.startsWith('//') ? `https:${url}` : url
}

const maskAccountId = (value: string) => {
  if (!value) return ''
  if (value.length <= 4) return value
  return `${'•'.repeat(Math.min(4, value.length - 4))}${value.slice(-4)}`
}

const getQQAccountProfile = async() => {
  const { accountSession, uin, isWeChat } = await getQQAccountCredentials()
  const emptyProfile = { displayName: '', avatar: '', encryptedUin: '', accountHint: uin ? `${isWeChat ? '微信' : 'QQ'} · ${maskAccountId(uin)}` : '' }
  if (!uin) return emptyProfile
  try {
    const url = new URL('https://c6.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg')
    url.search = new URLSearchParams({ ct: '20', cv: '4747474', cid: '205360838', userid: uin }).toString()
    const response = await accountSession.fetch(url.toString(), {
      credentials: 'include',
      headers: { Referer: 'https://y.qq.com/' },
      signal: AbortSignal.timeout(12_000),
    })
    if (!response.ok) return emptyProfile
    const result = await response.json() as {
      data?: {
        creator?: {
          encrypt_uin?: string
          nick?: string
          nickname?: string
          headpic?: string
          avatarUrl?: string
          avatar_url?: string
        }
      }
    }
    const creator = result.data?.creator
    return {
      displayName: String(creator?.nick ?? creator?.nickname ?? '').trim(),
      avatar: normalizeRemoteImageUrl(creator?.headpic ?? creator?.avatarUrl ?? creator?.avatar_url),
      encryptedUin: creator?.encrypt_uin ?? '',
      accountHint: emptyProfile.accountHint,
    }
  } catch {
    return emptyProfile
  }
}

const getQQEncryptedUin = async() => (await getQQAccountProfile()).encryptedUin

// 仅转移音乐服务凭据，不把 QQ 通用登录 Cookie 或其他平台账号交给手机。
export const getQQTransferPayload = async() => {
  if (!await verifyMusicAccount('tx', true)) throw new Error('login_required')
  const { uin, authst, isWeChat } = await getQQAccountCredentials()
  if (!uin || !authst) throw new Error('login_required')
  const profile = await getQQAccountProfile()
  const current = await getQQAccountCredentials()
  if (current.uin != uin || current.authst != authst) throw new Error('login_required')
  return {
    account: `${profile.displayName || 'QQ 音乐'} · ${isWeChat ? '微信' : 'QQ'} · ${maskAccountId(uin)}`,
    cookies: {
      qqmusic_key: authst,
      musickey: authst,
      qqmusic_uin: uin,
      musicid: uin,
      login_type: isWeChat ? '2' : '1',
      ...(isWeChat ? { wxuin: uin } : { uin }),
    },
  }
}

const qqMusicCredentialRejectionCodes = new Set([401, 403, 1000, 104400, 104401])

class QQMusicURequestError extends Error {
  constructor(
    public readonly reason: 'login_required' | 'unavailable',
    public readonly code?: number,
    message = 'QQ Music account request failed',
  ) {
    super(code == null ? message : `${message}: ${code}`)
    this.name = 'QQMusicURequestError'
  }
}

const parseQQMusicCode = (value: unknown): number | undefined => {
  if ((typeof value != 'number' && typeof value != 'string') || (typeof value == 'string' && !value.trim())) return undefined
  const code = Number(value)
  return Number.isFinite(code) ? code : undefined
}

const createQQMusicURequestError = (code?: number, message?: string) => {
  const reason = code != null && qqMusicCredentialRejectionCodes.has(code) ? 'login_required' : 'unavailable'
  if (reason == 'login_required') accountValidationCache.delete('tx')
  return new QQMusicURequestError(reason, code, message)
}

const isQQMusicLoginRequiredError = (error: unknown) => {
  return error instanceof QQMusicURequestError && error.reason == 'login_required'
}

const requestQQMusicU = async<T extends object>(requests: Record<string, unknown>, signal?: AbortSignal, expectedAccount?: string, web = false): Promise<T> => {
  const { accountSession, cookies } = await getQQAccountCredentials()
  if (expectedAccount && qqAccountIdentity(cookies) != expectedAccount) throw new Error('account_changed')
  const requestCookies = web
    ? Object.fromEntries((await accountSession.cookies.get({ url: 'https://u.y.qq.com/' })).map(cookie => [cookie.name.toLowerCase(), cookie.value]))
    : cookies
  if (web && expectedAccount && qqAccountIdentity(requestCookies) != expectedAccount) throw new Error('account_changed')
  const body = JSON.stringify({ comm: web ? getQQWebRequestComm(requestCookies) : getQQRequestComm(requestCookies), ...requests })
  const url = new URL(`https://u.y.qq.com/cgi-bin/${web ? 'musics' : 'musicu'}.fcg`)
  if (web) url.searchParams.set('sign', signQQRequest(body))
  const response = await accountSession.fetch(url.toString(), {
    method: 'POST',
    credentials: 'include',
    ...(web ? { cache: 'no-store' as const } : {}),
    headers: {
      // musics 不允许 application/json 的跨域预检；沿用官网旧版签名 AJAX 的简单请求类型。
      // 正文仍为参与签名的原始 JSON，不能改成 URLSearchParams 或再次序列化。
      'Content-Type': web ? 'application/x-www-form-urlencoded;charset=UTF-8' : 'application/json;charset=UTF-8',
      Origin: 'https://y.qq.com',
      Referer: 'https://y.qq.com/',
    },
    body,
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12_000)]) : AbortSignal.timeout(12_000),
  })
  if (!response.ok) {
    const error = new QQMusicURequestError(
      response.status == 401 || response.status == 403 ? 'login_required' : 'unavailable',
      response.status,
    )
    if (error.reason == 'login_required') accountValidationCache.delete('tx')
    throw error
  }

  const result = await response.json() as T & { code?: unknown }
  const globalCode = parseQQMusicCode(result.code)
  if (globalCode != 0) throw createQQMusicURequestError(globalCode, 'QQ Music global request failed')
  const resultModules = result as T & Record<string, unknown>
  for (const key of Object.keys(requests)) {
    const moduleResult = resultModules[key]
    const moduleCode = moduleResult && typeof moduleResult == 'object'
      ? parseQQMusicCode((moduleResult as { code?: unknown }).code)
      : undefined
    if (moduleCode != 0) throw createQQMusicURequestError(moduleCode, `QQ Music module ${key} failed`)
  }
  return result
}

const qqAccountIdentity = (cookies: Record<string, string>) => {
  const { uin, authst, tmeLoginType } = getQQCredentials(cookies)
  return `${tmeLoginType}:${uin}:${authst}`
}

const qqAccountId = (cookies: Record<string, string>) => {
  const { uin, tmeLoginType } = getQQCredentials(cookies)
  return createHash('sha256').update(`qq:${tmeLoginType}:${uin}`).digest('hex')
}

// 使用官网的单曲收藏状态接口核对，不以写接口 code=0 作为到账证明。
const checkQQFavoriteSong = async(songMid: string, account: string) => {
  const result = await requestQQMusicU<{
    verify: { data?: { m_fan?: Record<string, unknown> } }
  }>({
    verify: {
      module: 'music.musicasset.SongFavRead',
      method: 'IsSongFanByMid',
      param: { v_songMid: [songMid] },
    },
  }, undefined, account)
  if (qqAccountIdentity((await getQQAccountCredentials()).cookies) != account) throw new Error('account_changed')
  const value = result.verify.data?.m_fan?.[songMid]
  if (value === true || value === 1) return true
  if (value === false || value === 0) return false
  throw new Error('QQ favorite state missing')
}

// 只按 QQ songmid 查找确切歌曲，不用文件 ID 或其他平台的数字 ID 猜测收藏对象。
export const addQQFavoriteSong = async(request: QQFavoriteRequest): Promise<QQFavoriteResult> => {
  if (typeof request?.songMid != 'string' || !/^[a-zA-Z0-9]{1,64}$/.test(request.songMid) ||
    (request.playlistId != null && !isQQPlaylistId(request.playlistId)) ||
    (request.action != null && request.action != 'add' && request.action != 'check')) return { status: 'unsupported' }
  let writing = false
  const startedAt = Date.now()
  let phase = 'preflight'
  try {
    const { uin, authst, cookies } = await getQQAccountCredentials()
    if (!uin || !authst) return { status: 'login_required' }
    const account = qqAccountIdentity(cookies)
    await configureAccountSessionProxy('tx')
    const call = async(name: string, module: string, method: string, param: Record<string, unknown>) => {
      const response = await requestQQMusicU<Record<string, { data?: Record<string, any> }>>({ [name]: { module, method, param } }, undefined, account)
      if (qqAccountIdentity((await getQQAccountCredentials()).cookies) != account) throw new Error('account_changed')
      if (!response[name]?.data) throw new Error('unavailable')
      return response[name].data
    }
    const target = request.playlistId ? await resolveQQPlaylistTarget(request.playlistId, uin, call) : { dirId: 201, dissId: 0 }
    const encryptedUin = request.playlistId && !target.dissId && target.dirId != 201 ? await getQQEncryptedUin() : ''
    const check = async() => target.dirId == 201 ? checkQQFavoriteSong(request.songMid, account) : checkQQPlaylistSong(target, request.songMid, encryptedUin, call)
    const alreadyLiked = await check()
    if (alreadyLiked) return { status: 'added', accountId: qqAccountId(cookies) }
    if (request.action == 'check') return { status: 'not_found' }

    phase = 'detail'
    const detail = await requestQQMusicU<{
      detail: { data?: { track_info?: { id?: number, mid?: string, type?: number } } }
    }>({
      detail: {
        module: 'music.pf_song_detail_svr',
        method: 'get_song_detail_yqq',
        param: { song_mid: request.songMid, song_type: 0 },
      },
    }, undefined, account)
    const track = detail.detail.data?.track_info
    if (!track || track.mid != request.songMid || !Number.isSafeInteger(track.id) || track.id! <= 0 || (track.type != null && track.type != 0)) {
      return { status: 'unsupported' }
    }

    writing = true
    phase = 'write-request'
    // 对齐现行官网：201 为「我喜欢」，传真实数字歌曲 ID，只发送网页使用的歌单字段。
    const result = await requestQQMusicU<{
      favorite: { data?: { retCode?: unknown } }
    }>({
      favorite: {
        module: 'music.musicasset.PlaylistDetailWrite',
        method: 'AddSonglist',
        param: { dirId: target.dirId, v_songInfo: [{ songId: track.id, songType: 0 }] },
      },
    }, undefined, account, true)
    if (qqAccountIdentity((await getQQAccountCredentials()).cookies) != account) return { status: 'account_changed' }
    const retCode = result.favorite.data?.retCode
    if (retCode != null && parseQQMusicCode(retCode) !== 0) {
      const code = parseQQMusicCode(retCode)
      if (code != null && qqMusicCredentialRejectionCodes.has(code)) {
        accountValidationCache.delete('tx')
        return { status: 'login_required', code }
      }
      return code == null ? { status: 'unknown' } : { status: 'rejected', code }
    }

    phase = 'verify'
    // 只重查，不重写；给平台短暂同步时间，避免刚受理就显示成功。
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt) await new Promise<void>(resolve => { setTimeout(resolve, 800) })
      if (await check()) {
        console.info('[qq-favorite]', { phase, confirmed: true, elapsedMs: Date.now() - startedAt })
        return { status: 'added', accountId: qqAccountId(cookies) }
      }
    }
    console.info('[qq-favorite]', { phase, confirmed: false, elapsedMs: Date.now() - startedAt })
    return { status: 'unconfirmed' }
  } catch (error) {
    const networkCode = error instanceof Error ? /\b(?:net::)?ERR_[A-Z_]+\b/.exec(error.message)?.[0] : undefined
    const code = error instanceof QQMusicURequestError ? error.code : undefined
    // 此错误类型的 message 仅含固定的响应层级、模块名和数字码，不含服务端正文或凭证。
    const stage = error instanceof QQMusicURequestError ? error.message : undefined
    console.warn('[qq-favorite]', { phase, kind: error instanceof Error ? error.name : 'unknown', stage, code, networkCode, elapsedMs: Date.now() - startedAt })
    if (error instanceof Error && error.message == 'account_changed') return { status: 'account_changed' }
    if (error instanceof Error && error.message == 'unsupported') return { status: 'unsupported' }
    if (isQQMusicLoginRequiredError(error)) return { status: 'login_required', code }
    if (phase == 'write-request' && code != null && (code < 500 || code > 599)) return { status: 'rejected', code }
    // 结果不明时提供只读核对，绝不自动重发写请求。
    return { status: writing ? 'unknown' : 'unavailable', ...(code != null ? { code } : {}) }
  }
}

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

const getQQOfficialMusicUrl = async(songId: string, mediaId: string, quality: LX.Quality, allowQualityFallback = true) => {
  const candidates = (allowQualityFallback ? getQualityFallbacks(quality) : [quality])
    .filter((item): item is keyof typeof qqQualityFile => item in qqQualityFile)
    .map(item => ({ quality: item, filename: `${qqQualityFile[item].prefix}${mediaId}${qqQualityFile[item].extension}` }))
  if (!songId || !mediaId || !candidates.length) return null

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

const getQQNumericSongId = async(songMid: string, signal?: AbortSignal) => {
  try {
    const result = await requestQQMusicU<{
      detail?: {
        data?: { track_info?: { id?: string | number } }
      }
    }>({
      detail: {
        module: 'music.pf_song_detail_svr',
        method: 'get_song_detail_yqq',
        param: { song_type: 0, song_mid: songMid },
      },
    }, signal)
    const songId = String(result.detail?.data?.track_info?.id ?? '')
    return /^\d+$/.test(songId) ? songId : ''
  } catch (error) {
    if (signal?.aborted == true) throw error
    if (isQQMusicLoginRequiredError(error)) throw error
    console.warn('[musicAccount] QQ numeric song id unavailable', error)
    return ''
  }
}

const getCompatibleUserAgent = (userAgent: string) => userAgent
  .replace(/\sElectron\/[^\s]+/i, '')
  .replace(/\sq-music\/[^\s]+/i, '')

const configureLoginContents = (
  contents: WebContents,
  provider: MusicAccountProvider,
  accountSession: Session,
  onChildWindow?: (window: BrowserWindow) => void,
) => {
  // 全局拦截器先于账号窗口创建；两层监听必须使用同一条规则，否则微信的顶层回调会被提前阻止。
  setWindowNavigationPolicy(contents, target => isAllowedHost(provider, target))
  contents.setUserAgent(getCompatibleUserAgent(contents.getUserAgent()))
  contents.setWindowOpenHandler(({ url }) => {
    const upgraded = upgradeAccountLoginNavigation(provider, url)
    if (upgraded != url) {
      void contents.loadURL(upgraded)
      return { action: 'deny' }
    }
    if (!isAllowedHost(provider, url)) {
      void shell.openExternal(url)
      return { action: 'deny' }
    }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        ...getAccountLoginBounds(BrowserWindow.fromWebContents(contents) ?? undefined, true),
        show: true,
        autoHideMenuBar: true,
        backgroundColor: '#f7faf8',
        webPreferences: {
          session: accountSession,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          spellcheck: false,
        },
      },
    }
  })
  const handleNavigation = (event: Electron.Event, url: string) => {
    const upgraded = upgradeAccountLoginNavigation(provider, url)
    if (upgraded != url) {
      event.preventDefault()
      void contents.loadURL(upgraded)
      return
    }
    if (isAllowedHost(provider, url)) return
    event.preventDefault()
    // 不将带授权码的未知回调交给浏览器，避免网页成功而本地会话仍未登录。
    try { console.warn('[musicAccount] blocked login navigation', provider, new URL(url).origin) } catch {}
  }
  contents.on('will-navigate', handleNavigation)
  contents.on('will-redirect', handleNavigation)
  contents.on('did-create-window', childWindow => {
    childWindow.setMenuBarVisibility(false)
    fitAccountLoginWindow(childWindow, 'https://graph.qq.com/')
    onChildWindow?.(childWindow)
    configureLoginContents(childWindow.webContents, provider, accountSession, onChildWindow)
  })
}

const readQQDailyApiKey = (): string => {
  if (!safeStorage.isEncryptionAvailable()) return ''
  const encrypted = getStore(qqDailyKeyStoreName).get<string>(qqDailyKeyStoreField)
  if (!encrypted) return ''
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  } catch (error) {
    console.warn('[musicAccount] QQ daily API key could not be decrypted', error)
    return ''
  }
}

export const getQQDailyKeyStatus = (): QQDailyKeyStatus => ({
  configured: !!readQQDailyApiKey(),
  encryptionAvailable: safeStorage.isEncryptionAvailable(),
})

const requestQQOfficialDailySongIds = async(apiKey: string): Promise<string[]> => {
  const response = await session.fromPartition(providerConfig.tx.partition).fetch('https://a.y.qq.com/discover/daily-mix', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ params: {}, comm: { skill_version: '0.0.3' } }),
  })
  if (!response.ok) throw new Error(`QQ official daily recommendations failed: ${response.status}`)
  const result = await response.json() as {
    ret?: number
    sub_ret?: number
    songlist?: Array<{ songMid?: string }>
  }
  if ((result.ret != null && result.ret != 0) || (result.sub_ret != null && result.sub_ret != 0)) return []
  return (result.songlist ?? []).map(item => item.songMid ?? '').filter(Boolean).slice(0, 30)
}

export const saveQQDailyApiKey = async(value: string): Promise<QQDailyKeySaveResult> => {
  const apiKey = value.trim()
  if (!/^qmk-[A-Za-z0-9_-]+$/.test(apiKey)) {
    return { configured: getQQDailyKeyStatus().configured, encryptionAvailable: safeStorage.isEncryptionAvailable(), status: 'invalid', songCount: 0 }
  }
  if (!safeStorage.isEncryptionAvailable()) {
    return { configured: false, encryptionAvailable: false, status: 'unavailable', songCount: 0 }
  }
  try {
    const ids = await requestQQOfficialDailySongIds(apiKey)
    if (!ids.length) return { configured: getQQDailyKeyStatus().configured, encryptionAvailable: true, status: 'invalid', songCount: 0 }
    const encrypted = safeStorage.encryptString(apiKey).toString('base64')
    getStore(qqDailyKeyStoreName).set(qqDailyKeyStoreField, encrypted)
    return { configured: true, encryptionAvailable: true, status: 'saved', songCount: ids.length }
  } catch (error) {
    console.warn('[musicAccount] QQ daily API key validation failed', error)
    return { configured: getQQDailyKeyStatus().configured, encryptionAvailable: true, status: 'invalid', songCount: 0 }
  }
}

const detectQQDailyApiKey = async(contents: WebContents): Promise<string> => {
  if (contents.isDestroyed() || contents.getURL() == '' || !isAllowedHost('tx', contents.getURL())) return ''
  const detectionScript = `(() => {
    const values = [document.body?.innerText ?? '', ...Array.from(document.querySelectorAll('input, textarea')).map(element => element.value ?? '')]
    return values.join('\\n').match(/qmk-[A-Za-z0-9_-]{12,1024}/)?.[0] ?? ''
  })()`
  for (const frame of contents.mainFrame.framesInSubtree) {
    if (!isAllowedHost('tx', frame.url)) continue
    try {
      const apiKey = await frame.executeJavaScript(detectionScript, true) as string
      if (apiKey) return apiKey
    } catch {
      continue
    }
  }
  return ''
}

export const openQQDailyKeyPage = async(): Promise<QQDailyKeySaveResult> => {
  if (qqDailyKeyWindow && !qqDailyKeyWindow.isDestroyed() && qqDailyKeyTask) {
    qqDailyKeyWindow.show()
    qqDailyKeyWindow.focus()
    return qqDailyKeyTask
  }
  if (!safeStorage.isEncryptionAvailable()) {
    return { configured: false, encryptionAvailable: false, status: 'unavailable', songCount: 0 }
  }

  const task = (async() => {
    const accountSession = await configureAccountSessionProxy('tx')

    return new Promise<QQDailyKeySaveResult>(resolve => {
      const parent = BrowserWindow.getFocusedWindow() ?? undefined
      const authorizationWindow = new BrowserWindow({
        parent,
        modal: !!parent,
        width: 940,
        height: 760,
        minWidth: 720,
        minHeight: 560,
        show: false,
        autoHideMenuBar: true,
        title: 'QQ音乐官方每日30首授权',
        backgroundColor: '#f7faf8',
        webPreferences: {
          session: accountSession,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          spellcheck: false,
        },
      })
      qqDailyKeyWindow = authorizationWindow

      let settled = false
      let detecting = false
      let detectTimer: NodeJS.Timeout | undefined
      const childWindows = new Set<BrowserWindow>()
      const finish = (result: QQDailyKeySaveResult) => {
        if (settled) return
        settled = true
        if (detectTimer) clearInterval(detectTimer)
        qqDailyKeyWindow = null
        qqDailyKeyTask = null
        resolve(result)
        for (const childWindow of childWindows) {
          if (!childWindow.isDestroyed()) childWindow.close()
        }
        if (!authorizationWindow.isDestroyed()) authorizationWindow.close()
      }
      const detectAndSave = async() => {
        if (settled || detecting) return
        detecting = true
        try {
          const contentsList = [authorizationWindow.webContents, ...Array.from(childWindows, window => window.webContents)]
          for (const contents of contentsList) {
            const apiKey = await detectQQDailyApiKey(contents)
            if (!apiKey) continue
            const result = await saveQQDailyApiKey(apiKey)
            if (result.status == 'saved') {
              finish(result)
              return
            }
          }
        } finally {
          detecting = false
        }
      }
      const handleChildWindow = (childWindow: BrowserWindow) => {
        childWindows.add(childWindow)
        childWindow.once('closed', () => { childWindows.delete(childWindow) })
        childWindow.webContents.on('did-finish-load', () => { void detectAndSave() })
      }

      configureLoginContents(authorizationWindow.webContents, 'tx', accountSession, handleChildWindow)
      authorizationWindow.webContents.on('did-finish-load', () => { void detectAndSave() })
      detectTimer = setInterval(() => { void detectAndSave() }, 1000)
      authorizationWindow.once('ready-to-show', () => { authorizationWindow.show() })
      authorizationWindow.on('closed', () => {
        finish({ configured: getQQDailyKeyStatus().configured, encryptionAvailable: true, status: 'cancelled', songCount: 0 })
      })
      void authorizationWindow.loadURL(qqDailyKeyPage)
    })
  })()
  qqDailyKeyTask = task
  return task
}

const getQQDailySongIds = async(): Promise<string[]> => {
  const { accountSession, cookies } = await getQQAccountCredentials()
  const ids = new Set<string>()

  for (let page = 1; page <= 4 && ids.size < 30; page++) {
    const response = await accountSession.fetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        Origin: 'https://y.qq.com',
        Referer: 'https://y.qq.com/',
      },
      body: JSON.stringify({
        comm: getQQRequestComm(cookies, 19),
        radio: {
          module: 'music.recommend.TrackRelationServer',
          method: 'GetRadarSong',
          param: { Page: page },
        },
      }),
    })
    if (!response.ok) throw new Error(`QQ Music recommendations failed: ${response.status}`)
    const result = await response.json() as {
      radio?: { code?: number, data?: Record<string, unknown> }
    }
    if (result.radio?.code != 0) break
    const data = result.radio.data ?? {}
    const candidates = [data.VecSongs, data.tracks, data.track, data.songList, data.vec_song, data.List]
      .find(value => Array.isArray(value)) as Array<Record<string, unknown>> | undefined
    if (!candidates?.length) break
    for (const candidate of candidates) {
      const track = (candidate.Track ?? candidate.track_info ?? candidate) as Record<string, unknown>
      const id = String(track.mid ?? track.songmid ?? '')
      if (id) ids.add(id)
      if (ids.size >= 30) break
    }
  }
  return [...ids]
}

const getNeteaseCsrfToken = async(accountSession: Session) => {
  const cookies = await accountSession.cookies.get({ url: 'https://music.163.com' })
  return cookies.find(cookie => cookie.name == '__csrf')?.value ?? ''
}

export const addNeteaseFavoriteSong = createNeteaseFavoriteClient(async() => {
  const accountSession = await configureAccountSessionProxy('wy')
  const readCookies = async() => accountSession.cookies.get({ url: 'https://music.163.com/' })
  const cookies = await readCookies()
  const musicU = cookies.find(cookie => cookie.name == 'MUSIC_U')?.value
  if (!musicU) throw new Error('login_required')
  return {
    assertSession: async() => {
      if ((await readCookies()).find(cookie => cookie.name == 'MUSIC_U')?.value != musicU) throw new Error('account_changed')
    },
    request: async(path, data) => {
      const csrf = cookies.find(cookie => cookie.name == '__csrf')?.value ?? ''
      const response = await accountSession.fetch(`https://music.163.com/weapi/${path}?csrf_token=${encodeURIComponent(csrf)}`, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://music.163.com', Referer: 'https://music.163.com/' },
        body: buildNeteaseWeapiForm({ ...data, csrf_token: csrf }),
        signal: AbortSignal.timeout(12_000),
      })
      if (response.status == 401) throw new Error('login_required')
      if (!response.ok) throw new Error('unavailable')
      const result = await response.json() as Record<string, any>
      if ([301, 401].includes(Number(result.code))) accountValidationCache.delete('wy')
      return result
    },
  }
})

const requestNeteaseWeapi = async<T>(path: string, data: Record<string, unknown>): Promise<T> => {
  const accountSession = session.fromPartition(providerConfig.wy.partition)
  const csrfToken = await getNeteaseCsrfToken(accountSession)
  const response = await accountSession.fetch(`https://music.163.com${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: 'https://music.163.com',
      Referer: 'https://music.163.com/',
    },
    body: buildNeteaseWeapiForm({ ...data, csrf_token: csrfToken }),
    signal: AbortSignal.timeout(12_000),
  })
  if (response.status == 401) throw new Error('login_required')
  if (response.status == 429) throw new Error('restricted')
  if (!response.ok) throw new Error(`NetEase request failed (${path}): ${response.status}`)
  const result = await response.json() as T & { code?: number }
  if ([301, 401].includes(Number(result.code))) {
    accountValidationCache.delete('wy')
    throw new Error('login_required')
  }
  if (neteaseRestrictedCodes.has(Number(result.code))) throw new Error('restricted')
  if (Number(result.code) != 200) throw new Error('NetEase account request unavailable')
  return result
}

const neteaseQualityLevel = {
  flac24bit: 'hires',
  flac: 'lossless',
  '320k': 'exhigh',
  '128k': 'standard',
} as const

const getNeteaseOfficialMusicUrl = async(songId: string, quality: LX.Quality, allowQualityFallback = true) => {
  if (!/^\d+$/.test(songId)) return null
  const candidates = (allowQualityFallback ? getQualityFallbacks(quality) : [quality])
    .filter((item): item is keyof typeof neteaseQualityLevel => item in neteaseQualityLevel)
  for (const candidate of candidates) {
    const result = await requestNeteaseWeapi<{
      code?: number
      data?: Array<{ url?: string | null, code?: number, level?: string, br?: number }>
    }>('/weapi/song/enhance/player/url/v1', {
      ids: JSON.stringify([Number(songId)]),
      level: neteaseQualityLevel[candidate],
      encodeType: 'flac',
    })
    const item = result.data?.[0]
    if (result.code == 200 && item?.code == 200 && item.url) {
      const actualQuality = neteasePlaybackQuality(item.level, item.br)
      if (!allowQualityFallback && actualQuality != quality) continue
      return { url: item.url, quality: actualQuality ?? candidate as LX.Quality }
    }
  }
  return null
}

export const getMusicAccountMusicUrl = async(request: MusicAccountMusicUrlRequest): Promise<MusicAccountMusicUrlResult> => {
  const unavailable = (status: MusicAccountMusicUrlResult['status']): MusicAccountMusicUrlResult => ({
    provider: request.provider,
    status,
    url: '',
    quality: request.quality,
  })
  if (request.provider == 'kg') return unavailable('unavailable')
  try {
    if (!await hasLoginCookie(request.provider)) return unavailable('login_required')
    await configureAccountSessionProxy(request.provider)
  } catch (error) {
    console.warn(`[musicAccount] ${request.provider} credential check unavailable`, error)
    return unavailable('error')
  }

  const cacheKey = `${request.provider}:${request.songId}:${request.mediaId ?? ''}:${request.quality}`
  const cached = officialMusicUrlCache.get(cacheKey)
  if (!request.refresh && cached && (request.allowQualityFallback !== false || cached.quality == request.quality) && cached.expiresAt > Date.now()) {
    const reportSongId = /^\d+$/.test(request.reportSongId ?? '') ? request.reportSongId : cached.reportSongId
    return { provider: request.provider, status: 'available', url: cached.url, quality: cached.quality, reportSongId }
  }

  try {
    const result = request.provider == 'tx'
      ? await getQQOfficialMusicUrl(request.songId, request.mediaId ?? request.songId, request.quality, request.allowQualityFallback)
      : await getNeteaseOfficialMusicUrl(request.songId, request.quality, request.allowQualityFallback)
    if (!result) return unavailable('unavailable')
    const reportSongId = request.provider == 'tx'
      ? (/^\d+$/.test(request.reportSongId ?? '') ? request.reportSongId : request.songId)
      : request.songId
    officialMusicUrlCache.set(cacheKey, { ...result, reportSongId, expiresAt: Date.now() + 5 * 60_000 })
    return { provider: request.provider, status: 'available', ...result, reportSongId }
  } catch (error) {
    console.warn(`[musicAccount] ${request.provider} official music URL unavailable`, error)
    return unavailable(isQQMusicLoginRequiredError(error) ? 'login_required' : 'error')
  }
}

const withPlaybackReportTimeout = async<T>(handler: (signal: AbortSignal) => Promise<T>) => {
  const abortController = new AbortController()
  const timeout = setTimeout(() => {
    abortController.abort()
  }, playbackReportTimeout)
  try {
    return await handler(abortController.signal)
  } finally {
    clearTimeout(timeout)
  }
}

const reportQQPlayback = async(request: MusicAccountPlaybackReportRequest) => withPlaybackReportTimeout(async signal => {
  const { accountSession, uin } = await getQQAccountCredentials()
  if (!uin) return 'login_required' as const
  const songId = /^\d+$/.test(request.songId) ? request.songId : await getQQNumericSongId(request.songId, signal)
  if (!songId) return 'unavailable' as const
  const cookies = await accountSession.cookies.get({ url: 'https://y.qq.com' })
  const cookieGuid = cookies.find(cookie => cookie.name.toLowerCase() == 'pgv_pvid')?.value ?? ''
  const guid = /^\d{6,}$/.test(cookieGuid)
    ? cookieGuid
    : (qqPlaybackGuid ||= Array.from(randomBytes(10), value => String(value % 10)).join(''))
  const url = new URL('https://stat6.y.qq.com/pc/fcgi-bin/cgi_music_webreport.fcg')
  url.search = new URLSearchParams({
    Count: '1',
    Fqq: uin,
    Fguid: guid,
    Ffromtag1: '10050',
    Ffromtag2: songId,
    Fsong_id: songId,
    Fplay_time: String(Math.max(0, Math.floor(request.playedSeconds))),
    Fstart_time: String(Math.max(0, Math.floor(request.startedAt))),
    Ftype: request.mediaId ? '3' : '1',
    Fversion: '1',
    Fid1: '0',
  }).toString()
  const response = await accountSession.fetch(url.toString(), {
    headers: { Referer: 'https://y.qq.com/' },
    signal,
  })
  if (response.status == 401 || response.status == 403) {
    accountValidationCache.delete('tx')
    return 'login_required' as const
  }
  if (!response.ok) return 'unavailable' as const
  const responseText = await response.text()
  if (/(?:input\s+id|login\s*(?:required|invalid)|invalid\s*(?:uin|user))/i.test(responseText)) {
    accountValidationCache.delete('tx')
    return 'login_required' as const
  }
  if (/(?:error|failed?)/i.test(responseText)) return 'unavailable' as const
  return 'reported' as const
})

const getNeteasePlaybackContext = async(accountSession: Session) => {
  const cookies = await accountSession.cookies.get({ url: 'https://music.163.com' })
  const cookieMap = new Map(cookies.map(cookie => [cookie.name.toLowerCase(), cookie.value]))
  const musicU = cookieMap.get('music_u') ?? ''
  if (!musicU) return null

  return {
    csrfToken: cookieMap.get('__csrf') ?? '',
    deviceId: cookieMap.get('deviceid') ?? cookieMap.get('_ntes_nuid') ?? (neteasePlaybackDeviceId ||= randomBytes(16).toString('hex')),
    musicU,
    nmtid: cookieMap.get('nmtid') ?? '',
  }
}

const requestNeteasePlaybackLog = async(
  accountSession: Session,
  context: NonNullable<Awaited<ReturnType<typeof getNeteasePlaybackContext>>>,
  log: Record<string, unknown>,
) => withPlaybackReportTimeout(async signal => {
  const header: Record<string, string> = {
    osver: '15.5',
    deviceId: context.deviceId,
    os: 'osx',
    appver: '3.1.10.5100',
    versioncode: '140',
    mobilename: '',
    buildver: String(Math.floor(Date.now() / 1_000)),
    resolution: '1920x1080',
    __csrf: context.csrfToken,
    channel: 'netease',
    requestId: `${Date.now()}_${String(randomBytes(2).readUInt16BE(0) % 10_000).padStart(4, '0')}`,
    MUSIC_U: context.musicU,
  }
  if (context.nmtid) header.NMTID = context.nmtid
  const cookie = Object.entries(header)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('; ')
  const body = buildNeteaseEapiForm(neteasePlaybackLogPath, {
    logs: JSON.stringify([log]),
    e_r: false,
    header,
  })
  const response = await accountSession.fetch('https://clientlog.music.163.com/eapi/feedback/weblog', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      Cookie: cookie,
      Origin: 'https://music.163.com',
      Referer: 'https://music.163.com/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
    body,
    signal,
  })
  if (response.status == 401 || response.status == 403) {
    accountValidationCache.delete('wy')
    return 'login_required' as const
  }
  if (!response.ok) return 'unavailable' as const
  try {
    const result = await response.json() as { code?: number | string }
    const code = Number(result.code)
    if (code == 200) return 'reported' as const
    if (code == 301 || code == 401) {
      accountValidationCache.delete('wy')
      return 'login_required' as const
    }
    return 'unavailable' as const
  } catch {
    return 'unavailable' as const
  }
})

const reportNeteasePlayback = async(request: MusicAccountPlaybackReportRequest) => {
  if (!/^\d+$/.test(request.songId)) return 'unavailable' as const
  const accountSession = session.fromPartition(providerConfig.wy.partition)
  const context = await getNeteasePlaybackContext(accountSession)
  if (!context) return 'login_required' as const
  const songId = Number(request.songId)
  const requestedSourceId = request.sourceId ?? ''
  const sourceId = /^\d+$/.test(requestedSourceId) ? requestedSourceId : '0'
  const phase = request.phase ?? 'start'
  if (phase == 'start') {
    return requestNeteasePlaybackLog(accountSession, context, {
      action: 'startplay',
      json: {
        id: songId,
        type: 'song',
        mainsite: '1',
        mainsiteWeb: '1',
        content: `id=${sourceId}`,
      },
    })
  }

  return requestNeteasePlaybackLog(accountSession, context, {
    action: 'play',
    json: {
      download: 0,
      end: 'playend',
      id: songId,
      sourceId,
      time: Math.max(1, Math.floor(request.playedSeconds)),
      type: 'song',
      wifi: 0,
      source: 'list',
      mainsite: '1',
      mainsiteWeb: '1',
      content: `id=${sourceId}`,
    },
  })
}

export const reportMusicAccountPlayback = async(request: MusicAccountPlaybackReportRequest): Promise<MusicAccountPlaybackReportResult> => {
  const unavailable = (status: MusicAccountPlaybackReportResult['status']): MusicAccountPlaybackReportResult => ({
    provider: request.provider,
    status,
  })
  if (request.provider == 'kg') return unavailable('unavailable')
  // QQ 的网页上报只有一条记录，在 start 阶段发送。
  if (request.provider == 'tx' && request.phase == 'finish') return unavailable('unavailable')
  try {
    if (
      (request.provider == 'wy' ? !/^\d+$/.test(request.songId) : !request.songId.trim()) ||
      !Number.isFinite(request.playedSeconds) || request.playedSeconds <= 0 ||
      !Number.isFinite(request.startedAt) || request.startedAt <= 0
    ) return unavailable('unavailable')
    if (!await hasLoginCookie(request.provider)) return unavailable('login_required')
    await configureAccountSessionProxy(request.provider)
    const status = request.provider == 'tx'
      ? await reportQQPlayback(request)
      : await reportNeteasePlayback(request)
    return unavailable(status)
  } catch (error) {
    console.warn(`[musicAccount] ${request.provider} playback report unavailable`, error)
    return unavailable((isQQMusicLoginRequiredError(error) || (error instanceof Error && error.message == 'login_required')) ? 'login_required' : 'unavailable')
  }
}

const getNeteaseDailySongIds = async(): Promise<string[]> => {
  const result = await requestNeteaseWeapi<{ code?: number, data?: { dailySongs?: Array<{ id?: string | number }> } }>(
    '/weapi/v3/discovery/recommend/songs',
    { offset: 0, total: true, limit: 30 },
  )
  if (result.code != 200) return []
  return (result.data?.dailySongs ?? []).map(item => String(item.id ?? '')).filter(Boolean)
}

const getNeteaseAccountProfile = async() => {
  const result = await requestNeteaseWeapi<{
    code?: number
    profile?: { userId?: string | number, nickname?: string, avatarUrl?: string }
    account?: { id?: string | number }
  }>('/weapi/w/nuser/account/get', {})
  const userId = String(result.profile?.userId ?? result.account?.id ?? '')
  return {
    userId,
    displayName: result.profile?.nickname?.trim() ?? '',
    avatar: normalizeRemoteImageUrl(result.profile?.avatarUrl),
    accountHint: userId ? `网易云 · ${maskAccountId(userId)}` : '',
  }
}

const getNeteaseUserId = async(): Promise<string> => (await getNeteaseAccountProfile()).userId

const validateMusicAccount = async(provider: MusicAccountProvider, force = false) => {
  if (provider == 'kg') {
    const connected = Boolean(readKugouSession())
    return { connected, state: (connected ? 'connected' : 'disconnected') as MusicAccountConnectionState, expiresAt: Date.now() + 2000 }
  }
  const cached = accountValidationCache.get(provider)
  if (!force && cached && cached.expiresAt > Date.now()) return cached

  let connected = false
  let state: MusicAccountConnectionState = 'disconnected'
  try {
    if (!await hasLoginCookie(provider)) {
      const result = { connected, state, expiresAt: Date.now() + 2_000 }
      accountValidationCache.set(provider, result)
      return result
    }

    await configureAccountSessionProxy(provider)
    if (provider == 'wy') {
      connected = !!await getNeteaseUserId()
    } else {
      const { uin, authst } = await getQQAccountCredentials()
      if (uin && authst) {
        await requestQQMusicU<{
          status?: { code?: number, data?: Record<string, unknown> }
        }>({
          status: {
            module: 'music.musicasset.PlaylistBaseRead',
            method: 'GetPlaylistByUin',
            param: { uin },
          },
        })
        connected = true
      }
    }
    state = connected ? 'connected' : 'expired'
  } catch (error) {
    state = isQQMusicLoginRequiredError(error) || (error instanceof Error && error.message == 'login_required') ? 'expired' : 'unavailable'
    console.warn(`[musicAccount] ${provider} session validation failed`, error)
  }
  const result = { connected, state, expiresAt: Date.now() + (connected ? 15_000 : 2_000) }
  accountValidationCache.set(provider, result)
  return result
}

const verifyMusicAccount = async(provider: MusicAccountProvider, force = false): Promise<boolean> => {
  return (await validateMusicAccount(provider, force)).connected
}

export const getMusicAccountStatus = async(): Promise<MusicAccountStatus> => {
  const inspectAccount = async(provider: MusicAccountProvider): Promise<MusicAccountProfile> => {
    if (provider == 'kg') {
      const account = readKugouSession()
      return { state: account ? 'connected' : 'disconnected', displayName: account?.nickname ?? '', avatar: account?.avatar ?? '', accountHint: account ? `酷狗 · ${maskAccountId(account.userId)}` : '', hasSession: Boolean(account) }
    }
    const validation = await validateMusicAccount(provider, true)
    if (!validation.connected) {
      let accountHint = ''
      if (provider == 'tx' && validation.state != 'disconnected') {
        const { uin, isWeChat } = await getQQAccountCredentials().catch(() => ({ uin: '', isWeChat: false }))
        if (uin) accountHint = `${isWeChat ? '微信' : 'QQ'} · ${maskAccountId(uin)}`
      }
      return {
        state: validation.state,
        displayName: '',
        avatar: '',
        accountHint,
        hasSession: validation.state != 'disconnected',
      }
    }

    if (provider == 'tx') {
      const profile = await getQQAccountProfile()
      return { state: 'connected', displayName: profile.displayName, avatar: profile.avatar, accountHint: profile.accountHint, hasSession: true }
    }
    const profile = await getNeteaseAccountProfile().catch(() => ({ displayName: '', avatar: '', accountHint: '' }))
    return { state: 'connected', displayName: profile.displayName, avatar: profile.avatar, accountHint: profile.accountHint, hasSession: true }
  }

  const [txAccount, wyAccount, kgAccount] = await Promise.all([inspectAccount('tx'), inspectAccount('wy'), inspectAccount('kg')])
  return {
    tx: txAccount.state == 'connected',
    wy: wyAccount.state == 'connected',
    kg: kgAccount.state == 'connected',
    accounts: { tx: txAccount, wy: wyAccount, kg: kgAccount },
  }
}

export const getMusicAccountPlaylists = async(provider: MusicAccountProvider, ownedOnly = false): Promise<MusicAccountPlaylistsResult> => {
  const validation = ownedOnly && provider == 'tx' ? { connected: true, state: 'connected' } : await validateMusicAccount(provider)
  if (!validation.connected) return { provider, playlists: [], status: validation.state == 'unavailable' ? 'unavailable' : 'login_required' }
  try {
    if (provider == 'kg') return { provider, playlists: await getKugouPlaylists(), status: 'available' }
    if (provider == 'tx') {
      const { uin, authst, cookies } = await getQQAccountCredentials()
      if (!uin || !authst) return { provider, playlists: [], status: 'login_required' }
      const account = qqAccountIdentity(cookies)
      if (ownedOnly) {
        const targets = await getQQPlaylistTargets(uin, async(name, module, method, param) => {
          const result = await requestQQMusicU<Record<string, { data: Record<string, any> }>>({ [name]: { module, method, param } }, undefined, account)
          return result[name].data
        })
        if (qqAccountIdentity((await getQQAccountCredentials()).cookies) != account) throw new Error('account_changed')
        return { provider, status: 'available', playlists: targets.map(item => ({ ...item, trackCount: item.count, creator: '', accountId: qqAccountId(cookies) })) }
      }
      const encryptedUin = await getQQEncryptedUin()
      const catalog = await getQQAccountCatalog(uin, encryptedUin, async(name, module, method, param) => {
        const result = await requestQQMusicU<Record<string, { data?: Record<string, any> }>>({ [name]: { module, method, param } }, undefined, account)
        if (!result[name]?.data) throw new Error('unavailable')
        return result[name].data
      })
      const normalize = (items: Array<Record<string, unknown>>, kind: MusicAccountPlaylist['kind']) => items.map(item => {
        const dirId = String(item.dirId ?? item.dirid ?? '')
        const dissId = [item.tid, item.dissid, item.dissId, item.id]
          .map(value => String(value ?? ''))
          .find(value => value && value != '0') ?? ''
        return {
          id: dirId == '201' ? 'dir:201' : dissId && dissId != '0' ? dissId : dirId ? `dir:${dirId}` : '',
          name: String(item.dirName ?? item.dirname ?? item.title ?? item.dissname ?? item.name ?? ''),
          cover: String(item.picUrl ?? item.bigpicUrl ?? item.picurl ?? item.logo ?? ''),
          trackCount: Number(item.songNum ?? item.song_cnt ?? item.songnum ?? item.song_num ?? item.songCount ?? item.trackCount ?? 0),
          creator: '',
          kind,
        }
      }).filter(item => item.id && item.name)
      const playlistMap = new Map([
        ...normalize(catalog.created, 'created'),
        ...normalize(catalog.favorite, 'favorite'),
      ].map(item => [item.id, item]))
      if (qqAccountIdentity((await getQQAccountCredentials()).cookies) != account) throw new Error('account_changed')
      const playlists = [...playlistMap.values()].map(item => ({ ...item, accountId: qqAccountId(cookies) }))
      return { provider, playlists, partial: catalog.warnings.length > 0, status: 'available' }
    }

    const uid = await getNeteaseUserId()
    if (!uid) return { provider, playlists: [], status: 'unavailable' }
    const result = await requestNeteaseWeapi<{
      code?: number
      playlist?: Array<{
        id?: string | number
        name?: string
        coverImgUrl?: string
        trackCount?: number
        subscribed?: boolean
        creator?: { nickname?: string, userId?: string | number }
      }>
    }>('/weapi/user/playlist', { uid, offset: 0, limit: 1000, includeVideo: true })
    if (!Array.isArray(result.playlist)) throw new Error('NetEase playlists response missing data')
    const playlists = (result.playlist ?? []).map(item => ({
      id: String(item.id ?? ''),
      name: item.name ?? '',
      cover: item.coverImgUrl ?? '',
      trackCount: item.trackCount ?? 0,
      creator: item.creator?.nickname ?? '',
      kind: item.subscribed == true
        ? 'favorite' as const
        : String(item.creator?.userId ?? '') != uid ? 'favorite' as const : 'created' as const,
    })).filter(item => item.id && item.name)
    return { provider, playlists, status: 'available' }
  } catch (error) {
    console.warn(`[musicAccount] ${provider} playlists unavailable`, error)
    if (provider == 'kg' && error instanceof Error && error.message == 'verification_required') return { provider, playlists: [], status: 'verification_required' }
    return { provider, playlists: [], status: (isQQMusicLoginRequiredError(error) || (error instanceof Error && error.message == 'login_required')) ? 'login_required' : accountFailureKind(error) ?? 'unavailable' }
  }
}

export const getMusicAccountPlaylistDetail = async(
  provider: MusicAccountProvider,
  id: string,
): Promise<MusicAccountPlaylistDetailResult> => {
  const validation = await validateMusicAccount(provider)
  if (!validation.connected) return { provider, id, ids: [], status: validation.state == 'unavailable' ? 'unavailable' : 'login_required' }
  try {
    if (provider == 'kg') return { provider, id, ids: await getKugouPlaylistHashes(id), status: 'available' }
    if (provider == 'tx') {
      const dirMatch = /^dir:(\d+)$/.exec(id)
      const dirId = dirMatch ? Number(dirMatch[1]) : id == '0' ? 201 : 0
      const dissId = dirId ? 0 : Number(id)
      const { cookies } = await getQQAccountCredentials()
      const account = qqAccountIdentity(cookies)

      if (!dirId && !Number.isFinite(dissId)) return { provider, id, ids: [], status: 'unavailable' }
      const read = async(name: string, module: string, method: string, param: Record<string, unknown>) => {
        const result = await requestQQMusicU<Record<string, { data?: Record<string, any> }>>({ [name]: { module, method, param } }, undefined, account)
        if (!result[name]?.data) throw new Error('unavailable')
        return result[name].data
      }
      const target = await resolveQQPlaylistReadTarget(dirId ? 'dir:' + String(dirId) : id, getQQCredentials(cookies).uin, read)
      const encryptedUin = target.dissId ? '' : await getQQEncryptedUin()
      const tracks: Array<Record<string, unknown>> = []
      const ids = await collectQQPlaylistIds(async offset => {
        const data = await getQQPlaylistReadPage(target, encryptedUin, offset, read)
        const songs = data.songlist ?? data.songList ?? data.track_list
        tracks.push(...songs.map((item: Record<string, unknown>) => (item.track_info ?? item) as Record<string, unknown>))
        const total = data.total_song_num ?? data.songnum ?? data.totalnum
        return {
          ids: songs.map((item: Record<string, unknown>) => {
            const track = (item.track_info ?? item) as Record<string, unknown>
            return String(track.mid ?? track.songmid ?? track.songMid ?? track.song_mid ?? '')
          }),
          total: total == null ? undefined : Number(total),
          hasMore: data.hasmore == null ? undefined : data.hasmore === true || parseQQMusicCode(data.hasmore) == 1,
        }
      })
      if (qqAccountIdentity((await getQQAccountCredentials()).cookies) != account) throw new Error('account_changed')
      return { provider, id, ids, tracks, status: 'available', accountId: qqAccountId(cookies) }
    }

    const result = await requestNeteaseWeapi<{
      code?: number
      playlist?: { trackIds?: Array<{ id?: string | number }>, trackCount?: number }
    }>('/weapi/v6/playlist/detail', { id, n: 100000, s: 8 })
    if (result.code == 301) throw new Error('login_required')
    if (result.code != 200 || !Array.isArray(result.playlist?.trackIds)) throw new Error('playlist_incomplete')
    const ids = result.playlist.trackIds.map(item => String(item.id ?? ''))
    if (ids.some(songId => !/^\d+$/.test(songId)) || (result.playlist.trackCount != null && result.playlist.trackCount != ids.length)) throw new Error('playlist_incomplete')
    const tracks: Array<Record<string, any>> = []
    const privileges: Array<Record<string, any>> = []
    for (let offset = 0; offset < ids.length; offset += 200) {
      const batch = ids.slice(offset, offset + 200)
      const detail = await requestNeteaseWeapi<{ code?: number, songs?: Array<Record<string, any>>, privileges?: Array<Record<string, any>> }>(
        '/weapi/v3/song/detail', { c: JSON.stringify(batch.map(songId => ({ id: songId }))) },
      )
      if (detail.code == 301) throw new Error('login_required')
      if (detail.code != 200 || !Array.isArray(detail.songs) || !Array.isArray(detail.privileges)) throw new Error('playlist_incomplete')
      tracks.push(...detail.songs)
      privileges.push(...detail.privileges)
    }
    return { provider, id, ids, tracks, privileges, status: 'available' }
  } catch (error) {
    console.warn(`[musicAccount] ${provider} playlist detail unavailable`, error)
    const code = error instanceof Error ? error.message : ''
    const status = code == 'verification_required' || code == 'account_changed' || code == 'playlist_incomplete' ? code : code == 'incomplete' ? 'playlist_incomplete' : isQQMusicLoginRequiredError(error) || code == 'login_required' ? 'login_required' : accountFailureKind(error) ?? 'unavailable'
    return { provider, id, ids: [], status }
  }
}

export const getMusicAccountDailySongIds = async(provider: MusicAccountProvider): Promise<MusicAccountDailyResult> => {
  const validation = await validateMusicAccount(provider)
  if (!validation.connected) return { provider, ids: [], status: validation.state == 'unavailable' ? 'unavailable' : 'login_required' }
  try {
    if (provider == 'kg') {
      const ids = await getKugouDailyHashes()
      return { provider, ids, status: ids.length ? 'personalized' : 'unavailable', kind: 'kugou_daily' }
    }
    if (provider == 'tx') {
      const apiKey = readQQDailyApiKey()
      if (apiKey) {
        const ids = await requestQQOfficialDailySongIds(apiKey).catch(() => [])
        if (ids.length) return { provider, ids, status: 'personalized', kind: 'official_daily' }
      }
      const ids = await getQQDailySongIds()
      return { provider, ids, status: ids.length ? 'personalized' : 'unavailable', kind: 'radar' }
    }
    const ids = await getNeteaseDailySongIds()
    return { provider, ids, status: ids.length ? 'personalized' : 'unavailable', kind: 'netease_daily' }
  } catch (error) {
    console.warn(`[musicAccount] ${provider} personalized recommendations unavailable`, error)
    return { provider, ids: [], status: 'unavailable' }
  }
}

export const openMusicAccountLogin = async(provider: MusicAccountProvider): Promise<MusicAccountLoginResult> => {
  if (provider == 'kg') return { provider, status: await openKugouLogin() }
  const accountSession = session.fromPartition(providerConfig[provider].partition)
  const status = await openOfficialAccountLogin(provider, {
    title: providerConfig[provider].title,
    url: providerConfig[provider].loginUrl,
    session: accountSession,
    configureProxy: async() => configureAccountSessionProxy(provider),
    verify: async() => verifyMusicAccount(provider, true),
    configureContents: (contents, onChildWindow) => { configureLoginContents(contents, provider, accountSession, onChildWindow) },
  })
  accountValidationCache.delete(provider)
  return { provider, status }
}

export const logoutMusicAccount = async(provider: MusicAccountProvider): Promise<MusicAccountLogoutResult> => {
  try {
    if (provider == 'kg') { logoutKugou(); return { provider, status: 'disconnected' } }
    closeOfficialAccountLogin(provider)
    if (provider == 'tx' && qqDailyKeyWindow && !qqDailyKeyWindow.isDestroyed()) qqDailyKeyWindow.close()

    const accountSession = session.fromPartition(providerConfig[provider].partition)
    await accountSession.clearStorageData()
    accountValidationCache.delete(provider)
    for (const cacheKey of officialMusicUrlCache.keys()) {
      if (cacheKey.startsWith(`${provider}:`)) officialMusicUrlCache.delete(cacheKey)
    }
    await accountSession.clearCache().catch(error => {
      console.warn(`[musicAccount] ${provider} cache cleanup after logout failed`, error)
    })
    if (provider == 'tx') {
      try {
        getStore(qqDailyKeyStoreName).set(qqDailyKeyStoreField, '')
      } catch (error) {
        console.warn('[musicAccount] QQ daily authorization cleanup after logout failed', error)
      }
    }
    return { provider, status: 'disconnected' }
  } catch (error) {
    console.warn(`[musicAccount] ${provider} logout failed`, error)
    return { provider, status: 'error' }
  }
}
