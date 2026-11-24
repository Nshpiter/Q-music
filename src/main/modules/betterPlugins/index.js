import { BrowserWindow, dialog, session, shell } from 'electron'
import { createHash, randomUUID } from 'node:crypto'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { readBetterPackage, pluginOrder } from '@common/utils/betterPackage'
import { loadCatalog, officialSource, githubSource, sourceRoot, downloadPluginTree } from './catalog'
import getStore from '@main/utils/store'
import { publicLyrics } from './neteaseLyrics'
import { mainSend } from '@common/mainIpc'
import { WIN_MAIN_RENDERER_EVENT_NAME } from '@common/ipcNames'

const windows = new Map()
const starting = new Map()
const windowDependencies = new Map()
const trackActions = new Map()
const suggestions = new Map()
const catalogCache = new Map()
const failures = new Map()
const packages = () => getStore('betterPlugins').get('installed') || []
const enabledIds = () => getStore('betterPlugins').get('autoStart') || []
const listing = () => {
  const enabled = new Set(enabledIds())
  return packages().map(({ id, name, version, editable }) => ({ id, name, version, editable: !!editable, enabled: enabled.has(id), error: failures.get(id) || '' }))
}
const folder = path.join(__dirname, 'betterPlugins')
const trackFields = ['songId', 'songSource', 'detailVisible', 'playMethod', 'name', 'singer', 'albumName', 'status', 'duration', 'progress', 'volume', 'mute', 'picUrl', 'lyric', 'tlyric', 'rlyric', 'lxlyric']
function trackChanges(state) {
  const values = Object.fromEntries(trackFields.filter(key => Object.hasOwn(state, key)).map(key => [key, state[key]]))
  if ('picUrl' in values && !/^https?:\/\//i.test(values.picUrl)) values.picUrl = ''
  return values
}
function track() {
  return trackChanges(global.lx.player_status)
}

async function openPlugin(owner, item, show = true, available = packages()) {
  const existing = windows.get(item.id)
  if (existing && !existing.isDestroyed()) {
    await starting.get(item.id)
    if (show && !existing.isDestroyed()) existing.show()
    return
  }
  const ordered = pluginOrder(item, available)
  const key = createHash('sha256').update(item.id).digest('hex')
  const partition = session.fromPartition('persist:qmusic-better-plugin-' + key)
  const local = new Set(['index.html', 'runtime.js', 'lyrics.js', 'files.js', 'react.js', 'react-dom.js'].map(file => pathToFileURL(path.join(folder, file)).href))
  partition.webRequest.onBeforeRequest((request, done) => done({ cancel: !local.has(request.url) }))
  partition.setPermissionCheckHandler(() => false)
  partition.setPermissionRequestHandler((_wc, _permission, respond) => respond(false))
  partition.on('will-download', preventDownload)
  const win = new BrowserWindow({
    title: item.name,
    width: 610,
    height: 480,
    show: false,
    autoHideMenuBar: true,
    webPreferences: { session: partition, preload: path.join(folder, 'preload.cjs'), sandbox: true, nodeIntegration: false, contextIsolation: true, webSecurity: true, webviewTag: false },
  })
  windows.set(item.id, win)
  windowDependencies.set(item.id, new Set(ordered.map(p => p.id.toLowerCase())))
  win.removeMenu()
  const wc = win.webContents
  wc.ipc.on('plugin-playback', (event, action, data) => {
    if (event.senderFrame !== wc.mainFrame || owner.isDestroyed()) return
    const target = BrowserWindow.fromWebContents(owner)
    if (!target || target.isDestroyed()) return
    const valid = ['play', 'pause', 'prev', 'next'].includes(action) ||
      (action === 'volume' && Number.isFinite(data) && data >= 0 && data <= 1) ||
      (action === 'seek' && Number.isFinite(data) && data >= 0) ||
      (action === 'mute' && typeof data === 'boolean') ||
      (action === 'playMode' && ['random', 'list', 'singleLoop', 'listLoop'].includes(data))
    if (valid) mainSend(target, WIN_MAIN_RENDERER_EVENT_NAME.player_action_on_button_click, { action, data })
  })
  wc.ipc.handle('plugin-lyrics', (event, id) => {
    if (event.senderFrame !== wc.mainFrame || typeof id !== 'string') throw Error('invalid_song_id')
    return publicLyrics(id, (url, options) => session.fromPartition('qmusic-public-lyrics').fetch(url, options))
  })
  let finish
  const initialized = new Promise((resolve, reject) => {
    finish = message => { if (message) reject(Error('plugin_runtime: ' + message)); else resolve() }
  })
  // 窗口也可能在页面载入过程中被关闭。
  initialized.catch(() => {})
  starting.set(item.id, initialized)
  const timeout = setTimeout(() => finish('timeout'), 15000)
  wc.ipc.once('plugin-loaded', (event, error) => {
    if (event.senderFrame === wc.mainFrame) finish(typeof error === 'string' ? error.slice(0, 240) : 'invalid')
  })
  wc.ipc.on('plugin-actions', (event, rows) => {
    if (event.senderFrame !== wc.mainFrame || !Array.isArray(rows) || rows.length > 24) return
    const list = rows.filter(row => Number.isSafeInteger(row?.key) && typeof row.label === 'string' && row.label.length <= 100)
    trackActions.set(item.id, list.map(({ key, label }) => ({ id: item.id, key, label, name: item.name })))
  })
  wc.ipc.on('plugin-source', (event, url) => {
    if (event.senderFrame !== wc.mainFrame || typeof url !== 'string' || url.length > 2048) return
    try {
      const options = suggestions.get(item.id) || new Set()
      if (options.size < 8) options.add(sourceRoot(url))
      suggestions.set(item.id, options)
    } catch { /* 无效的来源不进入选择列表。 */ }
  })
  wc.on('will-navigate', event => event.preventDefault())
  wc.on('will-attach-webview', event => event.preventDefault())
  let asking = false
  wc.setWindowOpenHandler(({ url }) => {
    // 用户安装的脚本只能提议打开 HTTPS 链接。系统对话框显示完整目标。
    if (!asking && /^https:\/\//i.test(url) && url.length <= 2000) {
      asking = true
      dialog.showMessageBox(win.isVisible() ? win : BrowserWindow.fromWebContents(owner) ?? win, { type: 'question', message: item.name, detail: url, buttons: ['Cancel', 'Open'], cancelId: 0, defaultId: 0 })
        .then(({ response }) => { if (response === 1 && !win.isDestroyed()) return shell.openExternal(url) })
        .catch(() => {}).finally(() => { asking = false })
    }
    return { action: 'deny' }
  })
  const update = changes => {
    if (wc.isDestroyed()) return
    const changed = trackChanges(changes)
    if (Object.keys(changed).length) wc.send('plugin-track', changed)
  }
  const close = () => { if (!win.isDestroyed()) win.destroy() }
  owner.once('destroyed', close)
  owner.once('render-process-gone', close)
  win.once('closed', () => {
    finish('closed')
    suggestions.delete(item.id)
    windows.delete(item.id)
    windowDependencies.delete(item.id)
    trackActions.delete(item.id)
    owner.removeListener('destroyed', close)
    owner.removeListener('render-process-gone', close)
    global.lx.event_app.off('player_status', update)
    partition.removeListener('will-download', preventDownload)
  })
  try {
    await win.loadFile(path.join(folder, 'index.html'))
    if (win.isDestroyed()) throw Error('plugin_runtime: closed')
    wc.send('plugin-start', ordered, track())
    global.lx.event_app.on('player_status', update)
    await initialized
    failures.delete(item.id)
    if (show) win.show()
  } catch (error) { failures.set(item.id, error.message); close(); throw error } finally {
    clearTimeout(timeout)
    if (starting.get(item.id) === initialized) starting.delete(item.id)
  }
}
const preventDownload = event => event.preventDefault()

async function savePackages(owner, additions, removed = []) {
  const changed = [...additions.map(item => item.id), ...removed].map(id => id.toLowerCase())
  const before = packages()
  const entries = [...before.filter(item => !changed.includes(item.id.toLowerCase())), ...additions]
  if (Buffer.byteLength(JSON.stringify(entries), 'utf8') > 32 * 1024 * 1024) throw Error('plugin_size')
  const restart = []
  for (const [id, deps] of [...windowDependencies]) {
    if (!changed.some(key => deps.has(key))) continue
    const win = windows.get(id)
    const replacement = entries.find(item => item.id.toLowerCase() === id.toLowerCase())
    if (win) restart.push({ previous: before.find(p => p.id === id), replacement, visible: win.isVisible() })
    win?.destroy()
  }
  try {
    if (!removed.length) {
      for (const { replacement, visible } of restart) await openPlugin(owner, replacement, visible, entries)
    }
    getStore('betterPlugins').set('installed', entries)
  } catch (error) {
    for (const { replacement } of restart) windows.get(replacement?.id)?.destroy()
    await Promise.allSettled(restart.map(({ previous, visible }) => openPlugin(owner, previous, visible, before)))
    throw error
  }
  const enabled = new Set(enabledIds().map(id => id.toLowerCase()))
  const retained = entries.filter(item => {
    if (!enabled.has(item.id.toLowerCase())) return false
    try { pluginOrder(item, entries); return true } catch { return false }
  })
  getStore('betterPlugins').set('autoStart', retained.map(item => item.id))
  for (const id of removed) failures.delete(id)
}

let mutations = Promise.resolve()
export function managePlugin(owner, command) {
  if (['list', 'actions', 'invoke', 'sources', 'catalog', 'read-script'].includes(command.action)) return execute(owner, command)
  const job = mutations.then(() => execute(owner, command))
  mutations = job.catch(() => {})
  return job
}
async function execute(owner, command) {
  const { action, id, bytes, source, key, name, script } = command
  if (action === 'list') return listing()
  if (action === 'actions') return [...trackActions.values()].flat()
  if (action === 'invoke') {
    if (!trackActions.get(id)?.some(row => row.key === key)) throw Error('plugin_missing')
    windows.get(id)?.webContents.send('plugin-invoke', key)
    return listing()
  }
  if (action === 'startup') {
    const saved = new Set(enabledIds())
    await Promise.allSettled(packages().filter(p => saved.has(p.id)).map(async item => {
      try { await openPlugin(owner, item, false) } catch (error) { failures.set(item.id, error.message) }
    }))
    return listing()
  }
  if (action === 'sources') return [...new Set([officialSource, githubSource, ...[...suggestions.values()].flatMap(set => [...set])])]
  if (action === 'catalog' || action === 'download') {
    const base = sourceRoot(source || officialSource)
    const download = (url, options) => session.fromPartition('qmusic-better-catalog').fetch(url, options)
    if (action === 'catalog') {
      const rows = await loadCatalog(download, base)
      if (catalogCache.size >= 8) catalogCache.delete(catalogCache.keys().next().value)
      catalogCache.set(base, rows)
      return [...rows.values()].map(({ id, name, version, native, description }) => ({ id, name, version, native, description }))
    }
    const rows = catalogCache.get(base) || await loadCatalog(download, base)
    const additions = await downloadPluginTree(download, rows, id, packages())
    pluginOrder(additions[additions.length - 1], [...packages(), ...additions])
    await savePackages(owner, additions)
  } else if (action === 'install') {
    if (!(bytes instanceof Uint8Array)) throw Error('plugin_format')
    await savePackages(owner, [readBetterPackage(bytes)])
  } else if (action === 'save-script') {
    if (typeof script !== 'string' || !script.trim() || script.length > 131072 || typeof name !== 'string' || !name.trim() || name.length > 96) throw Error('plugin_format')
    if (id && !packages().some(item => item.id === id && item.editable)) throw Error('plugin_missing')
    await savePackages(owner, [{ id: id || 'local-' + randomUUID(), name: name.trim(), version: '', editable: true, scripts: ['main.js'], requirements: [], assets: { 'main.js': script } }])
  } else {
    const plugin = packages().find(item => item.id === id)
    if (!plugin) throw Error('plugin_missing')
    if (action === 'read-script' && plugin.editable) return plugin.assets['main.js']
    if (action === 'open') await openPlugin(owner, plugin)
    else if (action === 'enable' || action === 'disable') {
      const enabled = new Set(enabledIds())
      if (action === 'enable') {
        await openPlugin(owner, plugin, false)
        enabled.add(id)
      } else {
        enabled.delete(id)
        failures.delete(id)
        windows.get(id)?.destroy()
      }
      getStore('betterPlugins').set('autoStart', [...enabled])
    } else if (action === 'remove') {
      await savePackages(owner, [], [id])
    } else throw Error('plugin_action')
  }
  return listing()
}
