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

test('开始与结束分别发送官方日志，账号切换时不发送', async() => {
  const calls = []
  let changed = false
  const api = reportModule({
    assertAccountSession: async() => { if (changed) throw Error('account_changed') },
    wyClientLogRequest: async(_, log) => { calls.push(log) },
  })
  const session = { provider: 'wy' }
  const identity = api.originalPlaybackIdentity(song())
  await api.reportPlaybackStart(session, identity, 4)
  await api.reportPlaybackFinish(session, identity, 4.9)
  assert.equal(calls.length, 0)
  await api.reportPlaybackStart(session, identity, 5.2)
  await api.reportPlaybackFinish(session, identity, 186.7)
  assert.deepEqual(calls.map(row => row.action), ['startplay', 'play'])
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].json)), { id: 42, type: 'song', mainsite: '1', mainsiteWeb: '1', content: 'id=9' })
  assert.equal(calls[1].json.id, 42)
  assert.equal(calls[1].json.sourceId, '9')
  assert.equal(calls[1].json.end, 'playend')
  assert.equal(calls[1].json.time, 186)
  changed = true
  await assert.rejects(api.reportPlaybackFinish(session, identity, 7), /account_changed/)
  assert.equal(calls.length, 2)
})

test('播放日志走 clientlog eapi 并声明 osx 客户端，不再走会被丢弃的 weapi', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src/core/musicAccount/requests.ts'), 'utf8')
  const block = source.slice(source.indexOf('export const wyClientLogRequest'))
  assert.match(block, /https:\/\/clientlog\.music\.163\.com\/eapi\/feedback\/weblog/)
  assert.match(block, /os: 'osx'/)
  assert.match(block, /eapi\(path,/)
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '..', 'src/core/musicAccount/playbackReport.ts'), 'utf8'), /wyRequest/)
})

test('账号请求区分网络失败、用户取消、平台限制与登录失效', async() => {
  let next
  const api = load('src/core/musicAccount/requests.ts', {
    './cookies': { buildCookieHeader: () => '', getProviderCookies: async() => ({}), getQQCredentials: () => ({}), isNeteaseLoginCookieValid: () => true, isQQLoginCookieValid: () => true },
    '@/utils/musicSdk/wy/utils/crypto': { eapi: () => ({ params: 'x' }), weapi: () => ({ params: 'x', encSecKey: 'y' }) },
    './types': {},
    './qqCredentials': { getQQRequestComm: () => ({}) },
  }, { fetch: async(url, init) => next(init), AbortController, setTimeout, clearTimeout, URLSearchParams, TypeError, Error })
  const session = { provider: 'wy', cookies: {} }
  next = async() => { throw new TypeError('Network request failed') }
  await assert.rejects(api.wyRequest(session, 'x', {}), /^Error: network$/)
  const controller = new AbortController()
  next = init => new Promise((_, reject) => { init.signal.addEventListener('abort', () => { reject(Object.assign(Error('Aborted'), { name: 'AbortError' })) }) })
  const cancelled = api.wyRequest(session, 'x', {}, controller.signal)
  controller.abort()
  await assert.rejects(cancelled, /^Error: cancelled$/)
  next = async() => ({ ok: true, json: async() => ({ code: -462 }) })
  await assert.rejects(api.wyRequest(session, 'x', {}), error => error.message == 'restricted' && error.platformCode == -462)
  next = async() => ({ ok: false, status: 429 })
  await assert.rejects(api.wyRequest(session, 'x', {}), /restricted/)
  next = async() => ({ ok: true, json: async() => ({ code: 301 }) })
  await assert.rejects(api.wyRequest(session, 'x', {}), /login_required/)
  const sync = load('src/core/musicAccount/syncState.ts', {})
  assert.equal(sync.playlistSyncErrorKey('network'), 'list_sync_network')
  assert.equal(sync.playlistSyncErrorKey('restricted'), 'list_sync_restricted')
  assert.equal(sync.playlistSyncErrorKey('cancelled'), 'list_sync_cancelled')
  assert.equal(sync.playlistSyncErrorKey('unavailable'), 'list_sync_failed')
})

