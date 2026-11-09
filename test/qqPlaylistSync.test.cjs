const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
function load(file, dependencies = {}, extra = {}) {
  if (file == 'src/renderer/views/List/MyList/importPlaylist.ts') dependencies['@renderer/utils/musicSdk/bi'] ??= { bilibiliClient: {} }
  if (file != 'src/common/utils/playlistMerge.ts') dependencies['@common/utils/playlistMerge'] = load('src/common/utils/playlistMerge.ts')
  const context = { exports: {}, Error, console, ...extra, require: id => {
    if (!(id in dependencies)) throw Error(id)
    return dependencies[id]
  } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, context)
  return context.exports
}
const qq = load('src/common/utils/qqPlaylist.ts')
const plain = value => JSON.parse(JSON.stringify(value))
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }

test('QQ 分页按实际短页长度继续，保持远端顺序，合法空歌单可同步', async () => {
  const offsets = []
  const ids = await qq.collectQQPlaylistIds(async offset => {
    offsets.push(offset)
    return offset == 0 ? { ids: ['b', 'a'], total: 3, hasMore: true } : { ids: ['c'], total: 3, hasMore: false }
  })
  assert.deepEqual(offsets, [0, 2])
  assert.deepEqual(plain(ids), ['b', 'a', 'c'])
  assert.deepEqual(plain(await qq.collectQQPlaylistIds(async () => ({ ids: [], total: 0 }))), [])
})

test('QQ 缺页、重复末页、总数变化、非法歌曲均拒绝，不会返回残缺列表', async () => {
  for (const pages of [
    [{ ids: ['a'], total: 2, hasMore: false }],
    [{ ids: ['a'], total: 2 }, { ids: [] }],
    [{ ids: ['a'], total: 2 }, { ids: ['a'], total: 2 }],
    [{ ids: ['a'], total: 2 }, { ids: ['b'], total: 3 }],
    [{ ids: [''], total: 1 }],
    [{ ids: ['a'], total: 0 }],
    [{ ids: [], total: 0, hasMore: true }],
    [{ ids: [] }],
  ]) {
    let page = 0
    await assert.rejects(qq.collectQQPlaylistIds(async () => pages[page++]), /playlist_incomplete/)
  }
})

test('QQ 元数据只取新增歌曲，复用缓存并遵守远端删除和排序', async () => {
  const cached = new Map([['a', { id: 'a', localMetadata: true }], ['removed', { id: 'removed' }]])
  const fetched = []
  const songs = await qq.resolveQQPlaylistTracks(['b', 'a', 'b'], cached, async id => { fetched.push(id); return { id } })
  assert.deepEqual(fetched, ['b'])
  assert.deepEqual(plain(songs), [{ id: 'b' }, { id: 'a', localMetadata: true }])
  await assert.rejects(qq.resolveQQPlaylistTracks(['x'], cached, async () => null), /playlist_incomplete/)
  await assert.rejects(qq.resolveQQPlaylistTracks(['x'], cached, async () => { throw Error('network') }), /network/)
  await assert.rejects(qq.resolveQQPlaylistTracks([], cached, async () => ({}), undefined, () => true), /cancelled/)
})

