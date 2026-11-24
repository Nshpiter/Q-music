import { app, BrowserWindow, nativeTheme, screen } from 'electron'
import path from 'node:path'

// 使用工作区与显示器的实际边界定位。自动隐藏任务栏没有可用区域时同步收起。
export const taskbarBounds = ({ bounds, workArea }: Electron.Display, position: number): Electron.Rectangle | null => {
  const along = Math.max(0, Math.min(100, position)) / 100
  const top = workArea.y - bounds.y
  const bottom = bounds.y + bounds.height - workArea.y - workArea.height
  const left = workArea.x - bounds.x
  const right = bounds.x + bounds.width - workArea.x - workArea.width
  const edge = Math.max(top, bottom, left, right)
  if (edge < 18 || edge > 160) return null
  if (edge === top || edge === bottom) {
    const width = Math.min(260, Math.round(bounds.width / 4))
    const height = Math.min(42, edge)
    return { width, height, x: bounds.x + Math.round((bounds.width - width) * along), y: (edge === top ? bounds.y : workArea.y + workArea.height) + Math.floor((edge - height) / 2) }
  }
  const height = Math.min(220, Math.round(bounds.height / 4))
  return { width: edge, height, x: edge === left ? bounds.x : workArea.x + workArea.width, y: bounds.y + Math.round((bounds.height - height) * along) }
}

export function setupTaskbarLyrics() {
  if (process.platform !== 'win32') return
  let win: BrowserWindow | null = null
  let ready = false
  let fullscreen = false
  const close = () => {
    if (win && !win.isDestroyed()) win.destroy()
    win = null
  }
  const update = () => {
    if (!ready || !global.lx.appSetting['desktopLyric.taskbar']) { close(); return }
    const bounds = taskbarBounds(screen.getPrimaryDisplay(), global.lx.appSetting['desktopLyric.taskbarPosition'])
    const state = global.lx.player_status
    if (!bounds || fullscreen || state.status !== 'playing' || !state.name) { win?.hide(); return }
    if (!win) {
      const view = path.join(__dirname, 'taskbarLyrics')
      const window = new BrowserWindow({
        ...bounds,
        title: 'Q-music · Taskbar Lyrics',
        show: false,
        frame: false,
        transparent: true,
        focusable: false,
        skipTaskbar: true,
        hasShadow: false,
        resizable: false,
        roundedCorners: false,
        webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, preload: path.join(view, 'preload.cjs') },
      })
      win = window
      window.once('closed', () => { if (win === window) win = null })
      window.setMenu(null)
      window.setIgnoreMouseEvents(true)
      window.setAlwaysOnTop(true, 'pop-up-menu')
      window.webContents.once('did-finish-load', update)
      void window.loadFile(path.join(view, 'index.html')).catch(() => { if (win === window) close() })
      return
    }
    if (win.isDestroyed() || win.webContents.isDestroyed() || win.webContents.isLoadingMainFrame()) return
    const current = win.getBounds()
    if (current.x !== bounds.x || current.y !== bounds.y || current.height !== bounds.height || current.width !== bounds.width) win.setBounds(bounds)
    win.webContents.send('taskbar-lyric', state.lyricLineText || state.name, state.lyricLineWords, nativeTheme.shouldUseDarkColorsForSystemIntegratedUI, bounds.height > bounds.width, state.progress, state.playbackRate)
    if (!win.isVisible()) win.showInactive()
  }
  global.lx.event_app.on('main_window_inited', () => { ready = true; update() })
  global.lx.event_app.on('main_window_fullscreen', value => { fullscreen = value; update() })
  global.lx.event_app.on('main_window_close', () => { ready = false; close() })
  app.once('before-quit', () => { ready = false; close() })
  global.lx.event_app.on('updated_config', keys => {
    if (keys.includes('desktopLyric.taskbar') || keys.includes('desktopLyric.taskbarPosition')) update()
  })
  global.lx.event_app.on('player_status', change => {
    if (change.status != null || change.lyricLineText != null || change.lyricLineWords != null || change.name != null) update()
    else if (win && !win.isDestroyed() && !win.webContents.isDestroyed() && win.isVisible() && (change.progress != null || change.playbackRate != null)) {
      win.webContents.send('taskbar-clock', global.lx.player_status.progress, global.lx.player_status.playbackRate)
    }
  })
  screen.on('display-metrics-changed', update)
  screen.on('display-added', update)
  screen.on('display-removed', update)
  nativeTheme.on('updated', update)
}