function player(options = {}) {
  const events = new EventEmitter(), timers = new Map(), reports = [], finishes = []
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
    'react-native-background-timer': { setInterval: fn => { timers.set(++timerId, fn); return timerId }, clearInterval: id => timers.delete(id), setTimeout: fn => { setImmediate(fn) } },
    '@/store/player/state': state,
    '@/plugins/player': { getPosition: async() => options.positionGate ? options.positionGate(position) : position },
    '@/plugins/player/playList': { getCurrentTrack: async() => track, isTempTrack: id => id.endsWith('//default') },
    '@/core/musicAccount/playbackReport': {
      MIN_REPORT_SECONDS: 5,
      originalPlaybackIdentity: reportModule({}).originalPlaybackIdentity,
      openPlaybackSession: async() => options.session ? options.session() : { provider: 'wy' },
      reportPlaybackStart: async(_, identity, seconds) => { reports.push({ ...identity, seconds }); if (options.fail) throw Error(options.fail) },
      reportPlaybackFinish: async(_, identity, seconds) => { finishes.push({ ...identity, seconds }); if (options.failFinish) throw Error(options.failFinish) },
    },
  }, { global: { app_event: events }, performance: { now: () => time } }).default()
  return {
    reports, finishes, events, timers, setTrack, state,
    async start() { events.emit('playerPlaying'); await settle() },
    async tick(delta = 1) { time += 1000; position += delta; for (const fn of [...timers.values()]) fn(); await settle() },
  }
}
const flushAll = async() => { for (let i = 0; i < 6; i++) await settle() }

test('满五秒登记开始播放一次，结束时按实际秒数回传，后台计时不依赖屏幕事件', async() => {
  const p = player(); await p.start()
  for (let i = 0; i < 4; i++) await p.tick()
  assert.equal(p.reports.length, 0)
  await p.tick()
  assert.equal(p.reports[0].songId, '42')
  assert.equal(p.reports[0].seconds, 5)
  for (let i = 0; i < 9; i++) await p.tick()
  assert.equal(p.reports.length, 1)
  assert.equal(p.finishes.length, 0)
  assert.equal(p.timers.size, 1)
  p.events.emit('playerEnded'); await flushAll()
  assert.equal(p.finishes.length, 1)
  assert.equal(p.finishes[0].songId, '42')
  // 开始记录发出后每 3 秒采样一次，结束时最多少计两秒，不会多计。
  assert.ok(p.finishes[0].seconds >= 12 && p.finishes[0].seconds <= 14)
  assert.equal(p.timers.size, 0)
  p.events.emit('musicToggled'); await flushAll()
  assert.equal(p.finishes.length, 1)
})

test('暂停、拖动、快速切歌不凑够五秒或串歌；本地缓存不回传', async() => {
  const p = player(); await p.start(); await p.tick()
  p.events.emit('playerPause')
  for (let i = 0; i < 20; i++) await p.tick()
  await p.start(); p.events.emit('setProgress', 200); await p.tick(200)
  assert.equal(p.reports.length, 0)
  p.events.emit('musicToggled'); await flushAll()
  assert.equal(p.finishes.length, 0)
  p.setTrack(song('43')); await p.start()
  for (let i = 0; i < 5; i++) await p.tick()
  assert.equal(p.reports.length, 1)
  assert.equal(p.reports[0].songId, '43')
  p.events.emit('musicToggled'); await flushAll()
  assert.equal(p.finishes.length, 1)
  assert.equal(p.finishes[0].songId, '43')
  p.setTrack(song('44'), 'file:///cache/song.mp3'); await p.start()
  for (let i = 0; i < 10; i++) await p.tick()
  p.events.emit('musicToggled'); await flushAll()
  assert.equal(p.reports.length, 1)
  assert.equal(p.finishes.length, 1)
  assert.equal(p.timers.size, 0)
})

test('网络失败最多尝试两次，账号失效只尝试一次且不再回传结束', async() => {
  for (const [fail, count, finishCount] of [['unavailable', 2, 2], ['account_changed', 1, 0]]) {
    const p = player({ fail, failFinish: fail }); await p.start()
    for (let i = 0; i < 20; i++) await p.tick()
    assert.equal(p.reports.length, count)
    p.events.emit('stop'); await flushAll()
    assert.equal(p.reports.length, count)
    assert.equal(p.finishes.length, finishCount)
    assert.equal(p.timers.size, 0)
  }
})

test('未登录时不发送任何记录，也不保留后台轮询', async() => {
  const p = player({ session: async() => { throw Error('login_required') } }); await p.start()
  for (let i = 0; i < 8; i++) await p.tick()
  p.events.emit('playerEnded'); await flushAll()
  assert.equal(p.finishes.length, 0)
  assert.equal(p.timers.size, 0)
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
