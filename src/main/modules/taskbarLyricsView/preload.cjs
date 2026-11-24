const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('taskbarLyrics', {
  onLine: callback => { ipcRenderer.on('taskbar-lyric', (_, ...args) => { callback(...args) }) },
  onClock: callback => { ipcRenderer.on('taskbar-clock', (_, ...args) => { callback(...args) }) },
})
