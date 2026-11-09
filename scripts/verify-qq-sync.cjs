const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const crypto = require('node:crypto')
const root = path.join(__dirname, '..')
function load(file, dependencies = {}, globals = {}) {
  if (file != 'src/utils/playlistMerge.ts') dependencies['@/utils/playlistMerge'] = load('src/utils/playlistMerge.ts')
  const context = { exports: {}, Error, Buffer, URL, AbortController, setTimeout, clearTimeout,
    require: id => { assert.ok(id in dependencies, `Missing mock: ${id}`); return dependencies[id] }, ...globals }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, context)
  return context.exports
}
const qq = load('src/core/musicAccount/qqCredentials.ts')
const sign = load('src/utils/musicSdk/tx/utils/crypto.js', {
  '@/utils/nativeModules/crypto': { hashSHA1: async text => crypto.createHash('sha1').update(text).digest('hex') },
})
const cookies = { uin: '123', qm_keyst: 'Q_H_L_test', login_type: '1' }
const account = { provider: 'tx', owner: '123', cookies }
const songMid = 'testSong123'
const flush = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

function favoriteHarness(options = {}) {
  const calls = []
  let checks = 0
  let written = false
  let changed = false
  const api = load('src/core/musicAccount/qqFavorite.ts', {
    '@/utils/qqPlaylistTarget': require('./load-pure-module.cjs')('src/utils/qqPlaylistTarget.ts'),
    './playlists': { openPlaylistSession: async() => { throw Error('unexpected playlist request') } },
    './qqCredentials': qq,
    '@/utils/musicSdk/tx/utils/crypto': sign,
    './requests': {
      openAccountSession: async () => account,
      assertAccountSession: async () => { if (changed) throw Error('account_changed') },
      request: async (url, _cookies, init) => {
        const body = JSON.parse(init.body)
        const name = Object.keys(body).find(key => key !== 'comm')
        calls.push({ url, init, body, name })
        if (options.gate) await options.gate.promise
        if (name === 'verify') {
          checks++
          if (written && options.verifyError) return { code: 0, verify: { code: 500 } }
          return { code: 0, verify: { code: 0, data: { m_fan: { [songMid]: options.already || (written && !options.unconfirmed) ? 1 : 0 } } } }
        }
        if (name === 'detail') {
          if (options.changeAccount) changed = true
          return { code: 0, detail: { code: 0, data: { track_info: { mid: songMid, id: 987654, type: 0 } } } }
        }
        written = true
        if (options.networkFailure) throw Error('network')
        return { code: options.code ?? 0, favorite: { code: 0, data: {} } }
      },
    },
  }, { setTimeout: callback => { queueMicrotask(callback); return 1 } })
  return { api, calls, checks: () => checks }
}

test('安卓 QQ 收藏签名原始 JSON，使用真实数字 ID，写后读回确认', async () => {
  const h = favoriteHarness()
  const result = await h.api.addQQFavoriteSong({ songMid })
  assert.equal(result.status, 'added')
  assert.equal(result.owner, '123')
  assert.equal(result.accountId, qq.getQQSyncIdentity(cookies))
  const writes = h.calls.filter(call => call.name === 'favorite')
  assert.equal(writes.length, 1)
  const write = writes[0]
  assert.equal(write.url, 'https://u.y.qq.com/cgi-bin/musics.fcg?sign=' + await sign.zzcSign(write.init.body))
  assert.equal(write.init.headers['Content-Type'], 'application/x-www-form-urlencoded;charset=UTF-8')
  assert.equal(write.init.headers.Referer, 'https://y.qq.com/')
  assert.deepEqual(write.body.favorite.param, { dirId: 201, v_songInfo: [{ songId: 987654, songType: 0 }] })
  assert.equal(h.checks(), 2)
})

