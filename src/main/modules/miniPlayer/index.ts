import path from 'node:path'
import { BrowserWindow } from 'electron'

let current: { window: BrowserWindow, closed: Promise<void> } | null = null
const fields = ['status', 'name', 'singer', 'lyricLineText', 'picUrl'] as const

export const openMiniPlayer = async(owner: Electron.WebContents, labels: Record<string, string>, control: (action: LX.Player.StatusButtonActions) => void) => {
  if (current) {
    current.window.show()
    return current.closed
  }
  const view = path.join(__dirname, 'miniPlayer')
  const win = new BrowserWindow({
    width: 380,
    height: 176,
    minWidth: 280,
    minHeight: 150,
    useContentSize: true,
    show: false,
    autoHideMenuBar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    backgroundColor: '#202421',
    title: labels.title,
    webPreferences: { preload: path.join(view, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, partition: 'q-music-mini-player' },
  })
  win.removeMenu()
  const update = (changes: Partial<LX.Player.Status>) => {
    if (fields.some(key => changes[key] !== undefined)) {
      const state = Object.fromEntries(fields.map(key => [key, global.lx.player_status[key]]))
      win.webContents.send('mini-player-state', state)
    }
  }
  win.webContents.ipc.on('mini-player-control', (event, action: unknown) => {
    if (event.senderFrame !== win.webContents.mainFrame) return
    if (action === 'prev' || action === 'next' || action === 'play' || action === 'pause') control(action)
  })
  const close = () => { win.close() }
  const closed = new Promise<void>(resolve => win.once('closed', () => {
    global.lx.event_app.off('player_status', update)
    owner.off('destroyed', close)
    owner.off('render-process-gone', close)
    current = null
    resolve()
  }))
  current = { window: win, closed }
  owner.once('destroyed', close)
  owner.once('render-process-gone', close)
  win.webContents.once('did-finish-load', () => {
    win.webContents.send('mini-player-labels', labels)
    global.lx.event_app.on('player_status', update)
    update(global.lx.player_status)
    win.showInactive()
  })
  void win.loadFile(path.join(view, 'index.html')).catch(() => { if (!win.isDestroyed()) close() })
  return closed
}