const harness = (options = {}) => {
  const target = { id: 'local', source: 'tx', sourceListId: 'dir:201', name: '我喜欢' }
  const lists = [target]
  const settings = { local: { isAutoUpdate: true, updateTime: 123, sourceAccountId: 'account-a', ...options.settings } }
  const calls = []; const busy = {}; const saved = []
  const cached = [{ source: 'tx', meta: { songId: 'old' } }]
  const importer = options.importer ?? (async (source, id, progress, cancel, opts) => {
    calls.push({ source, id, cache: opts.existingMusic })
    if (options.fetchGate) await options.fetchGate.promise
    if (options.fetchError) throw Error('network')
    if (opts.accountId && opts.accountId != 'account-a') throw Error('account_changed')
    opts.onAccount('account-a')
    progress({ stage: 'fetch', current: 2, total: 2 })
    return [{ id: 'new' }, { id: 'old' }]
  })
  const api = load('src/renderer/store/list/syncSourceList.ts', {
    '@common/utils/vueTools': { reactive: value => value },
    '@renderer/utils/data': {
      getListUpdateInfo: async () => settings,
      setListSourceAccount: async (id, account) => { settings[id].sourceAccountId = account },
      setListSourceSnapshot: async (id, snapshot) => { settings[id].sourceSnapshot = snapshot },
      setListUpdateTime: async (id, value) => { settings[id].updateTime = value },
    },
    './state': { userLists: lists },
    './action': {
      getListMusics: async () => cached,
      setFetchingListStatus: (id, value) => { busy[id] = value },
      overwriteListMusics: async data => {
        if (options.saveGate) await options.saveGate.promise
        if (options.saveError) throw Error('disk')
        saved.push(data)
      },
    },
    '@renderer/store/songList/action': { getListDetailAll: async () => { throw Error('must not use public QQ API') } },
    '@renderer/store/leaderboard/action': {},
    '@renderer/utils/musicSdk/bi': { bilibiliClient: {} },
    '@renderer/utils': { toNewMusicInfo: row => row },
    '@renderer/views/List/MyList/importPlaylist': { loadAccountPlaylistMusic: importer },
  })
  return { ...api, target, lists, settings, calls, busy, saved, cached }
}
const tick = () => new Promise(resolve => setImmediate(resolve))

test('QQ 我喜欢使用账号接口和缓存，同一列表并发只抓取和保存一次', async () => {
  const gate = deferred(); const h = harness({ fetchGate: gate })
  const a = h.default(h.target); const b = h.default(h.target)
  await tick()
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].source, 'tx')
  assert.equal(h.calls[0].id, 'dir:201')
  assert.equal(h.calls[0].cache, h.cached)
  gate.resolve()
  await Promise.all([a, b])
  assert.equal(h.saved.length, 1)
  assert.equal(h.busy.local, false)
  assert.equal(h.listSyncStates.local.phase, 'success')
})

test('本地保存完成前维持忙状态，不提前更新时间；保存失败保留时间且可重试', async () => {
  const gate = deferred(); const h = harness({ saveGate: gate })
  const task = h.default(h.target)
  await tick()
  assert.equal(h.busy.local, true)
  assert.equal(h.settings.local.updateTime, 123)
  gate.resolve(); await task
  assert.ok(h.settings.local.updateTime > 123)
  const broken = harness({ saveError: true })
  await assert.rejects(broken.default(broken.target), /disk/)
  assert.equal(broken.settings.local.updateTime, 123)
  assert.equal(broken.busy.local, false)
  assert.equal(broken.listSyncStates.local.phase, 'error')
  await assert.rejects(broken.default(broken.target), /disk/)
  assert.equal(broken.calls.length, 2)
})

test('网络失败、账号不匹配不覆盖列表；旧列表自动同步不擅自绑定账号', async () => {
  for (const options of [{ fetchError: true }, { settings: { sourceAccountId: 'account-b' } }]) {
    const h = harness(options)
    await assert.rejects(h.default(h.target))
    assert.equal(h.saved.length, 0)
    assert.equal(h.settings.local.updateTime, 123)
  }
  const h = harness({ settings: { sourceAccountId: undefined } })
  assert.equal(await h.default(h.target, true), false)
  assert.equal(h.calls.length, 0)
  assert.equal(await h.default(h.target), true)
  assert.equal(h.settings.local.sourceAccountId, 'account-a')
})

test('同步期间删除列表、更改来源或关闭自动更新不会写入迟到结果', async () => {
  for (const change of [h => h.lists.splice(0), h => { h.target.sourceListId = 'different' }, h => { h.settings.local.isAutoUpdate = false }]) {
    const gate = deferred(); const h = harness({ fetchGate: gate })
    const task = h.default(h.target, true)
    await tick(); change(h); gate.resolve()
    assert.equal(await task, false)
    assert.equal(h.saved.length, 0)
    assert.equal(h.settings.local.updateTime, 123)
  }
})

