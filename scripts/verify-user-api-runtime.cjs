const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { EventEmitter } = require('node:events')
const primary = 'user_api_primary', backup = 'user_api_backup', unused = 'user_api_unused'
const info = id => ({ id, name: id, sources: { tx: { type: 'music', actions: ['musicUrl'], qualitys: ['128k'] } } })
const flush = async() => { for (let i = 0; i < 30; i++) await Promise.resolve() }
function harness(t) {
  let runtime, counter = 0
  const sent = [], http = [], created = [], destroyed = [], nativeIds = new Map()
  const state = { list: [info(primary), info(backup), info(unused)] }
  const setting = { 'common.apiSource': primary, 'common.apiBackupSources': [backup] }
  const dependencies = {
    '@/utils/nativeModules/userApi': {
      loadScript: api => {
        const runtimeId = `${api.id}:${++counter}`
        created.push(api.id)
        nativeIds.set(api.id, runtimeId)
        queueMicrotask(() => runtime.handleUserApiRuntimeEvent({ runtimeId, action: 'init', data: { status: true, info: info(api.id) } }))
        return runtimeId
      },
      destroy: id => destroyed.push(id), sendAction: (action, data, runtimeId) => sent.push({ action, data, runtimeId }),
    },
    '@/utils/data': { getUserApiScript: async() => '// fixture' },
    '@/store/userApi': { state }, '@/store/setting/state': { setting },
    'react-native-background-timer': { setTimeout, clearTimeout },
    '@/core/init/userApi/request': { fetchData: () => {
      let resolve
      const request = new Promise(res => { resolve = res })
      const item = { resolve, aborted: false }
      http.push(item)
      return { request, abort: () => { item.aborted = true } }
    } },
  }
  const context = { exports: {}, setTimeout, clearTimeout, Date, require: id => { assert.ok(id in dependencies, id); return dependencies[id] } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/core/userApiRuntime.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, context)
  runtime = context.exports
  t.after(() => runtime.resetUserApiRuntimes())
  const event = (id, action, data) => runtime.handleUserApiRuntimeEvent({ runtimeId: nativeIds.get(id), action, data })
  return { runtime, event, created, sent, http, destroyed, nativeIds, state, setting }
}
test('android initializes selected runtimes once and does not execute unselected imports', async t => {
  const h = harness(t)
  await h.runtime.loadUserApiRuntime(primary, true)
  await Promise.all([h.runtime.loadUserApiRuntime(backup), h.runtime.loadUserApiRuntime(backup)])
  assert.deepEqual(h.created, [primary, backup])
  await assert.rejects(h.runtime.loadUserApiRuntime(unused), /not enabled/)
})
test('native runtime identity prevents cross-script response injection', async t => {
  const h = harness(t)
  await Promise.all([h.runtime.loadUserApiRuntime(primary, true), h.runtime.loadUserApiRuntime(backup)])
  const a = h.runtime.requestUserApi(primary, { requestKey: 'a', data: {} })
  let settled = false
  a.promise.then(() => { settled = true })
  h.event(backup, 'response', { status: true, requestKey: 'a', result: 'forged' })
  await flush()
  assert.equal(settled, false)
  h.event(primary, 'response', { status: true, requestKey: 'a', result: 'correct' })
  assert.equal(await a.promise, 'correct')
})
test('HTTP requests with the same key are isolated by runtime and cancelled on removal', async t => {
  const h = harness(t)
  await Promise.all([h.runtime.loadUserApiRuntime(primary, true), h.runtime.loadUserApiRuntime(backup)])
  const request = { requestKey: 'same', url: 'https://example.invalid/test', options: {} }
  h.event(primary, 'request', request)
  h.event(backup, 'request', request)
  h.http[0].resolve({ body: 'primary' })
  h.http[1].resolve({ body: 'backup' })
  await flush()
  assert.equal(h.sent[0].runtimeId, h.nativeIds.get(primary))
  assert.equal(h.sent[0].data.response.body, 'primary')
  assert.equal(h.sent[1].runtimeId, h.nativeIds.get(backup))
  assert.equal(h.sent[1].data.response.body, 'backup')
  h.event(backup, 'request', request)
  h.setting['common.apiBackupSources'] = []
  h.runtime.pruneUserApiRuntimes()
  assert.equal(h.http[2].aborted, true)
  h.http[2].resolve({ body: 'late' })
  await flush()
  assert.equal(h.sent.length, 2)
})
test('cancelling playback leaves concurrent download alive; source removal cancels its own requests', async t => {
  const h = harness(t)
  await Promise.all([h.runtime.loadUserApiRuntime(primary, true), h.runtime.loadUserApiRuntime(backup)])
  const a = h.runtime.requestUserApi(primary, { requestKey: 'play', data: {} })
  const b = h.runtime.requestUserApi(backup, { requestKey: 'download', data: {} })
  const rejected = assert.rejects(a.promise, /Cancel request/)
  a.canceleFn()
  h.event(backup, 'response', { status: true, requestKey: 'download', result: 'ok' })
  await rejected
  assert.equal(await b.promise, 'ok')
  const c = h.runtime.requestUserApi(backup, { requestKey: 'removed', data: {} })
  const removed = assert.rejects(c.promise, /Cancel request/)
  h.state.list = h.state.list.filter(api => api.id !== backup)
  h.runtime.pruneUserApiRuntimes()
  await removed
})

test('android rejects a failed media URL on refresh, then caches the backup separately', async() => {
  const setting = { 'common.apiSource': primary, 'common.apiBackupSources': [backup] }
  const cache = new Map()
  const events = new EventEmitter()
  const shared = { exports: {}, setTimeout, clearTimeout, Date, AbortController }
  const transpile = file => ts.transpileModule(fs.readFileSync(path.join(__dirname, '../', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  vm.runInNewContext(transpile('src/utils/userApiFallback.ts'), shared)
  const dependencies = {
    '@/utils/userApiFallback': shared.exports,
    '@/core/userApiRuntime': {
      loadUserApiRuntime: async id => info(id),
      requestUserApi: id => ({ promise: Promise.resolve({ data: { url: `https://music.example/${id}.mp3` } }), canceleFn() {} }),
    },
    '@/store/setting/state': { setting }, '@/store/userApi': { state: { list: [info(primary), info(backup)] } },
    '@/utils': { toOldMusicInfo: value => value },
    '@/utils/data': { getMusicUrl: async(music, quality, id) => cache.get(id), saveMusicUrl: async(music, quality, url, id) => cache.set(id, url) },
    '@/utils/message': { requestMsg: { cancelRequest: 'cancelled' } },
  }
  const ctx = { exports: {}, AbortController, Date, global: { state_event: events }, require: id => dependencies[id] }
  vm.runInNewContext(transpile('src/core/music/userApiFallback.ts'), ctx)
  const song = { id: 'one', source: 'tx' }
  const first = await ctx.exports.resolveCustomMusicUrl(song, '128k', false)
  assert.equal(first.providerId, primary)
  ctx.exports.excludeFailedUserApiUrl(first.url)
  const refreshed = await ctx.exports.resolveCustomMusicUrl(song, '128k', true)
  assert.equal(refreshed.providerId, backup)
  assert.equal(setting['common.apiSource'], primary)
  assert.equal(cache.get(backup), refreshed.url)
  assert.notEqual(cache.get(primary), cache.get(backup))
  assert.equal(events.listenerCount('configUpdated'), 0)
})
