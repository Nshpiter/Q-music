// OBS 浏览器源直接订阅现有的播放事件，断线后由 EventSource 重新获取当前状态。
export const obsOverlay = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Q-music · OBS</title><style>
* { box-sizing: border-box; }
body { margin: 0; background: transparent; font: 16px/1.4 system-ui,sans-serif; color: #fafafa; }
article { position: relative; isolation: isolate; overflow: hidden; display: inline-flex; align-items: center; gap: 16px; max-width: 100vw; padding: 14px 20px; border-radius: 18px; background: rgba(21,23,27,.88); }
#ambient { position: absolute; z-index: -1; inset: -25%; width: 150%; height: 150%; opacity: .45; filter: blur(22px) saturate(1.4) brightness(.65); }
.timed-word { background: linear-gradient(white,white) left center / 0% 100% no-repeat; background-clip: text; color: #fff7; }
[hidden] { display: none !important; }
body[data-layout="lyrics"] article { padding: 5px 12px; }
body[data-layout="lyrics"] #cover, body[data-layout="lyrics"] h1, body[data-layout="lyrics"] #singer,
body[data-layout="card"] #lyric, body:not([data-layout="card"]) #timeline { display: none; }
body[data-layout="lyrics"] #lyric { margin: 0; font-size: clamp(18px, 4vw, 42px); }
body[data-layout="card"] article { width: min(100vw, 640px); }
body[data-layout="card"] section { flex: 1; }
#timeline { display: flex; align-items: center; gap: 8px; font-variant-numeric: tabular-nums; font-size: 12px; }
progress { flex: 1; min-width: 20px; height: 4px; accent-color: #dcd2fd; }
@media (prefers-reduced-motion: no-preference) { .changed { animation: reveal .22s ease-out; } @keyframes reveal { from { opacity: .35; transform: translateY(3px); } } }
img { width: 64px; height: 64px; border-radius: 9px; object-fit: cover; }
section { min-width: 0; }
h1,p { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
h1 { font-size: 20px; } #singer { opacity: .7; } #lyric { margin-top: 5px; }
</style></head><body><article hidden><img id="cover" alt="" hidden referrerpolicy="no-referrer"><img id="ambient" alt="" hidden><section><h1></h1><p id="singer"></p><p id="lyric"></p><div id="timeline"><span id="elapsed"></span><progress value="0" max="1"></progress><span id="duration"></span></div></section></article>
<script src="/obs-lyric.js"></script>
<script>
const card = document.querySelector('article'), cover = document.querySelector('img'), title = document.querySelector('h1')
const params = new URLSearchParams(location.search)
document.body.dataset.layout = ['card', 'lyrics'].includes(params.get('layout')) ? params.get('layout') : 'combined'
if (params.has('radius')) card.style.borderRadius = Math.min(64, Math.max(0, Number(params.get('radius')) || 0)) + 'px'
const meter = document.querySelector('progress')
const formatTime = value => Math.floor(value / 60) + ':' + String(Math.floor(value % 60)).padStart(2, '0')
const status = new EventSource('/subscribe-player-status?filter=status,name,singer,picUrl,lyricLineText,lyricLineWords,progress,playbackRate,duration')
const line = window.createTimedLine(document.querySelector('#lyric'))
const ambient = document.querySelector('#ambient')
let words = [], text = '', progress = 0, rate = 1
let playing = false
function subscribe(key, update) {
  status.addEventListener(key, event => {
    update(JSON.parse(event.data))
    card.hidden = !playing || !title.textContent
  })
}
subscribe('status', value => { playing = value === 'playing'; line.sync(progress, rate, playing) })
subscribe('name', value => {
  if (title.textContent === value) return
  title.textContent = value
  card.classList.remove('changed')
  window.requestAnimationFrame(() => card.classList.add('changed'))
})
subscribe('singer', value => { document.querySelector('#singer').textContent = value })
const draw = () => { line.setLine(text, words); line.sync(progress, rate, playing) }
subscribe('lyricLineText', value => { text = value; draw() })
subscribe('lyricLineWords', value => { words = value; draw() })
subscribe('duration', value => { meter.max = Math.max(1, value); document.querySelector('#duration').textContent = formatTime(value) })
subscribe('progress', value => { progress = value; meter.value = value; document.querySelector('#elapsed').textContent = formatTime(value); line.sync(progress, rate, playing) })
subscribe('playbackRate', value => { rate = value; line.sync(progress, rate, playing) })
subscribe('picUrl', value => {
  cover.hidden = true
  ambient.hidden = true
  ambient.removeAttribute('src')
  if (typeof value === 'string' && /^https?:\\/\\//i.test(value)) cover.src = value
  else cover.removeAttribute('src')
})
cover.onload = () => { cover.hidden = false; ambient.src = cover.src; ambient.hidden = false }
cover.onerror = () => { cover.hidden = true }
status.onerror = () => { playing = false; card.hidden = true }
</script></body></html>`