test('收藏成功仅更新同账号已开启的我喜欢；等待旧快照后再次读取', async () => {
  const gate = deferred(); const h = harness({ fetchGate: gate })
  const initial = h.default(h.target)
  await tick()
  const updated = h.syncQQFavorites('account-a')
  await tick()
  assert.equal(h.calls.length, 1)
  gate.resolve(); await initial
  const result = await updated
  assert.equal(result.total, 1)
  assert.equal(result.failed, 0)
  assert.equal(h.calls.length, 2)
  assert.equal((await h.syncQQFavorites('account-b')).total, 0)
  h.settings.local.isAutoUpdate = false
  assert.equal((await h.syncQQFavorites('account-a')).total, 0)
})

test('收藏后的本地同步失败单独返回，不会推翻云端成功结果', async () => {
  const h = harness({ fetchError: true })
  assert.deepEqual(plain(await h.syncQQFavorites('account-a')), { total: 1, failed: 1 })
  assert.equal(h.saved.length, 0)
})

test('同步期间手动追加的异源歌曲在覆盖后保留，失败时不提前推进来源快照', async () => {
  const gate = deferred()
  const previous = { sourceKey: 'tx:dir:201', musicKeys: ['tx:removed'] }
  const h = harness({ fetchGate: gate, settings: { sourceSnapshot: previous } })
  h.cached.splice(0, h.cached.length, { id: 'removed', source: 'tx' })
  const task = h.default(h.target)
  await tick()
  const manual = { id: 'extra', source: 'kg' }
  h.cached.push(manual)
  gate.resolve(); await task
  assert.deepEqual(plain(h.saved[0].musicInfos), [{ id: 'new' }, { id: 'old' }, manual])
  assert.equal(h.settings.local.sourceSnapshot.musicKeys.includes('kg:extra'), false)
  const failed = harness({ saveError: true, settings: { sourceSnapshot: previous } })
  await assert.rejects(failed.default(failed.target), /disk/)
  assert.equal(failed.settings.local.sourceSnapshot, previous)
})

const importHarness = (options = {}) => {
  const lists = options.existing ? [{ id: 'local', source: 'tx', sourceListId: 'dir:201' }] : []
  const settings = options.existing ? { local: { updateTime: 123, isAutoUpdate: false, sourceAccountId: 'account-a', sourceSnapshot: { sourceKey: 'tx:dir:201', musicKeys: ['tx:old'] } } } : {}
  const saved = []; const fetched = []
  const api = load('src/renderer/views/List/MyList/importPlaylist.ts', {
    '@common/constants': { LIST_IDS: { LOVE: 'love' } },
    '@renderer/utils': { toNewMusicInfo: row => row, filterMusicList: rows => rows },
    '@renderer/utils/request': {}, '@renderer/utils/musicSdk': { tx: { songList: { filterListDetail: rows => rows } } }, '@renderer/store/songList/action': {},
    '@renderer/store/list/state': { userLists: lists },
    '@renderer/store/list/action': {
      getListMusics: async () => [{ id: 'old', source: 'tx', meta: { songId: 'old' }, name: 'cached' }],
      overwriteListMusics: async data => { saved.push(data) },
      createUserList: async data => { saved.push(data) },
    },
    '@renderer/utils/data': {
      getListUpdateInfo: async () => settings,
      setListSourceAccount: async (id, value) => { settings[id] ??= {}; settings[id].sourceAccountId = value },
      setListSourceSnapshot: async (id, snapshot) => { settings[id] ??= {}; settings[id].sourceSnapshot = snapshot },
      setListAutoUpdate: async (id, value) => { settings[id].isAutoUpdate = value },
      setListUpdateTime: async (id, value) => { settings[id].updateTime = value },
    },
    '@common/utils/qqPlaylist': qq,
    '@renderer/utils/ipc': { getMusicAccountPlaylistDetail: async () => ({ status: options.status ?? 'available', ids: options.ids ?? ['new', 'old'], tracks: options.tracks, accountId: options.accountId ?? 'account-a' }) },
    '@renderer/utils/musicSdk/wy/musicDetail': {},
    '@renderer/utils/musicSdk/tx/musicInfo': async id => {
      fetched.push(id)
      if (id == options.missing) return null
      return { id, source: 'tx', meta: { songId: id }, name: id }
    },
  })
  return { ...api, settings, saved, fetched, run: () => api.importAccountPlaylist({ provider: 'tx', playlist: { id: 'dir:201', name: '我喜欢', accountId: 'account-a', trackCount: 2 }, target: 'new' }) }
}

