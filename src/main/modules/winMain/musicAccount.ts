import { BrowserWindow, session, shell, type Session, type WebContents } from 'electron'
import { getProxy } from '@main/utils'
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

const getQQDailySongIds = async(): Promise<string[]> => {
  const accountSession = session.fromPartition(providerConfig.tx.partition)
  const cookies = await accountSession.cookies.get({})
  const cookieMap = new Map(cookies.map(cookie => [cookie.name.toLowerCase(), cookie.value]))
  const rawUin = cookieMap.get('uin') ?? cookieMap.get('qqmusic_uin') ?? cookieMap.get('musicid') ?? ''
  const uin = rawUin.replace(/\D/g, '').replace(/^0+/, '') || '0'
  const authst = cookieMap.get('qm_keyst') ?? cookieMap.get('qqmusic_key') ?? cookieMap.get('musickey') ?? ''
  const ids = new Set<string>()

  for (let index = 0; index < 6 && ids.size < 30; index++) {
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
          module: 'music.radioProxy.MbTrackRadioSvr',
          method: 'get_radio_track',
          param: {},
        },
      }),
    })
    if (!response.ok) throw new Error(`QQ Music recommendations failed: ${response.status}`)
    const result = await response.json() as {
      radio?: { code?: number, data?: Record<string, unknown> }
    }
    if (result.radio?.code != 0) break
    const data = result.radio.data ?? {}
    const candidates = [data.tracks, data.track, data.songList, data.vec_song]
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

const getNeteaseDailySongIds = async(): Promise<string[]> => {
  const accountSession = session.fromPartition(providerConfig.wy.partition)
  const cookies = await accountSession.cookies.get({ url: 'https://music.163.com' })
  const csrfToken = cookies.find(cookie => cookie.name == '__csrf')?.value ?? ''
  const response = await accountSession.fetch('https://music.163.com/weapi/v3/discovery/recommend/songs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: 'https://music.163.com',
      Referer: 'https://music.163.com/',
    },
    body: buildNeteaseWeapiForm({ offset: 0, total: true, limit: 30, csrf_token: csrfToken }),
  })
  if (!response.ok) throw new Error(`NetEase daily recommendations failed: ${response.status}`)
  const result = await response.json() as { code?: number, data?: { dailySongs?: Array<{ id?: string | number }> } }
  if (result.code != 200) return []
  return (result.data?.dailySongs ?? []).map(item => String(item.id ?? '')).filter(Boolean)
}

export const getMusicAccountDailySongIds = async(provider: MusicAccountProvider): Promise<MusicAccountDailyResult> => {
  if (!await hasLoginCookie(provider)) return { provider, ids: [], status: 'login_required' }
  try {
    const ids = provider == 'tx' ? await getQQDailySongIds() : await getNeteaseDailySongIds()
    return { provider, ids, status: ids.length ? 'personalized' : 'unavailable' }
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
