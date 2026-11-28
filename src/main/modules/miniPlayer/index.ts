import path from 'node:path'
import { BrowserWindow, screen } from 'electron'

let current: { window: BrowserWindow, capsule: boolean, closed: Promise<void> } | null = null
const fields = ['status', 'name', 'singer', 'lyricLineText', 'picUrl'] as const

export const openMiniPlayer = async(owner: Electron.WebContents, labels: Record<string, string>, control: (action: LX.Player.StatusButtonActions) => void, capsule = false) => {
  if (current?.capsule === capsule) {
    if (current.window.isMinimized()) current.window.restore()
    current.window.show()
    return current.closed
  }
  current?.window.destroy()
  const view = path.join(__dirname, 'miniPlayer')
  const bounds = BrowserWindow.fromWebContents(owner)?.getBounds()
  const { workArea } = bounds ? screen.getDisplayMatching(bounds) : screen.getPrimaryDisplay()
  const capsuleWidth = Math.min(450, workArea.width)
  const win = new BrowserWindow({
    ...(capsule ? {
      width: capsuleWidth,
      height: 58,
      x: workArea.x + Math.round((workArea.width - capsuleWidth) / 2),
      y: workArea.y + 18,
      resizable: false,
      transparent: true,
      hasShadow: false,
      roundedCorners: false,
      thickFrame: false,
    } : { width: 380, height: 176, minWidth: 280, minHeight: 150 }),
    frame: false,
    useContentSize: true,
    show: false,
    autoHideMenuBar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    backgroundColor: capsule ? '#00000000' : '#202421',
    title: labels.title,
    webPreferences: { preload: path.join(view, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, partition: 'q-music-mini-player' },
  })
  win.removeMenu()
  const sendAppearance = () => {
    win.webContents.send('mini-player-appearance', {
      motion: global.lx.appSetting['common.isShowAnimation'] && !global.lx.appSetting['common.performanceMode'],
      performanceMode: global.lx.appSetting['common.performanceMode'],
    })
  }
  const handleSettings = (keys: Array<keyof LX.AppSetting>) => {
    if (keys.includes('common.isShowAnimation') || keys.includes('common.performanceMode')) sendAppearance()
  }
  const update = (changes: Partial<LX.Player.Status>) => {
    if (fields.some(key => changes[key] !== undefined) || (capsule && changes.lyricLineWords !== undefined)) {
      const state = Object.fromEntries(fields.map(key => [key, global.lx.player_status[key]]))
      if (capsule) Object.assign(state, { words: global.lx.player_status.lyricLineWords, progress: global.lx.player_status.progress, rate: global.lx.player_status.playbackRate })
      win.webContents.send('mini-player-state', state)
    } else if (capsule && (changes.progress !== undefined || changes.playbackRate !== undefined)) {
      win.webContents.send('mini-player-clock', global.lx.player_status.progress, global.lx.player_status.playbackRate)
    }
  }
  win.webContents.ipc.on('mini-player-control', (event, action: unknown) => {
    if (event.senderFrame !== win.webContents.mainFrame) return
    if (action === 'close') { win.close(); return }
    if (action === 'minimize' && !capsule) { win.minimize(); return }
    if (action === 'prev' || action === 'next' || action === 'play' || action === 'pause') control(action)
  })
  const close = () => { win.close() }
  const closed = new Promise<void>(resolve => win.once('closed', () => {
    global.lx.event_app.off('player_status', update)
    global.lx.event_app.off('updated_config', handleSettings)
    owner.off('destroyed', close)
    owner.off('render-process-gone', close)
    if (current?.window === win) current = null
    resolve()
  }))
  current = { window: win, capsule, closed }
  owner.once('destroyed', close)
  owner.once('render-process-gone', close)
  win.webContents.once('did-finish-load', () => {
    win.webContents.send('mini-player-labels', labels)
    sendAppearance()
    global.lx.event_app.on('player_status', update)
    global.lx.event_app.on('updated_config', handleSettings)
    update(global.lx.player_status)
    win.showInactive()
    if (capsule && process.platform === 'win32') win.setAlwaysOnTop(true, 'pop-up-menu')
  })
  void win.loadFile(path.join(view, 'index.html'), { query: { mode: capsule ? 'capsule' : 'mini' } }).catch(() => { if (!win.isDestroyed()) close() })
  return closed
}
