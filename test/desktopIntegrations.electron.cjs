// 使用独立曲库和合成音频检查真实播放器与本机接收端。
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { once } = require('node:events')
const assert = require('node:assert/strict')
const { WebSocketServer } = require('ws')
const { zipSync, strToU8 } = require('fflate')
const { pathToFileURL } = require('node:url')
const root = path.resolve(__dirname, '..')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'q-music-desktop-integrations-'))
const profile = path.join(dir, 'q-music-local-preview')
const data = path.join(profile, 'LxDatas')
fs.mkdirSync(data, { recursive: true })
app.setPath('temp', dir)
app.setPath('userData', profile)
app.setAppPath(root)
process.env.Q_MUSIC_LOCAL_PREVIEW = '1'

const song = path.join(dir, 'signal.wav')
const hz = 44100
const samples = hz * 80
const wav = Buffer.alloc(44 + samples * 4)
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8)
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22)
wav.writeUInt32LE(hz, 24); wav.writeUInt32LE(hz * 4, 28); wav.writeUInt16LE(4, 32)
wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples * 4, 40)
for (let i = 0; i < samples; i++) {
  wav.writeInt16LE(Math.round(900 * Math.sin(2 * Math.PI * 200 * i / hz)), 44 + i * 4)
  wav.writeInt16LE(Math.round(900 * Math.sin(2 * Math.PI * 400 * i / hz)), 46 + i * 4)
}
fs.writeFileSync(song, wav)
const sampleCover = path.join(dir, 'signal.jpg')
fs.copyFileSync(path.join(root, 'src/renderer/assets/images/landingMoon.jpg'), sampleCover)
const track = { id: song, source: 'local', name: 'Q-Music PCM fixture', singer: 'Test', interval: '01:20', meta: { albumName: 'Fixture', filePath: song, songId: song, ext: 'wav' } }
fs.writeFileSync(path.join(data, 'data.json'), JSON.stringify({ playHistory: { entries: [{ track, playedAt: Date.now() }], limit: 100 } }))
fs.writeFileSync(path.join(data, 'config_v2.json'), JSON.stringify({ version: '2.1.0', setting: { version: '2.1.0', 'common.isAgreePact': true, 'common.langId': 'zh-cn', 'common.isAutoUpdate': false, 'common.showChangeLog': false, 'list.singlePlayMode': 'replace', 'player.isPlayLxlrc': true } }))

