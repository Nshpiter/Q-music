const capsule = new URLSearchParams(window.location.search).get('mode') === 'capsule'
document.documentElement.classList.toggle('capsule', capsule)
const cover = document.querySelector('#cover')
const ambient = document.querySelector('#ambient')
const toggle = document.querySelector('#toggle')
const lyric = document.querySelector('#lyric')
const line = capsule ? window.createTimedLine(lyric) : null
let labels = {}
let playing = false
let timedWords = []
let lastWord = -1

function syncLine(progress, rate) {
  line.sync(progress, rate, playing)
  if (!timedWords.length) return
  let low = 0
  let high = timedWords.length
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (timedWords[mid].start <= progress * 1000) low = mid + 1
    else high = mid
  }
  const index = Math.max(0, low - 1)
  if (lastWord === index) return
  lastWord = index
  const word = lyric.children[index]
  if (word && lyric.scrollHeight > lyric.clientHeight) {
    const viewport = lyric.getBoundingClientRect()
    const glyph = word.getBoundingClientRect()
    if (glyph.top < viewport.top - 1 || glyph.bottom > viewport.bottom + 1) {
      lyric.scrollTop += glyph.top - viewport.top
    }
  }
}

function label(element, text) {
  if (!text) return
  element.title = text
  element.setAttribute('aria-label', text)
}

window.miniPlayer.onLabels(strings => {
  labels = strings
  document.title = labels.title
  for (const id of ['prev', 'next', 'close', 'minimize']) label(document.getElementById(id), labels[id])
  label(toggle, playing ? labels.pause : labels.play)
})
window.miniPlayer.onAppearance(({ motion, performanceMode }) => {
  document.documentElement.classList.toggle('motion', motion)
  document.documentElement.classList.toggle('lightweight', performanceMode)
})
window.miniPlayer.onState(state => {
  const name = state.name || 'Q-music'
  document.querySelector('h1').textContent = name
  document.querySelector('#singer').textContent = state.singer
  playing = state.status === 'playing'
  document.documentElement.classList.toggle('playing', playing)
  if (line) {
    const track = [name, state.singer].filter(Boolean).join(' · ')
    line.setLine(state.lyricLineText || track, state.words)
    timedWords = state.words || []
    lastWord = -1
    lyric.scrollTop = 0
    syncLine(state.progress, state.rate)
    lyric.title = state.lyricLineText || track
  } else lyric.textContent = state.lyricLineText

  const url = /^(https?:\/\/|data:image\/)/i.test(state.picUrl) ? state.picUrl : ''
  if (url !== (cover.getAttribute('src') || '')) {
    cover.hidden = true
    if (ambient) ambient.hidden = true
    if (url) {
      cover.src = url
      if (capsule && ambient) ambient.src = url
    } else {
      cover.removeAttribute('src')
      ambient?.removeAttribute('src')
    }
  }
  document.querySelector('#play').style.display = playing ? 'none' : ''
  document.querySelector('#pause').style.display = playing ? '' : 'none'
  label(toggle, playing ? labels.pause : labels.play)
})
if (line) window.miniPlayer.onClock(syncLine)
cover.onload = () => {
  cover.hidden = false
  if (capsule && ambient && ambient.getAttribute('src')) ambient.hidden = false
}
cover.onerror = () => {
  cover.hidden = true
  if (ambient) ambient.hidden = true
}
toggle.onclick = () => window.miniPlayer.control(playing ? 'pause' : 'play')
for (const id of ['prev', 'next', 'close', 'minimize']) document.getElementById(id).onclick = () => window.miniPlayer.control(id)
document.addEventListener('keydown', event => {
  if (capsule && event.key === 'Escape') window.miniPlayer.control('close')
})