test('已收藏只读返回；并发重复点击只产生一次写入', async () => {
  const already = favoriteHarness({ already: true })
  assert.equal((await already.api.addQQFavoriteSong({ songMid })).status, 'added')
  assert.equal(already.calls.length, 1)
  const gate = deferred()
  const h = favoriteHarness({ gate })
  const first = h.api.addQQFavoriteSong({ songMid })
  const second = h.api.addQQFavoriteSong({ songMid })
  gate.resolve()
  assert.equal((await first).status, 'added')
  assert.equal((await second).status, 'added')
  assert.equal(h.calls.filter(call => call.name === 'favorite').length, 1)
})

test('收藏回查失败或网络断开保持未知；code 0 但未读到不会宣称成功', async () => {
  for (const options of [{ verifyError: true }, { networkFailure: true }]) {
    const h = favoriteHarness(options)
    assert.equal((await h.api.addQQFavoriteSong({ songMid })).status, 'unknown')
    assert.equal(h.calls.filter(call => call.name === 'favorite').length, 1)
  }
  const h = favoriteHarness({ unconfirmed: true })
  assert.equal((await h.api.addQQFavoriteSong({ songMid })).status, 'unconfirmed')
  const count = h.calls.filter(call => call.name === 'favorite').length
  assert.equal((await h.api.addQQFavoriteSong({ songMid, action: 'check' })).status, 'not_found')
  assert.equal(h.calls.filter(call => call.name === 'favorite').length, count)
})

test('收藏途中切账号不写；空白返回码不误判成功', async () => {
  const changed = favoriteHarness({ changeAccount: true })
  assert.equal((await changed.api.addQQFavoriteSong({ songMid })).status, 'account_changed')
  assert.equal(changed.calls.filter(call => call.name === 'favorite').length, 0)
  assert.equal((await favoriteHarness({ code: ' ' }).api.addQQFavoriteSong({ songMid })).status, 'unknown')
})

function syncHarness(options = {}) {
  const original = { id: 'local', source: 'tx', sourceListId: 'account:123:dir:201', name: '我喜欢' }
  const state = { userList: options.newList ? [] : [original] }
  const settings = options.newList ? {} : { local: { isAutoUpdate: true, sourceAccountId: qq.getQQSyncIdentity(cookies), updateTime: 0 } }
  const writes = []
  const events = []
  let reads = 0
  let changed = false
  const data = {
    getListUpdateInfo: async () => settings,
    setListUpdateTime: async (id, time) => { settings[id] ??= {}; settings[id].updateTime = time; events.push('time') },
    setListSourceAccount: async (id, binding) => { settings[id] ??= {}; settings[id].sourceAccountId = binding },
    setListSourceSnapshot: async (id, snapshot) => { settings[id] ??= {}; settings[id].sourceSnapshot = snapshot },
    setListAutoUpdate: async (id, enable) => { settings[id] ??= {}; settings[id].isAutoUpdate = enable },
  }
  const api = load('src/core/musicAccount/playlistSync.ts', {
    '@/store/list/state': state, './qqCredentials': qq, '@/utils/data': data,
    './syncState': { setPlaylistSyncState: (_id, status) => events.push(status.phase) },
    '@/core/list': {
      getListMusics: async () => options.current ?? [],
      setFetchingListStatus() {},
      createList: async list => { writes.push(list); state.userList.push(list) },
      overwriteListMusics: async (id, tracks) => { if (options.saveFailure) throw Error('save_failed'); writes.push({ id, tracks }); events.push('write') },
    },
    './playlists': {
      assertPlaylistSession: async () => { if (changed) throw Error('account_changed') },
      getAccountPlaylistTracks: async (_session, _id, _signal, onProgress) => {
        reads++
        if (options.gate) await options.gate.promise
        if (options.changeAccount) changed = true
        if (options.afterFetch) options.afterFetch({ settings, state, original })
        onProgress(2, 2)
        return [{ id: 'one' }, { id: 'two' }]
      },
    },
  })
  return { api, state, settings, writes, events, reads: () => reads, run: (automatic = false) => api.syncAccountPlaylist(account, { id: 'dir:201', name: '我喜欢' }, undefined, undefined, automatic) }
}

