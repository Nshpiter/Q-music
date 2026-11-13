const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { EventEmitter } = require('node:events')
function load(file, dependencies, globals = {}) {
  const context = { exports: {}, ...globals, require: id => {
    if (!(id in dependencies)) throw Error(id)
    return dependencies[id]
  } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, context)
  return context.exports
}
const song = (id = '42', source = 'wy') => ({ id: `${source}_${id}`, source, meta: { songId: id, albumId: '9' } })
const settle = () => new Promise(resolve => setImmediate(resolve))
const reportModule = dependencies => load('src/core/musicAccount/playbackReport.ts', { './requests': dependencies })

test('原曲身份：不使用换源 ID，排除下载、本地、非网易云和非法 ID', () => {
  const { originalPlaybackIdentity: identity } = reportModule({})
  assert.equal(identity({ ...song(), meta: { ...song().meta, toggleMusicInfo: song('999', 'tx') } }).songId, '42')
  assert.equal(identity(song('43', 'tx')), null)
  assert.equal(identity({ ...song(), progress: 0 }), null)
  for (const id of ['0', 'NaN', '1.5', '90071992547409999']) assert.equal(identity(song(id)), null)
  assert.equal(identity({ ...song(), meta: { songId: 42, albumId: 'invalid' } }).sourceId, '0')
})

test('请求使用会话校验和官方日志格式，账号切换时不发送', async() => {
  const calls = []
  let changed = false
  const api = reportModule({
    assertAccountSession: async() => { if (changed) throw Error('account_changed') },
    wyRequest: async(...args) => { calls.push(args) },
  })
  const session = { provider: 'wy' }
  const identity = api.originalPlaybackIdentity(song())
  await api.reportPlayback(session, identity, 4)
  assert.equal(calls.length, 0)
  await api.reportPlayback(session, identity, 6.4)
  assert.equal(calls[0][1], 'feedback/weblog')
  const logs = JSON.parse(calls[0][2].logs)
  assert.deepEqual(logs.map(row => row.action), ['startplay', 'play'])
  assert.equal(logs[1].json.id, 42)
  assert.equal(logs[1].json.time, 6)
  changed = true
  await assert.rejects(api.reportPlayback(session, identity, 7), /account_changed/)
  assert.equal(calls.length, 1)
})

function player(options = {}) {
  const events = new EventEmitter(), timers = new Map(), reports = []
  let time = 0, position = 0, timerId = 0, track
  const state = { playMusicInfo: { musicInfo: song() }, musicInfo: { id: song().id }, isPlay: true }
  const setTrack = (music, url = 'https://third-party.example/song.mp3') => {
    state.playMusicInfo.musicInfo = music
    state.musicInfo.id = music.id
    track = { id: `${music.id}__//real`, musicId: music.id, url }
    position = 0
  }
  setTrack(song())
  load('src/core/init/player/playbackReport.ts', {
    'react-native-background-timer': { setInterval: fn => { timers.set(++timerId, fn); return timerId }, clearInterval: id => timers.delete(id) },
    '@/store/player/state': state,
    '@/plugins/player': { getPosition: async() => options.positionGate ? options.positionGate(position) : position },
    '@/plugins/player/playList': { getCurrentTrack: async() => track, isTempTrack: id => id.endsWith('//default') },
    '@/core/musicAccount/playbackReport': {
      originalPlaybackIdentity: reportModule({}).originalPlaybackIdentity,
      openPlaybackSession: async() => ({ provider: 'wy' }),
      reportPlayback: async(_, identity, seconds) => { reports.push({ ...identity, seconds }); if (options.fail) throw Error(options.fail) },
    },
  }, { global: { app_event: events }, performance: { now: () => time } }).default()
  return {
    reports, events, timers, setTrack, state,
    async start() { events.emit('playerPlaying'); await settle() },
    async tick(delta = 1) { time += 1000; position += delta; for (const fn of [...timers.values()]) fn(); await settle() },
  }
}

test('实际第三方播放满五秒只回传一次，后台计时不依赖屏幕事件', async() => {
  const p = player(); await p.start()
  for (let i = 0; i < 4; i++) await p.tick()
  assert.equal(p.reports.length, 0)
  await p.tick()
  assert.equal(p.reports[0].songId, '42')
  assert.equal(p.reports[0].seconds, 5)
  for (let i = 0; i < 10; i++) await p.tick()
  assert.equal(p.reports.length, 1)
  assert.equal(p.timers.size, 0)
})

test('暂停、拖动、快速切歌不凑够五秒或串歌；本地缓存不回传', async() => {
  const p = player(); await p.start(); await p.tick()
  p.events.emit('playerPause')
  for (let i = 0; i < 20; i++) await p.tick()
  await p.start(); p.events.emit('setProgress', 200); await p.tick(200)
  assert.equal(p.reports.length, 0)
  p.events.emit('musicToggled'); p.setTrack(song('43')); await p.start()
  for (let i = 0; i < 5; i++) await p.tick()
  assert.equal(p.reports.length, 1)
  assert.equal(p.reports[0].songId, '43')
  p.events.emit('musicToggled'); p.setTrack(song('44'), 'file:///cache/song.mp3'); await p.start()
  for (let i = 0; i < 10; i++) await p.tick()
  assert.equal(p.reports.length, 1)
  assert.equal(p.timers.size, 0)
})

test('网络失败最多尝试两次，账号失效只尝试一次', async() => {
  for (const [fail, count] of [['unavailable', 2], ['account_changed', 1]]) {
    const p = player({ fail }); await p.start()
    for (let i = 0; i < 20; i++) await p.tick()
    assert.equal(p.reports.length, count)
    assert.equal(p.timers.size, 0)
  }
})

test('切歌时迟到的原生进度不会记到新歌曲，倍速不放大真实时长', async() => {
  let release, gate = true
  const p = player({ positionGate: position => gate ? new Promise(resolve => { release = resolve }) : position })
  await p.start()
  p.events.emit('musicToggled')
  p.setTrack(song('99'))
  await p.start()
  gate = false
  release(250)
  await settle()
  await p.tick(2)
  for (let i = 0; i < 4; i++) await p.tick(2)
  assert.equal(p.reports.length, 0)
  await p.tick(2)
  assert.equal(p.reports.length, 1)
  assert.equal(p.reports[0].songId, '99')
  assert.equal(p.reports[0].seconds, 5)
})