test('QQ 导入新歌单默认自动更新，已有歌单复用缓存并尊重关闭的开关', async () => {
  const fresh = importHarness()
  await fresh.run()
  assert.equal(Object.values(fresh.settings)[0].isAutoUpdate, true)
  assert.equal(Object.values(fresh.settings)[0].sourceAccountId, 'account-a')
  const existing = importHarness({ existing: true })
  await existing.run()
  assert.deepEqual(existing.fetched, ['new'])
  assert.equal(existing.settings.local.isAutoUpdate, false)
  assert.equal(existing.saved[0].musicInfos[1].name, 'cached')
})

test('QQ 导入遇新歌曲解析失败或账号变化不保存，真实空歌单可完整清空', async () => {
  for (const options of [{ missing: 'new' }, { accountId: 'account-b' }]) {
    const h = importHarness({ existing: true, ...options })
    await assert.rejects(h.run())
    assert.equal(h.saved.length, 0)
    assert.equal(h.settings.local.updateTime, 123)
  }
  const empty = importHarness({ existing: true, ids: [] })
  await empty.run()
  assert.equal(empty.saved[0].musicInfos.length, 0)
})

test('账号歌单元数据齐全时不逐曲请求匿名接口，掉登录和缺曲分别反馈', async () => {
  const tracks = ['new', 'old'].map(mid => ({ mid, title: mid, file: {}, album: {}, source: 'tx', meta: { songId: mid }, name: mid }))
  const h = importHarness({ tracks, missing: 'new' })
  await h.run()
  assert.deepEqual(h.fetched, [])
  assert.equal(h.saved[0].list.length, 2)
  for (const status of ['login_required', 'playlist_incomplete', 'verification_required']) {
    const failed = importHarness({ existing: true, status })
    await assert.rejects(failed.run(), error => error.code == status)
    assert.equal(failed.saved.length, 0)
    assert.equal(failed.settings.local.updateTime, 123)
  }
  assert.equal(harness().syncErrorKey(Error('login_required')), 'list_sync_login_required')
  assert.equal(harness().syncErrorKey(Error('incomplete')), 'list_sync_incomplete')
})

