import { BrowserWindow, safeStorage, session, shell, type Session, type WebContents } from 'electron'
import { getProxy } from '@main/utils'
import getStore from '@main/utils/store'
import { constants, createCipheriv, publicEncrypt, randomBytes } from 'node:crypto'

export type MusicAccountProvider = 'tx' | 'wy'

export interface MusicAccountStatus {
  tx: boolean
  wy: boolean
}

export interface MusicAccountLoginResult {
  provider: MusicAccountProvider
  status: 'connected' | 'cancelled'
}

export interface MusicAccountDailyResult {
  provider: MusicAccountProvider
  ids: string[]
  status: 'personalized' | 'login_required' | 'unavailable'
  kind?: 'official_daily' | 'radar' | 'netease_daily'
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
  id: string
  name: string
  cover: string
  trackCount: number
  creator: string
  kind?: 'created' | 'favorite'
}

export interface MusicAccountPlaylistsResult {
  provider: MusicAccountProvider
  playlists: MusicAccountPlaylist[]
  status: 'available' | 'login_required' | 'unavailable'
}

export interface MusicAccountPlaylistDetailResult {
  provider: MusicAccountProvider
  id: string
  ids: string[]
  status: 'available' | 'login_required' | 'unavailable'
}

const providerConfig = {
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

const loginWindows = new Map<MusicAccountProvider, Electron.BrowserWindow>()
let qqDailyKeyWindow: BrowserWindow | null = null
let qqDailyKeyTask: Promise<QQDailyKeySaveResult> | null = null
const qqDailyKeyStoreName = 'music_account_credentials'
const qqDailyKeyStoreField = 'qqDailyApiKey'
const qqDailyKeyPage = 'https://y.qq.com/n/ryqq_v2/qqmusic_skills'
const neteaseIv = Buffer.from('0102030405060708')
const neteasePresetKey = Buffer.from('0CoJUm6Qyw8W8jud')
const neteaseBase62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const neteasePublicKey = '-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB\n-----END PUBLIC KEY-----'

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

const isAllowedHost = (provider: MusicAccountProvider, target: string) => {
  if (target == 'about:blank') return true
  try {
    const hostname = new URL(target).hostname
    return providerConfig[provider].domains.some(domain => hostname == domain || hostname.endsWith(`.${domain}`))
  } catch {
    return false
  }
}

const hasLoginCookie = async(provider: MusicAccountProvider) => {
  const cookies = await session.fromPartition(providerConfig[provider].partition).cookies.get({})
  const names = new Set(cookies.map(cookie => cookie.name.toLowerCase()))
  if (provider == 'wy') return names.has('music_u') || names.has('music_a')
  const hasIdentifier = names.has('uin') || names.has('qqmusic_uin') || names.has('musicid') || names.has('wxopenid')
  const hasMusicKey = names.has('qqmusic_key') || names.has('qm_keyst') || names.has('musickey')
  return hasIdentifier && hasMusicKey
}

const getQQAccountCredentials = async() => {
  const accountSession = session.fromPartition(providerConfig.tx.partition)
  const cookies = await accountSession.cookies.get({})
  const cookieMap = new Map(cookies.map(cookie => [cookie.name.toLowerCase(), cookie.value]))
  const rawUin = cookieMap.get('uin') ?? cookieMap.get('qqmusic_uin') ?? cookieMap.get('musicid') ?? ''
  return {
    accountSession,
    uin: rawUin.replace(/\D/g, '').replace(/^0+/, '') || '0',
    authst: cookieMap.get('qm_keyst') ?? cookieMap.get('qqmusic_key') ?? cookieMap.get('musickey') ?? '',
  }
}

const getQQEncryptedUin = async() => {
  const { accountSession, uin } = await getQQAccountCredentials()
  if (uin == '0') return ''
  try {
    const url = new URL('https://c6.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg')
    url.search = new URLSearchParams({ ct: '20', cv: '4747474', cid: '205360838', userid: uin }).toString()
    const response = await accountSession.fetch(url.toString(), {
      headers: { Referer: 'https://y.qq.com/' },
    })
    if (!response.ok) return ''
    const result = await response.json() as { data?: { creator?: { encrypt_uin?: string } } }
    return result.data?.creator?.encrypt_uin ?? ''
  } catch {
    return ''
  }
}

const requestQQMusicU = async<T>(requests: Record<string, unknown>): Promise<T> => {
  const { accountSession, uin, authst } = await getQQAccountCredentials()
  const response = await accountSession.fetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      Origin: 'https://y.qq.com',
      Referer: 'https://y.qq.com/',
    },
    body: JSON.stringify({
      comm: { uin, format: 'json', ct: 24, cv: 0, authst },
      ...requests,
    }),
  })
  if (!response.ok) throw new Error(`QQ Music account request failed: ${response.status}`)
  return response.json() as Promise<T>
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
  contents.setUserAgent(getCompatibleUserAgent(contents.getUserAgent()))
  contents.setWindowOpenHandler(({ url }) => {
    if (!isAllowedHost(provider, url)) {
      void shell.openExternal(url)
      return { action: 'deny' }
    }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 520,
        height: 720,
        minWidth: 420,
        minHeight: 560,
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
  contents.on('will-navigate', (event, url) => {
    if (isAllowedHost(provider, url)) return
    event.preventDefault()
    void shell.openExternal(url)
  })
  contents.on('did-create-window', childWindow => {
    childWindow.setMenuBarVisibility(false)
    onChildWindow?.(childWindow)
    configureLoginContents(childWindow.webContents, provider, accountSession, onChildWindow)
  })
}

export const getMusicAccountStatus = async(): Promise<MusicAccountStatus> => ({
  tx: await hasLoginCookie('tx'),
  wy: await hasLoginCookie('wy'),
})

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
    const accountSession = session.fromPartition(providerConfig.tx.partition)
    const proxy = getProxy()
    await accountSession.setProxy(proxy?.host
      ? { mode: 'fixed_servers', proxyRules: `http://${proxy.host}:${proxy.port}` }
      : { mode: 'direct' })

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
  const accountSession = session.fromPartition(providerConfig.tx.partition)
  const cookies = await accountSession.cookies.get({})
  const cookieMap = new Map(cookies.map(cookie => [cookie.name.toLowerCase(), cookie.value]))
  const rawUin = cookieMap.get('uin') ?? cookieMap.get('qqmusic_uin') ?? cookieMap.get('musicid') ?? ''
  const uin = rawUin.replace(/\D/g, '').replace(/^0+/, '') || '0'
  const authst = cookieMap.get('qm_keyst') ?? cookieMap.get('qqmusic_key') ?? cookieMap.get('musickey') ?? ''
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
        comm: { uin, format: 'json', ct: 19, cv: 0, authst },
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

const requestNeteaseWeapi = async<T>(path: string, data: Record<string, unknown>): Promise<T> => {
  const accountSession = session.fromPartition(providerConfig.wy.partition)
  const csrfToken = await getNeteaseCsrfToken(accountSession)
  const response = await accountSession.fetch(`https://music.163.com${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: 'https://music.163.com',
      Referer: 'https://music.163.com/',
    },
    body: buildNeteaseWeapiForm({ ...data, csrf_token: csrfToken }),
  })
  if (!response.ok) throw new Error(`NetEase request failed (${path}): ${response.status}`)
  return response.json() as Promise<T>
}

const getNeteaseDailySongIds = async(): Promise<string[]> => {
  const result = await requestNeteaseWeapi<{ code?: number, data?: { dailySongs?: Array<{ id?: string | number }> } }>(
    '/weapi/v3/discovery/recommend/songs',
    { offset: 0, total: true, limit: 30 },
  )
  if (result.code != 200) return []
  return (result.data?.dailySongs ?? []).map(item => String(item.id ?? '')).filter(Boolean)
}

const getNeteaseUserId = async(): Promise<string> => {
  const result = await requestNeteaseWeapi<{
    code?: number
    profile?: { userId?: string | number }
    account?: { id?: string | number }
  }>('/weapi/w/nuser/account/get', {})
  return String(result.profile?.userId ?? result.account?.id ?? '')
}

export const getMusicAccountPlaylists = async(provider: MusicAccountProvider): Promise<MusicAccountPlaylistsResult> => {
  if (!await hasLoginCookie(provider)) return { provider, playlists: [], status: 'login_required' }
  try {
    if (provider == 'tx') {
      const { uin } = await getQQAccountCredentials()
      const result = await requestQQMusicU<{
        created?: { code?: number, data?: { v_playlist?: Array<Record<string, unknown>> } }
        favorite?: { code?: number, data?: { v_list?: Array<Record<string, unknown>>, v_playlist?: Array<Record<string, unknown>> } }
      }>({
        created: {
          module: 'music.musicasset.PlaylistBaseRead',
          method: 'GetPlaylistByUin',
          param: { uin },
        },
        favorite: {
          module: 'music.musicasset.PlaylistBaseRead',
          method: 'GetFavPlaylistByUin',
          param: { uin, page: 1, size: 100 },
        },
      })
      const normalize = (items: Array<Record<string, unknown>>, kind: MusicAccountPlaylist['kind']) => items.map(item => {
        const dissId = [item.tid, item.id, item.dissid]
          .map(value => String(value ?? ''))
          .find(value => value && value != '0') ?? ''
        const dirId = String(item.dirId ?? '')
        return {
          id: dissId && dissId != '0' ? dissId : dirId ? `dir:${dirId}` : '',
          name: String(item.dirName ?? item.title ?? item.dissname ?? item.name ?? ''),
          cover: String(item.picUrl ?? item.bigpicUrl ?? item.picurl ?? ''),
          trackCount: Number(item.songNum ?? item.song_cnt ?? item.songnum ?? 0),
          creator: '',
          kind,
        }
      }).filter(item => item.id && item.name)
      const created = normalize(result.created?.data?.v_playlist ?? [], 'created')
      const favorite = normalize(result.favorite?.data?.v_list ?? result.favorite?.data?.v_playlist ?? [], 'favorite')
      const playlistMap = new Map([...created, ...favorite].map(item => [item.id, item]))
      const playlists = [...playlistMap.values()]
      return { provider, playlists, status: playlists.length ? 'available' : 'unavailable' }
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
    return { provider, playlists, status: playlists.length ? 'available' : 'unavailable' }
  } catch (error) {
    console.warn(`[musicAccount] ${provider} playlists unavailable`, error)
    return { provider, playlists: [], status: 'unavailable' }
  }
}

export const getMusicAccountPlaylistDetail = async(
  provider: MusicAccountProvider,
  id: string,
): Promise<MusicAccountPlaylistDetailResult> => {
  if (!await hasLoginCookie(provider)) return { provider, id, ids: [], status: 'login_required' }
  try {
    if (provider == 'tx') {
      const dirMatch = /^dir:(\d+)$/.exec(id)
      const dirId = dirMatch ? Number(dirMatch[1]) : id == '0' ? 201 : 0
      const dissId = dirId ? 0 : Number(id)
      const apiKey = dirId ? '' : readQQDailyApiKey()
      if (apiKey && Number.isFinite(dissId)) {
        const ids: string[] = []
        for (let page = 0; page < 100; page++) {
          const response = await session.fromPartition(providerConfig.tx.partition).fetch('https://a.y.qq.com/playlists/detail', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ params: { dissId, page }, comm: { skill_version: '0.0.3' } }),
          })
          if (!response.ok) break
          const result = await response.json() as {
            ret?: number
            sub_ret?: number
            trackList?: Array<{ songMid?: string }>
            hasMore?: boolean
          }
          if ((result.ret != null && result.ret != 0) || (result.sub_ret != null && result.sub_ret != 0)) break
          ids.push(...(result.trackList ?? []).map(item => item.songMid ?? '').filter(Boolean))
          if (!result.hasMore || !result.trackList?.length) break
        }
        if (ids.length) return { provider, id, ids: [...new Set(ids)], status: 'available' }
      }

      if (!dirId && !Number.isFinite(dissId)) return { provider, id, ids: [], status: 'unavailable' }
      const encryptedUin = dirId ? await getQQEncryptedUin() : ''
      const ids: string[] = []
      const pageSize = 500
      for (let offset = 0; offset < 100000; offset += pageSize) {
        const result = await requestQQMusicU<{
          detail?: {
            code?: number
            data?: {
              songlist?: Array<Record<string, unknown>>
              total_song_num?: number
              songnum?: number
              totalnum?: number
              hasmore?: number
            }
          }
        }>({
          detail: {
            module: 'music.srfDissInfo.DissInfo',
            method: 'CgiGetDiss',
            param: {
              disstid: dissId,
              dirid: dirId,
              tag: 1,
              song_begin: offset,
              song_num: pageSize,
              userinfo: 1,
              orderlist: 1,
              ...(encryptedUin ? { enc_host_uin: encryptedUin } : {}),
            },
          },
        })
        const data = result.detail?.data
        const songs = data?.songlist ?? []
        ids.push(...songs.map(item => {
          const track = (item.track_info ?? item) as Record<string, unknown>
          return String(track.mid ?? track.songmid ?? '')
        }).filter(Boolean))
        const total = Number(data?.total_song_num ?? data?.songnum ?? data?.totalnum ?? 0)
        if (!songs.length || data?.hasmore == 0 || (total > 0 && offset + songs.length >= total)) break
      }
      return { provider, id, ids: [...new Set(ids)], status: ids.length ? 'available' : 'unavailable' }
    }

    const result = await requestNeteaseWeapi<{
      code?: number
      playlist?: { trackIds?: Array<{ id?: string | number }> }
    }>('/weapi/v6/playlist/detail', { id, n: 100000, s: 8 })
    const ids = (result.playlist?.trackIds ?? []).map(item => String(item.id ?? '')).filter(Boolean)
    return { provider, id, ids, status: ids.length ? 'available' : 'unavailable' }
  } catch (error) {
    console.warn(`[musicAccount] ${provider} playlist detail unavailable`, error)
    return { provider, id, ids: [], status: 'unavailable' }
  }
}

export const getMusicAccountDailySongIds = async(provider: MusicAccountProvider): Promise<MusicAccountDailyResult> => {
  if (!await hasLoginCookie(provider)) return { provider, ids: [], status: 'login_required' }
  try {
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
  const existingWindow = loginWindows.get(provider)
  if (existingWindow && !existingWindow.isDestroyed()) {
    existingWindow.show()
    existingWindow.focus()
    return { provider, status: await hasLoginCookie(provider) ? 'connected' : 'cancelled' }
  }

  if (await hasLoginCookie(provider)) return { provider, status: 'connected' }

  const config = providerConfig[provider]
  const accountSession = session.fromPartition(config.partition)
  const proxy = getProxy()
  await accountSession.setProxy(proxy?.host
    ? { mode: 'fixed_servers', proxyRules: `http://${proxy.host}:${proxy.port}` }
    : { mode: 'direct' })

  return new Promise(resolve => {
    const parent = BrowserWindow.getFocusedWindow() ?? undefined
    const loginWindow = new BrowserWindow({
      parent,
      modal: !!parent,
      width: 520,
      height: 720,
      minWidth: 420,
      minHeight: 560,
      show: false,
      autoHideMenuBar: true,
      title: config.title,
      backgroundColor: '#f7faf8',
      webPreferences: {
        session: accountSession,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        spellcheck: false,
      },
    })
    loginWindows.set(provider, loginWindow)

    let settled = false
    let checkingLogin = false
    let cookieTimer: NodeJS.Timeout | undefined
    const childWindows = new Set<BrowserWindow>()
    const handleChildWindow = (childWindow: BrowserWindow) => {
      childWindows.add(childWindow)
      childWindow.once('closed', () => { childWindows.delete(childWindow) })
    }
    const checkLogin = () => {
      if (settled || checkingLogin) return
      checkingLogin = true
      void hasLoginCookie(provider).then(connected => {
        if (connected) finish('connected')
      }).finally(() => {
        checkingLogin = false
      })
    }
    const handleCookieChanged = () => { checkLogin() }
    const finish = (status: MusicAccountLoginResult['status']) => {
      if (settled) return
      settled = true
      if (cookieTimer) clearInterval(cookieTimer)
      accountSession.cookies.off('changed', handleCookieChanged)
      loginWindows.delete(provider)
      resolve({ provider, status })
      for (const childWindow of childWindows) {
        if (!childWindow.isDestroyed()) childWindow.close()
      }
      if (!loginWindow.isDestroyed()) loginWindow.close()
    }

    configureLoginContents(loginWindow.webContents, provider, accountSession, handleChildWindow)
    accountSession.cookies.on('changed', handleCookieChanged)
    cookieTimer = setInterval(checkLogin, 1200)
    loginWindow.once('ready-to-show', () => { loginWindow.show() })
    loginWindow.on('closed', () => { finish('cancelled') })
    void loginWindow.loadURL(config.loginUrl)
  })
}