test('QQ 新导入绑定账号并默认自动更新，已有关闭状态不被手动同步重开', async () => {
  const fresh = syncHarness({ newList: true })
  const result = await fresh.run()
  assert.equal(fresh.settings[result.id].isAutoUpdate, true)
  assert.equal(fresh.settings[result.id].sourceAccountId, qq.getQQSyncIdentity(cookies))
  const existing = syncHarness()
  existing.settings.local.isAutoUpdate = false
  await existing.run()
  assert.equal(existing.settings.local.isAutoUpdate, false)
  assert.ok(existing.events.indexOf('time') > existing.events.indexOf('write'))
})

test('安卓实际同步写入保留手动曲目；保存失败不推进来源快照', async () => {
  const current = [{ id: 'removed', source: 'tx' }, { id: 'extra', source: 'kg' }]
  const previous = { sourceKey: 'tx:account:123:dir:201', musicKeys: ['tx:removed'] }
  const h = syncHarness({ current })
  h.settings.local.sourceSnapshot = previous
  await h.run()
  assert.deepEqual(JSON.parse(JSON.stringify(h.writes[0].tracks)), [{ id: 'one' }, { id: 'two' }, current[1]])
  assert.equal(h.settings.local.sourceSnapshot.musicKeys.includes('kg:extra'), false)
  const failed = syncHarness({ current, saveFailure: true })
  failed.settings.local.sourceSnapshot = previous
  await assert.rejects(failed.run(), /save_failed/)
  assert.equal(failed.settings.local.sourceSnapshot, previous)
})

test('未绑定旧列表和其他身份不自动覆盖；并发导入只保存一次', async () => {
  const old = syncHarness()
  delete old.settings.local.sourceAccountId
  await assert.rejects(old.run(true), /cancelled/)
  assert.equal(old.reads(), 0)
  const other = syncHarness()
  other.settings.local.sourceAccountId = 'qq:1:999'
  await assert.rejects(other.run(), /account_changed/)
  assert.equal(other.reads(), 0)
  const gate = deferred()
  const h = syncHarness({ gate })
  const first = h.run()
  const second = h.run()
  gate.resolve()
  await Promise.all([first, second])
  assert.equal(h.reads(), 1)
  assert.equal(h.writes.length, 1)
})

test('删除、重绑、关闭自动更新、切账号和写入失败不更新歌单时间', async () => {
  const cases = [
    { afterFetch: ({ state }) => { state.userList = [] } },
    { afterFetch: ({ original }) => { original.sourceListId = 'account:123:8' } },
    { afterFetch: ({ settings }) => { settings.local.isAutoUpdate = false } },
    { changeAccount: true },
    { saveFailure: true },
  ]
  for (const options of cases) {
    const h = syncHarness(options)
    await assert.rejects(h.run(true))
    assert.equal(h.writes.length, 0)
    assert.equal(h.settings.local.updateTime, 0)
    assert.equal(h.events.at(-1), 'error')
  }
})

function autoHarness() {
  const app = { currentState: 'active', addEventListener: (_event, callback) => { app.change = callback } }
  const binding = qq.getQQSyncIdentity(cookies)
  const list = { id: 'local', source: 'tx', sourceListId: 'account:123:dir:201' }
  const state = { userList: [list] }
  const settings = { local: { sourceAccountId: binding, isAutoUpdate: true, updateTime: 0 } }
  const calls = []
  let tick
  let now = 2000000
  let oldSync
  const api = load('src/core/musicAccount/autoSync.ts', {
    'react-native': { AppState: app }, '@/store/list/state': state,
    '@/utils/data': { getListUpdateInfo: async () => settings },
    '@/core/syncSourceList': { __esModule: true, default: async (target, automatic) => { calls.push({ id: target.id, automatic }) }, waitForSourceListSync: async () => { if (oldSync) await oldSync.promise } },
    './playlistSync': { parseAccountSourceId: value => { const match = /^account:(\d+):((?:dir:)?\d+)$/.exec(value); return match ? { owner: match[1], id: match[2] } : null }, waitForAccountSync: async () => {} },
    './syncState': { setPlaylistSyncState() {} },
  }, { Date: { now: () => now }, setInterval: (callback, interval) => { assert.equal(interval, 600000); assert.equal(tick, undefined); tick = callback } })
  return { api, app, settings, calls, binding, tick: () => tick(), advance: () => { now += 600000 }, waitFor: gate => { oldSync = gate } }
}