test('自动更新只注册一次，回前台按间隔节流，未关联旧歌单不自动覆盖', async () => {
  let now = 1000000
  class FakeDate extends Date { static now() { return now } }
  const lists = [{ id: 'qq', source: 'tx', sourceListId: 'dir:201' }, { id: 'legacy', source: 'tx', sourceListId: 'dir:201' }, { id: 'other', source: 'kg' }]
  const settings = { qq: { isAutoUpdate: true, updateTime: 0, sourceAccountId: 'account-a' }, legacy: { isAutoUpdate: true, updateTime: 0 }, other: { isAutoUpdate: true, updateTime: 0 } }
  const listeners = {}; let interval; let registrations = 0
  const calls = []; const network = { onLine: true }
  const api = load('src/renderer/core/useApp/listAutoUpdate.ts', {
    '@renderer/utils/data': { getListUpdateInfo: async () => settings },
    '@renderer/store/list/state': { userLists: lists },
    '@renderer/store/list/syncSourceList': { __esModule: true, default: async target => { calls.push(target.id) }, isQQSyncList: list => list.source == 'tx' },
  }, { Date: FakeDate, navigator: network, window: {
    setInterval: (fn, delay) => { assert.equal(delay, 600000); registrations++; interval = fn },
    addEventListener: (name, fn) => { listeners[name] = fn },
  } })
  api.default(); api.default(); await tick()
  assert.equal(registrations, 1)
  assert.deepEqual(calls, ['qq', 'other'])
  listeners.focus(); listeners.focus(); await tick()
  assert.equal(calls.length, 2)
  now += 600000
  network.onLine = false; interval(); await tick()
  assert.equal(calls.length, 2)
  network.onLine = true; listeners.online(); await tick()
  assert.deepEqual(calls, ['qq', 'other', 'qq'])
  settings.qq.isAutoUpdate = false; now += 600000; interval(); await tick()
  assert.equal(calls.length, 3)
})
const realTools = load("src/common/utils/tools.ts")
const sdkUtils = { formatPlayTime: seconds => String(seconds), sizeFormate: size => String(size) }
const realQQ = load("src/renderer/utils/musicSdk/tx/songList.js", {
  "../../request": {}, "../../index": sdkUtils, "../utils": { formatSingerName: singers => singers.map(s => s.name).join("、") },
}).default
const realWY = load("src/renderer/utils/musicSdk/wy/musicDetail.js", {
  "../../request": {}, "./utils/crypto": {}, "../../index": sdkUtils,
}).default
function realImport(result) {
  let anonymousCalls = 0
  const api = load("src/renderer/views/List/MyList/importPlaylist.ts", {
    "@common/constants": { LIST_IDS: {} }, "@renderer/utils": realTools,
    "@renderer/utils/request": {}, "@renderer/utils/musicSdk": { tx: { songList: realQQ } },
    "@renderer/store/songList/action": {}, "@renderer/store/list/action": {}, "@renderer/utils/data": {},
    "@common/utils/qqPlaylist": qq, "@renderer/store/list/state": {},
    "@renderer/utils/ipc": { getMusicAccountPlaylistDetail: async () => result },
    "@renderer/utils/musicSdk/wy/musicDetail": realWY,
    "@renderer/utils/musicSdk/tx/musicInfo": async () => { anonymousCalls++; throw Error("anonymous unavailable") },
  })
  return { read: provider => api.loadAccountPlaylistMusic(provider, "123"), anonymousCalls: () => anonymousCalls }
}
test("QQ 224 首真实转换保留 mid 与数字 ID，账号资料足够时完全不依赖匿名详情", async () => {
  const tracks = Array.from({ length: 224 }, (_, i) => ({
    mid: `mid${i}`, id: 1000 + i, title: `歌曲${i}`, interval: 180,
    singer: [{ name: "歌手", mid: "singer" }], album: { mid: "album", name: "专辑" },
    file: { media_mid: `media${i}`, size_128mp3: 1024, size_320mp3: 0, size_flac: 0, size_hires: 0 },
  }))
  const h = realImport({ status: "available", ids: tracks.map(s => s.mid), tracks, accountId: "qq:1:123" })
  const songs = await h.read("tx")
  assert.equal(songs.length, 224)
  assert.equal(songs[223].meta.songId, "mid223")
  assert.equal(songs[223].meta.id, 1223)
  assert.equal(h.anonymousCalls(), 0)
})
test("网易云按歌单顺序匹配详情与权限，缺曲或缺权限拒绝返回残缺列表", async () => {
  const tracks = [1, 2].map(id => ({ id, name: `歌${id}`, dt: 180000, ar: [], al: {} }))
  const result = { status: "available", ids: ["2", "1"], tracks, privileges: [{ id: 2, maxbr: 0 }, { id: 1, maxbr: 0 }] }
  assert.deepEqual(plain((await realImport(result).read("wy")).map(s => s.meta.songId)), [2, 1])
  await assert.rejects(realImport({ ...result, tracks: [tracks[0]] }).read("wy"), /playlist_incomplete/)
  await assert.rejects(realImport({ ...result, privileges: [] }).read("wy"), /playlist_incomplete/)
  for (const provider of ["tx", "wy", "kg"]) {
    assert.deepEqual(plain(await realImport({ status: "available", ids: [], tracks: [], accountId: "test" }).read(provider)), [])
    await assert.rejects(realImport({ status: "login_required", ids: [] }).read(provider), /login_required/)
  }
})
