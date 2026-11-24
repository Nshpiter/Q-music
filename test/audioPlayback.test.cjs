const test = require('node:test')
const assert = require('node:assert/strict')
const ts = require('typescript')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const flush = () => new Promise(resolve => setImmediate(resolve))
function harness() {
  let audio
  const decks = []
  const requests = []
  class Audio extends EventTarget {
    constructor() { super(); audio = this; decks.push(this); this.src = ''; this.error = null; this.paused = false; this.duration = 100; this.currentTime = 96; this.playbackRate = 1 }
    play() { return new Promise((resolve, reject) => { requests.push({ resolve, reject }) }) }
    pause() { this.paused = true }
    load() {}
    removeAttribute() { this.src = '' }
  }
  const exports = {}
  const source = fs.readFileSync(path.join(__dirname, '../src/renderer/plugins/player/index.ts'), 'utf8').replaceAll('import.meta.url', JSON.stringify('file:///test/player.js'))
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, window: { Audio }, DOMException, Event, performance, setInterval, clearInterval })
  exports.createAudio()
  return { api: exports, audio, requests, decks }
}
test('交叉淡化期间暂停、定位和停止均释放尾轨，尾轨结束只通知一次队列', () => {
  for (const action of ['setPause', 'setCurrentTime', 'setStop']) {
    const { api, audio, decks } = harness()
    let ended = 0
    api.onEnded(() => { ended++ })
    assert.equal(api.beginCrossfade(), true)
    audio.dispatchEvent(new Event('ended'))
    assert.equal(ended, 0)
    assert.equal(decks[1].volume, 0)
    api[action](10)
    assert.equal(audio.paused, true)
    assert.equal(decks[1].volume, 1)
    decks[1].dispatchEvent(new Event('ended'))
    assert.equal(ended, 1)
  }
})
test('获取地址后明确开始播放，拒绝启动时发出错误而不是静默停在 0:00', async() => {
  const { api, requests } = harness()
  let failures = 0
  api.onError(() => { failures++ })
  api.setResource('https://example.test/audio.mp3')
  assert.equal(requests.length, 1)
  requests[0].reject(new DOMException('Not allowed', 'NotAllowedError'))
  await flush()
  assert.equal(failures, 1)
  assert.equal(api.getErrorCode(), 1)
})

test('关闭自动跳歌时加载仍有超时，暂停后旧超时不再重试', () => {
  const { EventEmitter } = require('node:events')
  const events = new EventEmitter(), timers = new Map()
  let retries = 0, timerId = 0
  const dependencies = {
    '@common/utils/vueTools': { onBeforeUnmount() {} },
    '@renderer/plugins/i18n': { useI18n: () => key => key },
    '@renderer/store/player/state': { musicInfo: { id: 'song' }, playMusicInfo: { musicInfo: { id: 'song' } }, isPlayPending: { value: false } },
    '@renderer/plugins/player': { setStop() {}, isEmpty: () => false },
    '@renderer/core/player': { retryMusicUrl() { retries++ }, handlePlaybackFailure() {} },
    '@renderer/core/player/recovery': { playbackRecovery: { token: () => 1, isCurrent: () => true, isCancelled: () => false } },
    '@renderer/store/player/action': { setAllStatus() {} },
    '@renderer/store/setting': { appSetting: { 'player.autoSkipOnError': false } },
  }
  const api = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/renderer/core/useApp/usePlayer/usePlayEvent.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports: api, require: id => dependencies[id], window: { app_event: events, lx: {} },
    setTimeout: fn => { timers.set(++timerId, fn); return timerId }, clearTimeout: id => timers.delete(id),
  })
  api.default()
  events.emit('playerLoadstart')
  assert.equal(timers.size, 1)
  for (const fn of timers.values()) fn()
  assert.equal(retries, 1)
  events.emit('playerWaiting')
  events.emit('playerPause')
  assert.equal(timers.size, 0)
})
test('暂停或切歌后旧播放 Promise 的拒绝不会影响新歌曲，浏览器原生错误不重复上报', async() => {
  const { api, requests, audio } = harness()
  let failures = 0
  api.onError(() => { failures++ })
  api.setResource('https://example.test/one.mp3')
  api.setPause()
  requests[0].reject(new DOMException('Interrupted', 'AbortError'))
  api.setPlay()
  api.setResource('https://example.test/two.mp3')
  requests[1].reject(new DOMException('Old', 'NotSupportedError'))
  await flush()
  assert.equal(failures, 0)
  audio.error = { code: 4 }
  audio.dispatchEvent(new Event('error'))
  requests[2].reject(new DOMException('Unsupported', 'NotSupportedError'))
  await flush()
  assert.equal(failures, 1)
})