async function until(predicate, label) {
  const end = Date.now() + 18000
  while (Date.now() < end) {
    if (await predicate()) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw Error(label)
}

async function verify() {
  let main
  await until(async() => {
    main = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().includes('/index.html'))
    return main && main.webContents.executeJavaScript('!!document.querySelector("a[href$=history]")')
  }, 'Desktop home did not load')
  const run = source => main.webContents.executeJavaScript(source)
  const settings = values => run('window.lxData.updateSetting(' + JSON.stringify(values) + ')')
  const command = params => run("require('electron').ipcRenderer.invoke('winMain_better_plugins'," + JSON.stringify(params) + ")")
  const pluginWindow = () => BrowserWindow.getAllWindows().find(win => win.webContents.getURL().includes('/betterPlugins/'))
  const dictionaryZip = (rows, media = {}) => [...zipSync({
    'index.json': strToU8(JSON.stringify({ title: 'Test', format: 3 })),
    'term_bank_1.json': strToU8(JSON.stringify(rows)),
    ...media,
  })]
  const valid = dictionaryZip([['猫', 'ねこ', '', '', 0, ['cat'], 1, ''], ['猫舌', 'ねこじた', '', '', 0, ['sensitive tongue'], 2, ''], ['食べる', 'たべる', 'v1', '', 0, ['eat'], 3, ''], ['写真', '', '', '', 0, [{ type: 'structured-content', content: [{ tag: 'strong', content: 'Photo' }, { tag: 'img', path: 'media/photo.png' }] }], 4, '']], { 'media/photo.png': Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jh1sAAAAASUVORK5CYII=', 'base64') })
  const invalid = dictionaryZip([['犬', 'いぬ', '', '', 0, ['dog']], ['invalid']])
  const lookup = await run(`(async () => {
    const worker = new Worker(new URL('dictionary/worker.js', document.baseURI))
    let id = 0
    const call = (action, value) => new Promise((resolve, reject) => {
      worker.onmessage = ({data}) => data.error ? reject(Error(data.error)) : resolve(data.data)
      worker.onerror = reject
      worker.postMessage({id: ++id, action, value})
    })
    try {
      await call('import', Uint8Array.from(${JSON.stringify(valid)}).buffer)
      let rejected = false
      try { await call('import', Uint8Array.from(${JSON.stringify(invalid)}).buffer) } catch { rejected = true }
      const prefix = await call('lookup', '猫舌です')
      const reading = await call('lookup', 'ねこ')
      const inflected = await call('lookup', '食べました')
      const partial = await call('lookup', '犬')
      const photo = await call('lookup', '写真')
      const img = await call('media', ['Test', 'media/photo.png'])
      await call('remove', 'Test')
      return [rejected, prefix[0]?.term, reading[0]?.meaning, inflected[0]?.term, partial.length, (await call('list')).length, photo[0].structured[0].content[0].tag, img.type, !!(await call('media', ['Test', 'media/photo.png']))]
    } finally { worker.terminate() }
  })()`)
  assert.deepEqual(lookup, [true, '猫舌', 'cat', '食べる', 0, 0, 'strong', 'image/png', false])
  console.log('Dictionary import, lookup, rollback and removal passed')
  for (const layout of ['Ark', 'ReLive', 'Elaina', 'MoTheme', 'Microrange', 'Transmission', 'Unbounded', '']) {
    await settings({ 'theme.desktopLayout': layout })
    await until(() => run('document.documentElement.dataset.desktopLayout === ' + JSON.stringify(layout)), 'Layout switch: ' + layout)
    assert(await run('document.querySelector("#view").getBoundingClientRect().width > 80'), 'Content hidden in ' + layout)
  }
  console.log('Desktop layout switching passed')
  await settings({ 'theme.desktopLayout': 'Ark', 'theme.layoutOptions': { Ark: { accent: '#dc8844', radius: 13, docked: true } } })
  await until(() => run("document.documentElement.classList.contains('q-docked-bar') && document.documentElement.style.getPropertyValue('--layout-user-radius') === '13px'"), 'Layout options')
  await settings({ 'theme.desktopLayout': 'ReLive' })
  await until(() => run("!document.documentElement.classList.contains('q-docked-bar') && !document.documentElement.style.getPropertyValue('--layout-user-accent')"), 'Layout options leaked to another theme')
  await settings({ 'theme.desktopLayout': '' })
  const stamps = Array.from({ length: 40 }, (_, i) => '[' + String(Math.floor(i / 30)).padStart(2, '0') + ':' + String(i * 2 % 60).padStart(2, '0') + '.00]')
  await global.lx.worker.dbService.rawLyricAdd(song, { lyric: stamps.map(s => s + '明日は').join('\n'), lxlyric: stamps.map(s => s + '<0,1000>明<1000,1000>日は').join('\n') })
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  await once(server, 'listening')
  const frames = new Set()
  let peer
  server.on('connection', ws => {
    peer = ws
    ws.on('message', (bytes, binary) => {
      if (binary && bytes.length === 3846 && bytes.readUInt32LE(2) === 3840 && bytes.subarray(6).some(n => n !== 0)) frames.add(bytes.readUInt16LE(0))
    })
  })
  await settings({ 'integrations.sixK': true, 'integrations.amll': true, 'integrations.amllAudio': true, 'integrations.amllUrl': 'ws://127.0.0.1:' + server.address().port, 'desktopLyric.taskbar': true, 'openAPI.enable': true, 'openAPI.bindLan': false, 'openAPI.port': '32374' })
  await run('document.querySelector("a[href$=history]").click()')
  const playButton = 'Array.from(document.querySelectorAll("button")).find(e => e.querySelector("strong")?.textContent === "Q-Music PCM fixture")'
  await until(() => run('!!' + playButton), 'Missing track in history')
  await run(playButton + '.click()')
  const query = async() => (await fetch('http://127.0.0.1:9863/query')).json()
  await until(async() => {
    const state = await query()
    return state.track.title === track.name && state.track.id === '' && state.player.hasSong && !state.player.isPaused && state.player.seekbarCurrentPosition > 0
  }, '6K playback snapshot')
  assert.equal((await fetch('http://127.0.0.1:9863/query', { method: 'POST' })).status, 405)
  await run("window.lxData.musicInfo.pic = 'https://p1.music.126.net/example.jpg?param=80y80'")
  await settings({ 'integrations.sixKCoverSize': '512' })
  await until(async() => (await query()).track.cover.endsWith('thumbnail=512y512'), '6K URL cover dimensions')
  const imageData = await run("document.createElement('canvas').toDataURL()")
  await run("window.lxData.musicInfo.pic = " + JSON.stringify(imageData))
  await settings({ 'integrations.sixKCoverMode': 'base64url' })
  await until(async() => (await query()).track.cover.startsWith('data:image/jpeg;base64,'), '6K embedded cover')
  await run("window.lxData.musicInfo.pic = ''")
  console.log('6K Labs playback, artwork and HTTP contract passed')
  await run("document.querySelector('.q-player-footer button').click()")
  const heldWord = "document.querySelector('.lyric .active .sustained-word')"
  await until(() => run("!!" + heldWord + " && getComputedStyle(" + heldWord + ").position === 'relative'"), 'Sustained lyric in the player')
  const wordHasLift = () => run("Array.from(document.querySelectorAll('.lyric .active .sustained-word')).some(e => parseFloat(getComputedStyle(e).top) < -1)")
  await until(wordHasLift, 'Sustained lyric rises during playback')
  main.show()
  main.focus()
  await run('window.lxData.musicInfo.pic = ' + JSON.stringify(pathToFileURL(sampleCover).href))
  await settings({ 'playDetail.coverMv': true })
  const camera = "document.querySelector('.q-cover-scene')?.lastElementChild"
  await until(() => run('!!' + camera + '?.style.transform'), 'Cover scene mounted')
  // 只统计实际转角，频谱改变深度也会改写 transform，不能算成镜头转动。
  const sampled = await run(`new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('No visible cover animation frames')), 4000)
    let previous = '', changes = 0, frames = 0
    const start = performance.now()
    function sample(now) {
      const angle = ${camera}?.style.transform.match(/rotateY\\(([^)]+)/)?.[1]
      if (angle !== previous) changes++
      previous = angle
      frames++
      if (now - start < 550) requestAnimationFrame(sample)
      else {
        clearTimeout(timeout)
        resolve({ changes, frames })
      }
    }
    requestAnimationFrame(sample)
  })`)
  assert(sampled.changes > 3 && sampled.changes > sampled.frames / 2, 'Cover rotation between timeupdate events: ' + JSON.stringify(sampled))
  console.log('Cover animation follows playback between timeupdate events')
  await run("Array.from(document.querySelectorAll('button[aria-label=\"播放页外观\"]')).find(e => e.getBoundingClientRect().width).click()")
  const selectMotion = name => run("Array.from(document.querySelectorAll('[role=dialog] button')).find(e => e.textContent === " + JSON.stringify(name) + ").click()")
  await selectMotion('原版')
  await until(() => run("getComputedStyle(" + heldWord + ").position === 'static'"), 'Original lyric motion')
  await selectMotion('长音律动')
  await until(wordHasLift, 'Switching back to sustained lyric motion')
  await settings({ 'common.performanceMode': true })
  await until(() => run("getComputedStyle(" + heldWord + ").position === 'static'"), 'Performance mode suppresses note lift')
  await until(() => run('!(' + camera + ')'), 'Performance mode releases the cover scene')
  await settings({ 'common.performanceMode': false })
  main.webContents.debugger.attach()
  try {
    await main.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    await until(() => run("getComputedStyle(" + heldWord + ").position === 'static'"), 'Reduced motion suppresses note lift')
    await until(() => run('!(' + camera + ')'), 'System reduced motion releases the cover scene')
  } finally {
    await main.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [] })
    main.webContents.debugger.detach()
  }
  const transport = key => run("document.querySelector('.q-player-footer button[aria-label=' + JSON.stringify(window.i18n.t(" + JSON.stringify(key) + ")) + ']').click()")
  await transport('player__pause')
  await until(async() => (await query()).player.isPaused, 'Paused before lyric seek')
  await run('window.app_event.setProgress(6.5)')
  const pausedTime = () => run(heldWord + '?.getAnimations()[0]?.currentTime')
  await until(async() => Math.abs(await pausedTime() - 500) < 55, 'Seeking into a held note while paused')
  const frozen = await pausedTime()
  await new Promise(resolve => setTimeout(resolve, 180))
  assert.equal(await pausedTime(), frozen)
  await until(() => run('!!' + camera + '?.style.transform'), 'Cover remounted after leaving reduced motion')
  const frozenCover = await run(camera + '.style.transform')
  await new Promise(resolve => setTimeout(resolve, 120))
  assert.equal(await run(camera + '.style.transform'), frozenCover)
  const openAppearance = () => run("Array.from(document.querySelectorAll('button[aria-label=\"播放页外观\"]')).find(e => e.offsetWidth).click()")
  await openAppearance()
  await selectMotion('扇形')
  const fanAngles = () => run(`(() => {
    const line = document.querySelector('.lyric .q-current-line')
    return [line.previousElementSibling, line, line.nextElementSibling].map(row => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(row).transform)
      return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI
    })
  })()`)
  const curve = value => run("(() => {const e=document.querySelector('[role=dialog] input[aria-label=曲率]');e.value=" + value + ";e.dispatchEvent(new Event('input',{bubbles:true}))})()")
  await curve(10)
  await until(async() => { const [before, current, after] = await fanAngles(); return before > 0 && current === 0 && after < 0 }, 'Right-hand fan rotation around the paused lyric')
  await new Promise(resolve => setTimeout(resolve, 360))
  const shallow = await fanAngles()
  await curve(80)
  await until(async() => (await fanAngles())[0] > shallow[0] * 1.5, 'Adjustable fan curvature')
  await run('window.app_event.setProgress(18.5)')
  await until(() => run(camera + '?.style.transform !== ' + JSON.stringify(frozenCover)), 'A paused seek must reposition the cover')
  await until(async() => await run("document.querySelector('.lyric .q-current-line')?.dataset.lineIndex === '9'") && (await fanAngles())[1] === 0, 'Fan centers the new line on seek')
  const rowPosition = () => run(`(() => {
    const view = document.querySelector('.lyric')
    const viewBox = view.getBoundingClientRect()
    const row = view.querySelector('.q-current-line').getBoundingClientRect()
    return row.top + row.height / 2 - viewBox.top - viewBox.height / 2
  })()`)
  for (const mode of ['直排', '扇形', '直排']) {
    await selectMotion(mode)
    await until(async() => Math.abs(await rowPosition()) < 3, 'Current line centered after selecting ' + mode)
    await new Promise(resolve => setTimeout(resolve, 550))
    assert(Math.abs(await rowPosition()) < 3, 'Current line drifted after selecting ' + mode)
  }
  await run("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))")
  console.log('Fan layout, live curvature and seek passed')
  await settings({ 'player.playbackRate': 1.5 })
  await transport('player__play')
  await until(() => run(heldWord + "?.getAnimations()[0]?.playbackRate === 1.5"), 'Lyric follows playback rate')
  await settings({ 'player.playbackRate': 1 })
  await run("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));document.querySelector('button[aria-label=' + JSON.stringify(window.i18n.t('player__hide_detail_tip')) + ']').click()")
  await until(() => run('!(' + camera + ')'), 'Cover scene released on closing player details')
  await settings({ 'playDetail.coverMv': false })
  console.log('Player lyric motion and live appearance switching passed')
  const scripts = {
    'manifest.json': strToU8(JSON.stringify({ manifest_version: 1, slug: 'compat-test', name: 'Compat Test', version: '1.0', injects: { Main: [{ file: 'main.js' }] } })),
    'main.js': strToU8("plugin.onConfig(() => { const p = document.createElement('p'); p.id = 'test-title'; p.textContent = betterncm.ncm.getPlayingSong().data.name; return p })"),
  }
  const plugin = await run("require('electron').ipcRenderer.invoke('winMain_better_plugins', {action:'install',bytes: Uint8Array.from(" + JSON.stringify([...zipSync(scripts)]) + ")})")
  assert.equal(plugin[0].id, 'compat-test')
  await run("require('electron').ipcRenderer.invoke('winMain_better_plugins',{action:'open',id:'compat-test'})")
  const panel = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().includes('/betterPlugins/'))
  assert(panel, 'Missing isolated plugin window')
  await until(() => panel.webContents.executeJavaScript("document.getElementById('test-title')?.textContent === 'Q-Music PCM fixture'"), 'Plugin lifecycle and song metadata')
  assert.equal(await panel.webContents.executeJavaScript('typeof require'), 'undefined')
  assert.equal(await panel.webContents.executeJavaScript('window.InfLinkApi.getCurrentSong().songName'), track.name)
  await panel.webContents.executeJavaScript('window.InfLinkApi.pause()')
  await until(() => panel.webContents.executeJavaScript("window.InfLinkApi.getPlaybackStatus() === 'Paused'"), 'Plugin pause')
  await panel.webContents.executeJavaScript('window.InfLinkApi.seekTo(3000); window.InfLinkApi.play()')
  await until(() => panel.webContents.executeJavaScript("window.InfLinkApi.getPlaybackStatus() === 'Playing' && window.InfLinkApi.getTimeline().currentTime >= 3000"), 'Plugin seek and resume')
  const parsed = await panel.webContents.executeJavaScript(`(() => {
    const api = window.loadedPlugins.LibLyric
    const yrc = api.convertDynamic('[00:02.00]<0,300>你<300,300>好')
    const [line] = api.parseLyric('', '[00:02.00]Hello', '', yrc)
    return [line.time, line.duration, line.originalLyric, line.dynamicLyric[1].time, line.translatedLyric]
  })()`)
  assert.deepEqual(parsed, [2000, 600, '你好', 2300, 'Hello'])
  assert.equal(await panel.webContents.executeJavaScript('window.currentLyrics.lyrics[0].originalLyric'), '明日は')
  const files = await panel.webContents.executeJavaScript(`(async () => {
    const fs = betterncm.fs
    await fs.mkdir('cached')
    await fs.writeFileText('cached/test.txt', '音楽')
    const exists = await fs.exists('cached')
    const text = await fs.readFileText('cached/test.txt')
    const names = await fs.readDir('cached')
    const bundled = await fs.readFileText('/plugin/main.js')
    await fs.remove('cached')
    return [exists, text, names, bundled.includes('onConfig'), await fs.exists('cached')]
  })()`)
  assert.deepEqual(files, [true, '音楽', ['/cached/test.txt'], true, false])
  await run("require('electron').ipcRenderer.invoke('winMain_better_plugins',{action:'remove',id:'compat-test'})")
  assert(panel.isDestroyed(), 'Removed plugin window stayed open')
  const makeScript = text => "plugin.onConfig(({makeBtn}) => makeBtn('" + text + "', () => {}))"
  const local = (await command({ action: 'save-script', name: 'Edit', script: makeScript('One') })).find(row => row.editable)
  await command({ action: 'enable', id: local.id })
  const save = script => command({ action: 'save-script', id: local.id, name: 'Edit', script })
  await save(makeScript('Two'))
  assert.equal(await pluginWindow().webContents.executeJavaScript("document.querySelector('#settings button').textContent"), 'Two')
  await assert.rejects(save("plugin.onLoad(() => { throw Error('wrong revision') })"), /wrong revision/)
  assert.equal(await command({ action: 'read-script', id: local.id }), makeScript('Two'))
  assert.equal(await pluginWindow().webContents.executeJavaScript("document.querySelector('#settings button').textContent"), 'Two')
  assert((await command({ action: 'list' })).find(e => e.id === local.id).enabled)
  await command({ action: 'disable', id: local.id })
  await save("plugin.onConfig(() => { throw Error('invalid config') })")
  await assert.rejects(command({ action: 'enable', id: local.id }), /invalid config/)
  assert(!(await command({ action: 'list' })).find(e => e.id === local.id).enabled)
  await command({ action: 'remove', id: local.id })
  console.log('Plugin cache, live edits, failed upgrades and startup failures passed')
  console.log('Plugin install, isolated renderer, song metadata and removal passed')
  // 可以用上游发布包重复运行原版插件回归，日常离线测试沿用上面的内置夹具。
  if (process.env.Q_MUSIC_OSU_PLUGIN && process.env.Q_MUSIC_OPENCC_PLUGIN) {
    const manage = (action, id) => run("require('electron').ipcRenderer.invoke('winMain_better_plugins'," + JSON.stringify({ action, id }) + ")")
    const installBytes = bytes => run("require('electron').ipcRenderer.invoke('winMain_better_plugins',{ action:'install',bytes:Uint8Array.from(Buffer.from('" + bytes.toString('base64') + "','base64')) })")
    await installBytes(fs.readFileSync(process.env.Q_MUSIC_OSU_PLUGIN))
    await manage('open', 'search-on-osu')
    const osu = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().includes('/betterPlugins/'))
    await osu.webContents.executeJavaScript("window.pageEvents = []; for (const state of ['opened','closed']) window.addEventListener('rnp-lyric-page-' + state, () => window.pageEvents.push(state))")
    await until(() => osu.webContents.executeJavaScript("!!document.querySelector('.btn-osu')"), 'Original osu button missing')
    await osu.webContents.executeJavaScript("void (window.open = url => { window.clickedTrackUrl = url })")
    const buttons = await manage('actions')
    const button = buttons.find(row => row.id === 'search-on-osu' && row.label.includes('osu!'))
    assert(button, 'Plugin action missing from main player')
    await run("document.querySelector('.q-player-footer button').click()")
    await until(() => run("!!document.querySelector('button[aria-label=\"歌曲链接与站外搜索\"]')"), 'Missing track menu')
    await run("document.querySelector('button[aria-label=\"歌曲链接与站外搜索\"]').click()")
    const pluginButton = "Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === " + JSON.stringify(button.label) + ")"
    await until(() => run('!!' + pluginButton), 'Plugin action missing from track menu')
    await run(pluginButton + '.click()')
    await until(() => osu.webContents.executeJavaScript('!!window.clickedTrackUrl'), 'Main player plugin action')
    const target = await osu.webContents.executeJavaScript('window.clickedTrackUrl')
    assert.equal(new URL(target).searchParams.get('q'), track.name + ' ' + track.singer)
    const customPic = path.join(dir, '我的封面 #1.png')
    fs.writeFileSync(customPic, Buffer.from(imageData.split(',')[1], 'base64'))
    const { dialog } = require('electron')
    const showOpenDialog = dialog.showOpenDialog
    try {
      dialog.showOpenDialog = async() => ({ canceled: false, filePaths: [customPic] })
      await run("Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === window.i18n.t('track_cover_select')).click()")
      await until(() => run('window.lxData.musicInfo.pic === ' + JSON.stringify(pathToFileURL(customPic).href)), 'Selecting a local cover in the menu')
      await until(async() => (await query()).track.cover.startsWith('data:image/jpeg;base64,'), 'Serving the selected local cover')
      const lrc = path.join(dir, '本地歌词 #1.lrc')
      const clickLyric = key => run("Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === window.i18n.t(" + JSON.stringify(key) + ")).click()")
      fs.writeFileSync(lrc, '[00:00.00]Local fixture')
      dialog.showOpenDialog = async() => ({ canceled: false, filePaths: [lrc] })
      await clickLyric('track_lyric_select')
      await until(() => osu.webContents.executeJavaScript("window.currentLyrics.lyrics[0]?.originalLyric === 'Local fixture'"), 'RNP local lyric event')
      fs.writeFileSync(lrc, '[00:00.00]Revised fixture')
      await clickLyric('track_lyric_reload')
      await until(() => run("window.lxData.musicInfo.lrc.includes('Revised fixture')"), 'Rereading linked lyrics')
      await clickLyric('track_lyric_reset')
      await until(() => osu.webContents.executeJavaScript("window.currentLyrics.lyrics[0]?.originalLyric === '明日は'"), 'Restoring original lyrics')
    } finally { dialog.showOpenDialog = showOpenDialog }
    await settings({ 'desktopLyric.enable': true, 'playDetail.furigana': true, 'playDetail.furiganaReadings': '明日=あした' })
    await until(() => run("!!Array.from(document.querySelectorAll('.font-mode .font-lrc rt')).find(el => el.textContent.includes('あした'))"), 'Timed Japanese lyric annotations')
    await until(async() => {
      const lyricWindow = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().includes('/lyric.html'))
      return lyricWindow && lyricWindow.webContents.executeJavaScript("Array.from(document.querySelectorAll('.font-mode .font-lrc rt')).some(el => el.textContent === 'あしたは')")
    }, 'Desktop floating lyric annotations').catch(async error => {
      const win = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/lyric.html'))
      if (win) console.error('Floating lyric window:', await win.webContents.executeJavaScript("({lines:document.querySelectorAll('.line-content').length, first:document.querySelector('.line-content')?.outerHTML.slice(0,600)})"))
      throw error
    })
    await settings({ 'desktopLyric.enable': false, 'playDetail.furigana': false })
    await until(() => run("!document.querySelector('.font-mode .font-lrc rt') && document.querySelector('.font-mode .font-lrc')?.textContent === '明日は'"), 'Restoring timed lyrics')
    await run("document.querySelector('button[aria-label=' + JSON.stringify(window.i18n.t('player__hide_detail_tip')) + ']').click()")
    await until(() => osu.webContents.executeJavaScript("window.pageEvents.join(',') === 'opened,closed'"), 'RNP detail open and close')
    await manage('remove', 'search-on-osu')
    assert(!(await manage('actions')).some(row => row.id === 'search-on-osu'))
    const upstreamSource = path.join(os.tmpdir(), 'qmusic-catalog-audit/RevivedSource-0.1.1.plugin')
    if (fs.existsSync(upstreamSource)) {
      await installBytes(fs.readFileSync(upstreamSource))
      await manage('enable', 'RevivedSource')
      await until(async() => (await manage('sources')).some(url => url.includes('RevivedUnblockInstaller')), 'Original alternate catalog source')
      await manage('disable', 'RevivedSource')
      assert(!(await manage('sources')).some(url => url.includes('RevivedUnblockInstaller')))
      await manage('remove', 'RevivedSource')
    }
    await installBytes(fs.readFileSync(process.env.Q_MUSIC_OPENCC_PLUGIN))
    await installBytes(Buffer.from(zipSync({
      'manifest.json': strToU8(JSON.stringify({ name: 'Conversion', slug: 'conversion', requirements: ['LibOpenCC'], injects: { Main: [{ file: './run.js' }] } })),
      'run.js': strToU8("plugin.onConfig(() => { const div = document.createElement('div'); div.id = 'converted'; div.textContent = window.OpenCC.Converter({from:'cn',to:'tw'})('汉字'); return div })"),
    })))
    await manage('open', 'conversion')
    const cc = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().includes('/betterPlugins/'))
    await until(() => cc.webContents.executeJavaScript("document.querySelector('#converted')?.textContent === '漢字'"), 'Real LibOpenCC dependency')
    await manage('remove', 'LibOpenCC')
    assert(cc.isDestroyed(), 'Removed dependency left consumer running')
    await assert.rejects(manage('open', 'conversion'), /plugin_dependency: LibOpenCC/)
    console.log('Unmodified osu and LibOpenCC packages passed')
  }
  await until(() => frames.has(0), 'Missing V2 stereo PCM')
  await settings({ 'integrations.amllVersion': 'v1' })
  await until(() => frames.has(9), 'Missing V1 stereo PCM')
  console.log('AMLL V1/V2 PCM passed')
  const obs = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
  await obs.loadURL('http://127.0.0.1:32374/obs')
  await until(() => obs.webContents.executeJavaScript("!document.querySelector('article').hidden && document.querySelectorAll('#lyric .timed-word').length === 2"), 'OBS timed words')
  if (process.platform === 'win32' && BrowserWindow.getAllWindows().some(win => win.webContents.getURL().includes('/taskbarLyrics/'))) {
    const widget = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().includes('/taskbarLyrics/'))
    await until(() => widget.webContents.executeJavaScript("document.querySelectorAll('p .timed-word').length === 2"), 'Windows taskbar timed words')
  }
  for (const layout of ['card', 'lyrics']) {
    await obs.loadURL('http://127.0.0.1:32374/obs?layout=' + layout + '&radius=5')
    await until(() => obs.webContents.executeJavaScript("document.body.dataset.layout === '" + layout + "' && !document.querySelector('article').hidden && getComputedStyle(document.querySelector('article')).borderRadius === '5px'"), 'OBS layout ' + layout)
    assert.equal(await obs.webContents.executeJavaScript("getComputedStyle(document.querySelector('#timeline')).display === 'none'"), layout === 'lyrics')
  }
  console.log('OBS layouts and timed lyric outputs passed')
  const translator = require('node:http').createServer(async(req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const phrases = JSON.parse(JSON.parse(Buffer.concat(chunks)).messages[1].content)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(phrases.map(() => 'Translated fixture')) } }] }))
  })
  translator.listen(0, '127.0.0.1')
  await once(translator, 'listening')
  try {
    await run("require('electron').ipcRenderer.invoke('winMain_translation_save'," + JSON.stringify({ endpoint: 'http://127.0.0.1:' + translator.address().port, target: 'English', model: 'fixture' }) + ")")
    await settings({ 'playDetail.automaticTranslation': true, 'player.showFooterLyric': true, 'player.footerLyricLanguage': 'translation' })
    await until(() => run("window.lxData.musicInfo.tlrc?.includes('Translated fixture')"), 'Automatic translation')
    await until(() => run("Array.from(document.querySelectorAll('.q-player-footer [title]')).some(el => el.title === 'Translated fixture')"), 'Translated footer lyric')
    console.log('Automatic timed translation and footer lyric passed')
    const other = path.join(dir, 'batch.wav')
    fs.copyFileSync(song, other)
    const batchTrack = { ...track, id: other, name: 'Playlist fixture', meta: { ...track.meta, songId: other, filePath: other } }
    await global.lx.worker.dbService.rawLyricAdd(other, { lyric: '[00:00.00]Another song' })
    await run("require('electron').ipcRenderer.invoke('player_list_music_add'," + JSON.stringify({ id: 'love', musicInfos: [track, batchTrack], addMusicLocationType: 'top' }) + ")")
    await run("location.hash = '/setting?name=SettingPlayDetail&section=model-lyrics'")
    await until(() => run("!!document.querySelector('#model-lyrics[open] form')"), 'Translation settings deep link')
    const startBatch = "Array.from(document.querySelectorAll('#model-lyrics button')).find(el => el.textContent.trim() === window.i18n.t('model_batch_start'))"
    await run(startBatch + '.click()')
    const batchStatus = "document.querySelector('#model-lyrics [role=status]')?.textContent || ''"
    await until(async() => (await run(batchStatus)).includes('已翻译 1 首，跳过 1 首'), 'Playlist translation and skip')
    await run(startBatch + '.click()')
    await until(async() => (await run(batchStatus)).includes('已翻译 0 首，跳过 2 首'), 'Repeated batch should reuse translations')
    console.log('Playlist batch translation, saved lyrics and repeat passed')
  } finally { translator.close() }
  await settings({ 'integrations.sixK': false, 'integrations.amll': false })
  peer?.terminate()
  server.close()
  await until(async() => { try { await query(); return false } catch { return true } }, '6K server did not release port')
  await settings({ 'theme.desktopLayout': 'Ark' })
  await until(() => run("document.documentElement.dataset.desktopLayout === 'Ark'"), 'Selecting saved layout')
  const savedConfig = JSON.parse(fs.readFileSync(path.join(data, 'config_v2.json'), 'utf8'))
  assert.equal(savedConfig.setting['theme.layoutOptions'].Ark.radius, 13)
  main.webContents.reload()
  await until(async() => {
    try { return await run("document.documentElement.classList.contains('q-docked-bar') && document.documentElement.style.getPropertyValue('--layout-user-radius') === '13px'") } catch { return false }
  }, 'Saved layout after renderer restart')
  console.log('Saved layout and player restart passed')
  // 从普通页面直接投放磁盘文件，覆盖 Electron 的原生文件路径及窗口事件入口。
  const secondAudio = path.join(dir, '拖入的歌曲 #2.WAV')
  fs.copyFileSync(song, secondAudio)
  const note = path.join(dir, '备注.txt')
  fs.writeFileSync(note, 'text')
  main.webContents.debugger.attach()
  try {
    const dropFiles = async files => {
      for (const type of ['dragEnter', 'dragOver', 'drop']) {
        await main.webContents.debugger.sendCommand('Input.dispatchDragEvent', {
          type, x: 260, y: 160, data: { items: [], files, dragOperationsMask: 1 },
        })
      }
    }
    const resultText = () => run("document.querySelector('[role=dialog] main [role=status]')?.textContent || ''")
    await dropFiles([song, secondAudio, note])
    await until(async() => {
      const text = await resultText()
      return text.includes('新增 2 首') && text.includes('已跳过 1 个不支持的文件')
    }, 'Import files from the main window')
    await run("Array.from(document.querySelectorAll('[role=dialog] button')).find(e => e.textContent.includes('查看导入歌单')).click()")
    await until(() => run("location.hash.includes('local_music') && !document.querySelector('[role=dialog]')"), 'Open imported playlist')
    await dropFiles([secondAudio])
    await until(async() => (await resultText()).includes('新增 0 首，重复 1 首'), 'Duplicate drop')
    const imported = await run("require('electron').ipcRenderer.invoke('player_list_music_get','local_music')")
    assert.deepEqual(imported.map(item => item.meta.filePath), [song, secondAudio])
  } finally { main.webContents.debugger.detach() }
  console.log('Window file drops, persisted tracks and duplicate handling passed')
}

