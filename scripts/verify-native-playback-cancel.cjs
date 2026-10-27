const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const flush = async() => { for (let i = 0; i < 50; i++) await Promise.resolve() }
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes }); return { promise, resolve } }
function harness(holdCleanup = false) {
  const gate = deferred(), cleanup = deferred(), events = [], queue = []
  let active = true
  const player = {
    getCurrentTrack: async() => null,
    add: async tracks => { events.push('add'); queue.push(...tracks); await gate.promise },
    getQueue: async() => queue,
    skip: async() => events.push('skip'),
    seekTo: async() => events.push('seek'),
    play: async() => events.push('play'),
    pause: async() => events.push('pause'),
    getState: async() => 'paused',
    updateNowPlayingMetadata: async(info, playing) => events.push(`metadata:${playing}`),
    remove: async indices => {
      if (holdCleanup) { events.push('remove'); await cleanup.promise }
      queue.splice(0, indices.length)
    },
  }
  const state = { musicInfo: {} }
  const dependencies = {
    'react-native-track-player': { __esModule: true, default: player, State: { Playing: 'playing' } },
    'react-native-background-timer': { setTimeout: () => 1, clearTimeout() {} },
    '@/config': { defaultUrl: 'placeholder' }, '@/store/setting/state': { setting: {} }, '@/store/player/state': state,
  }
  const context = { exports: {}, console: { log() {} }, global: { lx: {}, app_event: { playerError: () => events.push('error') } }, require: id => { if (!(id in dependencies)) throw Error(id); return dependencies[id] } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/plugins/player/playList.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, context)
  return { api: context.exports, events, gate, cleanup, cancel: () => { active = false; context.exports.cancelPlayMusic() }, shouldPlay: () => active }
}
const song = { id: 'one', name: 'one', singer: 'artist', meta: {} }

test('冷启动恢复历史曲目只装载暂停占位曲目，不发起播放，元数据也报告暂停', async() => {
  const h = harness()
  const restored = h.api.initTrackInfo(song, { id: 'one', name: 'one', singer: 'artist' })
  await flush()
  assert.deepEqual(h.events, ['pause', 'add'])
  h.gate.resolve()
  await restored
  await flush()
  assert.deepEqual(h.events, ['pause', 'add', 'skip', 'metadata:false'])
})

test('恢复占位曲目时立即选歌，恢复任务不再跳回旧歌或覆盖通知', async() => {
  const h = harness()
  void h.api.initTrackInfo(song, { id: 'one', name: 'one' })
  await flush()
  h.api.playMusic({ ...song, id: 'two' }, 'https://example.test/two.mp3', 0)
  h.gate.resolve()
  await flush()
  assert.deepEqual(h.events, ['pause', 'add', 'add', 'skip', 'play'])
})
test('安卓原生队列 add 尚未完成时取消，不再 skip/seek/play', async() => {
  const h = harness()
  h.api.playMusic(song, 'https://example.test/one.mp3', 12, h.shouldPlay)
  await flush()
  assert.deepEqual(h.events, ['add'])
  h.cancel()
  h.gate.resolve()
  await flush()
  assert.deepEqual(h.events, ['add'])
})
test('安卓快速切歌串行处理，旧任务不启动，最新歌曲只播放一次', async() => {
  const h = harness()
  h.api.playMusic(song, 'https://example.test/one.mp3', 0)
  await flush()
  h.api.playMusic({ ...song, id: 'two' }, 'https://example.test/two.mp3', 0)
  h.gate.resolve()
  await flush()
  assert.deepEqual(h.events, ['add', 'add', 'skip', 'play'])
})

test('安卓清理旧队列完成后才加入新歌曲，避免迟到删除影响新队列', async() => {
  const h = harness(true)
  h.gate.resolve()
  h.api.playMusic(song, 'https://example.test/one.mp3', 0)
  await flush()
  h.api.playMusic({ ...song, id: 'two' }, 'https://example.test/two.mp3', 0)
  await flush()
  assert.equal(h.events.at(-1), 'remove')
  const before = [...h.events]
  h.api.playMusic({ ...song, id: 'three' }, 'https://example.test/three.mp3', 0)
  await flush()
  assert.deepEqual(h.events, before)
  h.cleanup.resolve()
  await flush()
  assert.equal(h.events.filter(event => event == 'play').length, 3)
  assert.equal(h.events.filter(event => event == 'add').length, 3)
})