test('安卓自动更新只在前台运行且节流，重复初始化不增加定时器', async () => {
  const h = autoHarness()
  h.api.initPlaylistAutoSync()
  h.api.initPlaylistAutoSync()
  await flush()
  assert.equal(h.calls.length, 1)
  h.app.change('active')
  await flush()
  assert.equal(h.calls.length, 1)
  h.advance()
  h.app.currentState = 'background'
  h.tick()
  await flush()
  assert.equal(h.calls.length, 1)
  h.app.currentState = 'active'
  h.app.change('active')
  await flush()
  assert.equal(h.calls.length, 2)
  delete h.settings.local.sourceAccountId
  h.advance()
  h.tick()
  await flush()
  assert.equal(h.calls.length, 2)
})

test('收藏后等旧会话同步结束再读，等待中关闭自动更新就跳过', async () => {
  const h = autoHarness()
  const gate = deferred()
  h.waitFor(gate)
  const task = h.api.syncQQFavorites('123', h.binding)
  await flush()
  assert.equal(h.calls.length, 0)
  gate.resolve()
  assert.equal((await task).total, 1)
  assert.equal(h.calls.length, 1)
  const next = deferred()
  h.waitFor(next)
  const skipped = h.api.syncQQFavorites('123', h.binding)
  await flush()
  h.settings.local.isAutoUpdate = false
  next.resolve()
  assert.equal((await skipped).total, 0)
  assert.equal(h.calls.length, 1)
})
const syncState = load("src/core/musicAccount/syncState.ts")
test("安卓同步错误区分掉登录、验证、缺曲和网络故障", () => {
  assert.equal(syncState.playlistSyncErrorKey("login_required"), "list_sync_login_required")
  assert.equal(syncState.playlistSyncErrorKey("verification_required"), "list_sync_verification_required")
  assert.equal(syncState.playlistSyncErrorKey("incomplete"), "list_sync_incomplete")
  assert.equal(syncState.playlistSyncErrorKey("unavailable"), "list_sync_failed")
})
test("安卓打开会话就掉登录时覆盖旧成功状态，公共歌单被删后不接受迟到结果", async () => {
  const states = {}; const userList = [{ id: "local", source: "wy", sourceListId: "account:123:7" }]
  let failSession = true; const writes = []
  const api = load("src/core/syncSourceList.ts", {
    "@/utils/data": { getListUpdateInfo: async () => ({}), setListUpdateTime: async () => {} },
    "@/store/list/state": { userList },
    "./musicAccount/syncState": { setPlaylistSyncState: (id,state) => {states[id]=state} },
    "./list": { setFetchingListStatus() {}, overwriteListMusics: async (...args) => {writes.push(args)} },
    "@/core/songlist": { getListDetailAll: async () => { userList.length=0; return [{id:"song"}]} },
    "@/core/leaderboard": {},
    "@/utils/musicSdk/bi": { bilibiliClient: {} },
    "@/utils": { toNewMusicInfo: row => row },
    "./musicAccount/playlists": { openPlaylistSession: async () => {if(failSession) throw Error("login_required"); return {owner:"123"}} },
    "./musicAccount/playlistSync": { parseAccountSourceId: id => id.startsWith("account:") ? {owner:"123",id:"7"} : null, syncAccountPlaylist: async () => {} },
  })
  states.local={phase:"success"}
  await assert.rejects(api.default(userList[0]),/login_required/)
  assert.equal(states.local.error,"login_required")
  failSession=false
  userList[0].sourceListId="7"
  await api.default(userList[0])
  assert.equal(writes.length,0)
})