// 可选的上游原包启动检查。每个插件单独安装，复用正式安装、依赖解析、初始化及移除流程。
async function checkCatalog(folder) {
  const { readBetterPackage, pluginOrder } = await import('../src/common/utils/betterPackage.js')
  let main
  await until(() => {
    main = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().includes('index.html'))
    return main && main.webContents.executeJavaScript('!!window.lxData?.updateSetting')
  }, 'Catalog test player')
  const invoke = cmd => main.webContents.executeJavaScript("require('electron').ipcRenderer.invoke('winMain_better_plugins'," + JSON.stringify(cmd) + ")")
  const report = new Map()
  const parsed = new Map()
  for (const file of fs.readdirSync(folder).filter(file => file.endsWith('.plugin'))) {
    try {
      const item = readBetterPackage(fs.readFileSync(path.join(folder, file)))
      parsed.set(item.id, { id: item.id, requirements: item.requirements, file })
    } catch (error) { report.set(file, { status: 'archive', error: error.message }) }
  }
  const { dialog } = require('electron')
  dialog.showMessageBox = async() => ({ response: 0 })
  for (const item of parsed.values()) {
    try {
      const deps = pluginOrder(item, [...parsed.values()])
      for (const dep of deps) {
        const file = JSON.stringify(path.join(folder, dep.file))
        await main.webContents.executeJavaScript("require('electron').ipcRenderer.invoke('winMain_better_plugins', {action:'install', bytes:require('node:fs').readFileSync(" + file + ")})")
      }
      await invoke({ action: 'enable', id: item.id })
      const win = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/betterPlugins/'))
      report.set(item.file, { status: 'initialized', actions: (await invoke({ action: 'actions' })).map(row => row.label), config: await win.webContents.executeJavaScript('document.querySelector("#settings").childElementCount') })
    } catch (error) {
      report.set(item.file, { status: 'startup', error: error.message.split('Error: ').pop().slice(0, 240) })
    } finally {
      for (const row of await invoke({ action: 'list' })) await invoke({ action: 'remove', id: row.id })
      fs.writeFileSync(process.env.Q_MUSIC_CATALOG_REPORT, JSON.stringify(Object.fromEntries(report), null, 2))
    }
  }
  console.log('Official archives checked:', report.size)
}
const catalogMode = process.env.Q_MUSIC_CATALOG_FIXTURES && process.env.Q_MUSIC_CATALOG_REPORT
const timer = setTimeout(() => { console.error('Desktop integration timeout'); app.exit(1) }, catalogMode ? 25 * 60000 : 90000)
app.whenReady().then(async() => {
  try {
    if (catalogMode) await checkCatalog(process.env.Q_MUSIC_CATALOG_FIXTURES)
    else await verify()
    clearTimeout(timer)
    app.exit(0)
  } catch (error) { console.error(error); app.exit(1) }
})
require(path.join(root, 'dist/main.js'))
