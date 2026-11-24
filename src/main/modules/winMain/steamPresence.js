import { app, safeStorage } from 'electron'
import getStore from '@main/utils/store'
import QRCode from 'qrcode'

let login, client
let enabled = false
let connected = false
let blocked = false
let qr = ''
let status = 'steam_sign_in'
let desired = ''
let sent
const store = () => getStore('steamPresence')
const saved = () => store().get('session')
const mayStore = () => safeStorage.isEncryptionAvailable() && !(process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')
const snapshot = () => ({ status, qr })
const stop = () => {
  const previous = client
  client = null
  login?.cancelLoginAttempt()
  login = null
  qr = ''
  if (connected && !blocked) previous?.gamesPlayed([])
  previous?.logOff()
  connected = blocked = false
  sent = undefined
}
app.once('before-quit', stop)

function publish() {
  if (!client || !connected || blocked || sent === desired) return
  client.gamesPlayed(desired ? [desired] : [])
  sent = desired
}

async function connect(token) {
  const { default: SteamUser } = await import('steam-user')
  if (!enabled || client || token !== currentToken) return
  const next = client = new SteamUser({ dataDirectory: null, autoRelogin: true, renewRefreshTokens: false })
  status = 'receiver_connecting'
  next.on('loggedOn', () => {
    if (client !== next) return
    connected = true
    blocked = !!next.playingState?.blocked
    status = blocked ? 'steam_game_active' : 'receiver_connected'
    next.setPersona(SteamUser.EPersonaState.Online)
    publish()
  })
  next.on('playingState', occupied => {
    if (client !== next) return
    blocked = occupied
    sent = undefined
    status = occupied ? 'steam_game_active' : 'receiver_connected'
    publish()
  })
  next.on('disconnected', () => {
    if (client !== next) return
    connected = false
    sent = undefined
    status = 'receiver_retry'
  })
  next.on('error', () => {
    if (client !== next) return
    stop()
    status = 'steam_failed'
  })
  next.logOn({ refreshToken: token, logonID: 0x514d5553 })
}

let currentToken = ''
let generation = 0
export async function steamCommand({ action, text }) {
  if (action === 'status') return snapshot()
  if (action === 'activity') {
    desired = ''
    for (const letter of String(text || '').slice(0, 200)) {
      if (Buffer.byteLength(desired + letter) > 63) break
      desired += letter
    }
    publish()
    return snapshot()
  }
  if (action === 'disable' || action === 'logout') {
    enabled = action === 'logout'
    generation++
    stop()
    desired = currentToken = ''
    if (action === 'logout') store().set('session', '')
    status = 'steam_sign_in'
    return snapshot()
  }
  if (action === 'enable') {
    enabled = true
    const encrypted = saved()
    if (encrypted && !client) {
      try {
        currentToken = safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
        await connect(currentToken)
      } catch { status = 'steam_failed' }
    }
    return snapshot()
  }
  if (!enabled || action !== 'login') throw Error('steam_command')
  stop()
  const version = ++generation
  const { LoginSession, EAuthTokenPlatformType } = await import('steam-session')
  if (!enabled || version !== generation) return snapshot()
  const attempt = login = new LoginSession(EAuthTokenPlatformType.SteamClient, { machineFriendlyName: 'Q-music' })
  status = 'receiver_connecting'
  const failed = () => {
    if (version !== generation) return
    stop()
    status = 'steam_failed'
  }
  attempt.once('timeout', failed)
  attempt.on('error', failed)
  attempt.once('authenticated', () => {
    if (version !== generation || attempt !== login) return
    login = null
    qr = ''
    currentToken = attempt.refreshToken
    try {
      if (mayStore()) store().set('session', safeStorage.encryptString(currentToken).toString('base64'))
    } catch { /* 系统密钥环不可用时，本次登录仍可使用。 */ }
    connect(currentToken).catch(failed)
  })
  try {
    const { qrChallengeUrl } = await attempt.startWithQR()
    if (version === generation && login === attempt) {
      const image = await QRCode.toDataURL(qrChallengeUrl, { width: 220, margin: 2 })
      if (login === attempt) { qr = image; status = 'steam_scan' }
    } else attempt.cancelLoginAttempt()
  } catch { failed() }
  return snapshot()
}
