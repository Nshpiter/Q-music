import { BrowserWindow, safeStorage, session } from 'electron'
import { createHash } from 'node:crypto'
import getStore from '@main/utils/store'
import { getProxy } from '@main/utils'
import { createKugouApi, parseKugouSession, type KugouSession, type KugouQr } from '@common/utils/kugouAccount'
import { createKugouFavoriteClient } from '@common/utils/kugouFavorite'
import { encryptKugouVerification, presentKugouCaptcha } from './kugouVerification'

const storeName = 'music_account_credentials'
const storeField = 'kugouSession'
const accountSession = () => session.fromPartition('persist:qmusic-account-kugou')
const api = createKugouApi(async(url, init) => accountSession().fetch(url, init), value => createHash('md5').update(value).digest('hex'), encryptKugouVerification)
export const readKugouSession = (): KugouSession | null => {
  try {
    const value = getStore(storeName).get<string>(storeField)
    if (!value || !safeStorage.isEncryptionAvailable()) return null
    return parseKugouSession(JSON.parse(safeStorage.decryptString(Buffer.from(value, 'base64'))))
  } catch { return null }
}
let loginWindow: BrowserWindow | null = null
let loginTask: Promise<'connected' | 'cancelled'> | null = null
export const logoutKugou = () => {
  loginWindow?.close()
  getStore(storeName).set(storeField, '')
}
const configureProxy = async() => {
  const proxy = getProxy()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      accountSession().setProxy(proxy?.host ? { mode: 'fixed_servers', proxyRules: `http://${proxy.host}:${proxy.port}` } : { mode: 'system' }),
      new Promise<never>((resolve, reject) => { timer = setTimeout(() => { reject(new Error('unavailable')) }, 12_000) }),
    ])
  } finally { clearTimeout(timer) }
}
const requireSession = () => readKugouSession() ?? (() => { throw new Error('login_required') })()
const assertSession = (before: KugouSession) => {
  const after = readKugouSession()
  if (!after || after.userId != before.userId || after.token != before.token) throw new Error('login_required')
}
export const addKugouFavoriteSong = createKugouFavoriteClient(async() => {
  const current = requireSession()
  await configureProxy()
  return {
    assertSession: async() => {
      const after = readKugouSession()
      if (!after || after.userId != current.userId || after.token != current.token) throw new Error('account_changed')
    },
    getFavorites: async() => api.getPlaylists(current),
    getHashes: async(id) => api.getPlaylistHashes(current, id),
    addSong: async(id, song) => api.addFavoriteSong(current, id, song),
    verifySession: async() => api.verifySession(current, presentKugouCaptcha, async() => { assertSession(current) }),
  }
})
export const getKugouPlaylists = async() => {
  const current = requireSession()
  await configureProxy()
  const lists = await api.getPlaylists(current)
  assertSession(current)
  return lists.map(item => ({ ...item, id: `account:${current.userId}:${item.id}`, trackCount: item.count, creator: current.nickname }))
}
export const getKugouDailyHashes = async() => {
  const current = requireSession()
  await configureProxy()
  const hashes = await api.getDailyHashes(current)
  assertSession(current)
  return hashes
}
export const getKugouPlaylistHashes = async(id: string) => {
  const current = requireSession()
  const match = /^account:(\d+):(\d+)$/.exec(id)
  if (!match || match[1] != current.userId) throw new Error('login_required')
  await configureProxy()
  const hashes = await api.getPlaylistHashes(current, match[2])
  assertSession(current)
  return hashes
}

