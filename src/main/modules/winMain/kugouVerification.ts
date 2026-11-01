import { BrowserWindow } from 'electron'
import { constants, createCipheriv, createHash, publicEncrypt, randomBytes } from 'node:crypto'
import { KUGOU_VERIFY_PUBLIC_KEY, createKugouCaptchaHtml, parseKugouCaptchaMessage } from '@common/utils/kugouVerification'
import type { KugouCaptchaAnswer } from '@common/utils/kugouAccount'

export const encryptKugouVerification = async() => {
  const key = randomBytes(8).toString('hex')
  const aesKey = createHash('md5').update(key).digest('hex')
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(aesKey), Buffer.from(aesKey.slice(-16)))
  const padded = Buffer.alloc(128)
  padded.write(JSON.stringify({ key }), 'utf8')
  return {
    pk: publicEncrypt({ key: KUGOU_VERIFY_PUBLIC_KEY, padding: constants.RSA_NO_PADDING }, padded).toString('hex'),
    params: Buffer.concat([cipher.update('{}'), cipher.final()]).toString('hex'),
  }
}

let active: BrowserWindow | undefined
export const presentKugouCaptcha = async(appId: string): Promise<KugouCaptchaAnswer> => {
  if (active && !active.isDestroyed()) { active.focus(); return Promise.reject(new Error('verification_failed')) }
  const html = createKugouCaptchaHtml(appId)
  return new Promise((resolve, reject) => {
    const parent = BrowserWindow.getFocusedWindow() ?? undefined
    const window = new BrowserWindow({ parent, modal: !!parent, width: 440, height: 620, minWidth: 360, minHeight: 480, show: false, autoHideMenuBar: true, title: '酷狗安全验证', backgroundColor: '#f8fafb', webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, spellcheck: false } })
    active = window
    let settled = false
    const finish = (answer?: KugouCaptchaAnswer, reason = 'verification_cancelled') => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      active = undefined
      if (answer) resolve(answer)
      else reject(new Error(reason))
      if (!window.isDestroyed()) window.close()
    }
    const timer = setTimeout(() => { finish(undefined, 'verification_expired') }, 5 * 60_000)
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('qmusic-captcha://result?')) {
        try {
          const answer = parseKugouCaptchaMessage(new URL(url).searchParams.get('data') ?? '')
          if (answer) finish(answer)
        } catch { finish(undefined, 'verification_failed') }
      }
      return { action: 'deny' }
    })
    window.webContents.on('will-navigate', event => { event.preventDefault() })
    window.webContents.on('will-attach-webview', event => { event.preventDefault() })
    window.once('closed', () => { finish() })
    window.once('ready-to-show', () => { window.show(); window.focus() })
    void window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).catch(() => { finish(undefined, 'verification_failed') })
  })
}
