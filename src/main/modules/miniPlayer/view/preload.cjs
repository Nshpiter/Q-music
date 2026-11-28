const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('miniPlayer', {
  onLabels(receive) { ipcRenderer.on('mini-player-labels', (_, labels) => receive(labels)) },
  onAppearance(receive) { ipcRenderer.on('mini-player-appearance', (_, appearance) => receive(appearance)) },
  onState(receive) { ipcRenderer.on('mini-player-state', (_, state) => receive(state)) },
  onClock(receive) { ipcRenderer.on('mini-player-clock', (_, progress, rate) => receive(progress, rate)) },
  control: action => ipcRenderer.send('mini-player-control', action),
})