// 登录页仅显示官方返回的二维码；网络、凭证和保存全部留在主进程。
const loginHtml = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<title>酷狗音乐登录</title><style>body{margin:0;padding:24px 20px;text-align:center;font:14px system-ui;color:#23302e;background:#f7faf8}h1{font-size:22px;margin:0 0 10px}img{width:240px;height:240px;max-width:100%;object-fit:contain;background:white;border-radius:16px}p{line-height:1.6;color:#53625e;margin:14px 0}button{border:0;border-radius:12px;padding:12px 24px;background:#def1e9;color:#235e4b;cursor:pointer}</style>
<h1>酷狗音乐登录</h1><p>使用酷狗音乐 App 扫码，在手机上确认授权</p><img id="qr" alt="正在获取登录二维码"><p id="status" role="status">正在获取二维码…</p><button onclick="window.open('about:blank#refresh')">刷新二维码</button><p>登录后可选择歌单导入 Q-music</p></html>`
export const openKugouLogin = async(): Promise<'connected' | 'cancelled'> => {
  if (loginTask && loginWindow && !loginWindow.isDestroyed()) { loginWindow.show(); loginWindow.focus(); return loginTask }
  if (!safeStorage.isEncryptionAvailable()) throw new Error('credential_storage')
  loginTask = new Promise(resolve => {
    const parent = BrowserWindow.getFocusedWindow() ?? undefined
    const window = new BrowserWindow({
      parent,
      modal: !!parent,
      width: 420,
      height: 600,
      resizable: false,
      show: false,
      autoHideMenuBar: true,
      title: '酷狗音乐登录',
      backgroundColor: '#f7faf8',
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, spellcheck: false },
    })
    loginWindow = window
    let controller: AbortController | undefined
    let timer: NodeJS.Timeout | undefined
    let generation = 0
    let settled = false
    const finish = (status: 'connected' | 'cancelled') => {
      if (settled) return
      settled = true
      generation++
      controller?.abort()
      clearTimeout(timer)
      loginWindow = null
      loginTask = null
      resolve(status)
      if (!window.isDestroyed()) window.close()
    }
    const display = async(message: string, image?: string) => {
      if (window.isDestroyed()) return
      const updateImage = image === undefined ? '' : image ? `document.getElementById('qr').src=${JSON.stringify(image)};` : "document.getElementById('qr').removeAttribute('src');"
      await window.webContents.executeJavaScript(`document.getElementById('status').textContent=${JSON.stringify(message)};${updateImage}`).catch(() => {})
    }
    const start = async() => {
      controller?.abort()
      clearTimeout(timer)
      const attempt = ++generation
      const abort = new AbortController()
      controller = abort
      await display('正在获取二维码…', '')
      let qr: KugouQr
      try {
        await configureProxy()
        if (attempt != generation || settled) return
        qr = await api.createQr(abort.signal)
      } catch {
        if (attempt == generation) await display('二维码加载失败，请点击刷新重试')
        return
      }
      if (attempt != generation || settled) return
      await display('请使用酷狗音乐 App 扫码', qr.image)
      const poll = async() => {
        if (attempt != generation || settled) return
        try {
          const result = await api.checkQr(qr, abort.signal)
          if (attempt != generation || settled) return
          if (result.status == 'expired') { await display('二维码已过期，请刷新'); return }
          if (result.session) {
            try { getStore(storeName).set(storeField, safeStorage.encryptString(JSON.stringify(result.session)).toString('base64')) } catch {
              await display('登录凭证保存失败，请检查本机存储后刷新重试')
              return
            }
            finish('connected')
            return
          }
          await display(result.status == 'scanned' ? '已扫码，请在酷狗音乐中确认授权' : '等待扫码…')
        } catch {
          if (attempt != generation || settled) return
          if (Date.now() >= qr.expiresAt) { await display('二维码已过期，请刷新'); return }
          await display('连接暂时失败，正在重试；也可刷新二维码')
        }
        if (attempt == generation && !settled) timer = setTimeout(() => { void poll() }, 2000)
      }
      void poll()
    }
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (url == 'about:blank#refresh') void start()
      return { action: 'deny' }
    })
    window.webContents.on('will-navigate', event => { event.preventDefault() })
    window.once('ready-to-show', () => { window.show(); window.focus() })
    window.once('closed', () => { finish('cancelled') })
    // 先显示可关闭、可重试的登录窗口，再初始化网络，避免网络等待时只剩主界面转圈。
    void window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(loginHtml)}`)
      .then(async() => { if (!settled) await start() }).catch(() => { finish('cancelled') })
  })
  return loginTask
}
