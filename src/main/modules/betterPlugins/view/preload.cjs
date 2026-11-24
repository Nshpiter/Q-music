const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('pluginHost', {
  playback: (action, value) => ipcRenderer.send('plugin-playback', action, value),
  lyrics: id => ipcRenderer.invoke('plugin-lyrics', String(id)),
  loaded: message => { ipcRenderer.send('plugin-loaded', typeof message === 'string' ? message.slice(0, 240) : '') },
  actions: rows => { if (Array.isArray(rows) && rows.length <= 24) ipcRenderer.send('plugin-actions', rows) },
  invoke: handler => ipcRenderer.on('plugin-invoke', (_, key) => handler(key)),
  suggestSource: url => { if (typeof url === 'string' && url.length <= 2048) ipcRenderer.send('plugin-source', url) },
  start: handler => ipcRenderer.once('plugin-start', (_, data, track) => handler(data, track)),
  listen: handler => ipcRenderer.on('plugin-track', (_, track) => handler(track)),
})
