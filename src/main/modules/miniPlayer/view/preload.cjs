const { ipcRenderer } = require('electron')

window.addEventListener('DOMContentLoaded', () => {
  const cover = document.querySelector('img')
  const button = document.querySelector('#toggle')
  let playing = false
  let labels = {}
  const label = (element, text) => {
    element.title = text
    element.setAttribute('aria-label', text)
  }
  ipcRenderer.on('mini-player-labels', (_, strings) => {
    labels = strings
    document.title = labels.title
    for (const action of ['prev', 'next']) label(document.getElementById(action), labels[action])
    label(button, playing ? labels.pause : labels.play)
  })
  ipcRenderer.on('mini-player-state', (_, state) => {
    document.querySelector('h1').textContent = state.name || 'Q-music'
    document.querySelector('#singer').textContent = state.singer
    document.querySelector('#lyric').textContent = state.lyricLineText
    const url = /^(https?:\/\/|data:image\/)/i.test(state.picUrl) ? state.picUrl : ''
    if (url !== (cover.getAttribute('src') || '')) {
      cover.hidden = true
      if (url) cover.src = url
      else cover.removeAttribute('src')
    }
    playing = state.status === 'playing'
    document.querySelector('#play').style.display = playing ? 'none' : ''
    document.querySelector('#pause').style.display = playing ? '' : 'none'
    label(button, playing ? labels.pause : labels.play)
  })
  cover.onload = () => { cover.hidden = false }
  cover.onerror = () => { cover.hidden = true }
  button.onclick = () => ipcRenderer.send('mini-player-control', playing ? 'pause' : 'play')
  for (const action of ['prev', 'next']) {
    document.getElementById(action).onclick = () => ipcRenderer.send('mini-player-control', action)
  }
})
