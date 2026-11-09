const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, dependencies = {}) {
  if (file == 'src/renderer/store/list/action.ts') {
    dependencies['@common/utils/playlistMerge'] = load('src/common/utils/playlistMerge.ts')
    dependencies['@renderer/utils/data'] = {}
  }
  const context = { exports: {}, URL, setTimeout, clearTimeout, Number, console: { log() {} }, window: { i18n: { t: key => key } }, require: id => {
    if (!(id in dependencies)) throw Error(id)
    return dependencies[id]
  } }
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  let script = source
  if (file.endsWith('.vue')) {
    const compiler = require('@vue/compiler-sfc')
    const { descriptor } = compiler.parse(source)
    script = descriptor.scriptSetup ? compiler.compileScript(descriptor, { id: 'browse-test' }).content : descriptor.script.content
  }
  vm.runInNewContext(ts.transpileModule(script, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, context)
  return context.exports
}
const timeout = load('src/renderer/store/browseRequest.ts')
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const result = (name, source = 'wy') => ({ list: [{ id: name, name }], total: 1, limit: 30, page: 1, source, info: { name } })

test('离开并返回同一专辑不重新请求或清空曲目，切换专辑仍重新加载', async () => {
  const vue = require('vue')
  const query = { albumId: 'first', albumSource: 'tx', albumName: '专辑' }
  const route = vue.reactive({ path: '/search', query })
  let calls = 0
  const scope = vue.effectScope()
  const component = load('src/renderer/views/Search/AlbumList.vue', {
    '@common/utils/vueTools': { ...vue, onBeforeUnmount() {} },
    '@common/utils/vueRouter': { useRoute: () => route, useRouter: () => ({}) },
    '@renderer/components/common/SourceIcon.vue': {},
    '@renderer/store/search/albums': { albumSources: ['tx'], getAlbumTracks: async (_, id) => { calls++; return [{ id, meta: {} }] } },
    '@renderer/store/search/action': {}, '@renderer/store/list/action': {},
    '@renderer/core/player/action': {}, '@common/constants': {},
    '@renderer/core/player/selection': {},
  }).default
  try {
    const state = scope.run(() => component.setup(vue.reactive({ source: 'tx', page: 1, text: '歌手' }), { expose() {} }))
    await new Promise(setImmediate)
    const tracks = state.tracks.value
    assert.equal(calls, 1)
    route.path = '/setting'; route.query = {}
    await vue.nextTick()
    route.path = '/search'; route.query = { ...query }
    await vue.nextTick()
    assert.equal(calls, 1)
    assert.equal(state.tracks.value, tracks)
    route.query = { ...query, albumId: 'second' }
    await new Promise(setImmediate)
    assert.equal(calls, 2)
    assert.equal(state.tracks.value[0].id, 'second')
  } finally { scope.stop() }
})

test('响应式专辑曲目写入队列时可跨进程克隆，保留嵌套音质信息', async () => {
  const { reactive, toRaw } = require('vue')
  const tracks = reactive([{ id: 'tx_1', source: 'tx', meta: { types: [{ type: '128k' }] } }])
  assert.throws(() => structuredClone([...tracks]), /clone/)
  let transferred
  const api = load('src/renderer/store/list/action.ts', {
    '@renderer/store/setting': { appSetting: {} }, './state': { tempListMeta: {} },
    '@common/utils/vueTools': { toRaw }, '@common/constants': { LIST_IDS: { TEMP: 'temp' } },
    '@renderer/store/list/listManage': { overwriteListMusics: async data => { transferred = structuredClone(data) } },
  })
  await api.setTempList('album__tx__1', [...tracks])
  assert.deepEqual(transferred, { listId: 'temp', musicInfos: toRaw(tracks) })
  await api.setTempList('album__tx__1', tracks)
  assert.deepEqual(transferred.musicInfos[0].meta.types, [{ type: '128k' }])
})

function albumsHarness(overrides = {}) {
  return load('src/renderer/store/search/albums.js', {
    '@renderer/utils/request': { httpFetch: () => { throw Error('unexpected request') } },
    '@renderer/utils': { toNewMusicInfo: item => item },
    '@renderer/utils/musicSdk/tx/musicSearch': {},
    '@renderer/utils/musicSdk/tx/utils': {},
    '@renderer/utils/musicSdk/wy/utils': {},
    '@renderer/utils/musicSdk/wy/musicDetail': {},
    '@renderer/utils/musicSdk/kg/musicInfo': {},
    '../browseRequest': timeout,
    ...overrides,
  })
}

function kugouPlaylistHarness(request = () => { throw Error('unexpected request') }) {
  return load('src/renderer/utils/musicSdk/kg/songList.js', {
    '../../request': { httpFetch: request }, '../../index': {},
    './artwork': load('src/renderer/utils/musicSdk/kg/artwork.js'),
    '@renderer/utils/musicSdk/kg/vendors/infSign.min': {}, './util': { signatureParams: () => 'test' },
  }).default
}

test('酷狗分享文案提取链接和 gcid，重定向解析使用新地址', async () => {
  const sdk = kugouPlaylistHarness(() => ({ promise: Promise.resolve({ statusCode: 302, headers: { location: 'https://www.kugou.com/songlist/gcid_redirect.html' } }) }))
  sdk.getUserListDetail2 = async id => id
  sdk.decodeGcid = async id => 'decoded:' + id
  assert.equal(await sdk.getListDetail('分享歌单 https://www.kugou.com/songlist/gcid_original.html 收听一下', 1), 'decoded:gcid_original')
  assert.equal(await sdk.getListDetail('gcid_direct', 1), 'decoded:gcid_direct')
  assert.equal(await sdk.getListDetail('collection_3_1_2_0', 1), 'collection_3_1_2_0')
  assert.equal(await sdk.getListDetail('https://t.kugou.com/short', 1), 'decoded:gcid_redirect')
  sdk.getUserListDetailByCode = async () => { throw Error('not a share code') }
  sdk.getListDetailBySpecialId = async id => 'playlist:' + id
  assert.equal(await sdk.getListDetail('1067062', 1), 'playlist:1067062')
})

test('酷狗 305 首分享歌单的尾页保持固定页宽，曲目不重叠遗漏', async () => {
  const sdk = kugouPlaylistHarness()
  const requested = []
  sdk.createHttp = async url => {
    const params = new URL(url).searchParams
    const page = Number(params.get('page')), size = Number(params.get('pagesize'))
    requested.push([page, size])
    return { info: Array.from({ length: Math.min(size, 305 - (page - 1) * size) }, (_, i) => (page - 1) * size + i) }
  }
  const songs = await sdk.createGetListDetail2Task('collection_3_1_2_0', 305)
  assert.deepEqual(requested, [[1, 300], [2, 300]])
  assert.equal(songs.length, 305)
  assert.equal(new Set(songs).size, 305)
  assert.equal(songs[304], 304)
  assert.throws(() => sdk.createGetListDetail2Task('x', -1), /Invalid/)
})

test('酷狗旧分享链接的 95 首歌单按固定 90 首分页', async () => {
  const sdk = kugouPlaylistHarness()
  sdk.getMusicInfos = async list => list
  sdk.createHttp = async url => {
    const params = new URL(url).searchParams
    const page = Number(params.get('page')), size = Number(params.get('pagesize'))
    assert.equal(size, 90)
    return { list: { info: Array.from({ length: Math.min(size, 95 - (page - 1) * size) }, (_, i) => (page - 1) * size + i) } }
  }
  const result = await sdk.getUserListDetailByLink({ info: { 0: { count: 95 } } }, 'https://m3ws.kugou.com/zlist/list?page=1&pagesize=30')
  assert.equal(result.total, 95)
  assert.equal(new Set(result.list).size, 95)
  assert.equal(result.page, 1)
})

test('聚合专辑搜索保留可用平台，单平台失败可见，不将失败当作空结果', async () => {
  const api = albumsHarness({
    '@renderer/utils/musicSdk/tx/musicSearch': { musicSearch: async (...args) => {
      assert.equal(args[4], 2)
      return { body: { item_album: [{ albummid: 'qq1', name: '专辑', singer: '歌手' }] }, meta: { sum: 1 } }
    } },
    '@renderer/utils/musicSdk/wy/utils': { eapiRequest: () => ({ promise: Promise.reject(Error('offline')) }) },
    '@renderer/utils/request': { httpFetch: () => ({ promise: Promise.resolve({ body: { status: 1, data: { info: [{ albumid: 1, albumname: '专辑' }], total: 1 } } }) }) },
  })
  const data = await api.searchAlbums('专辑', 'all')
  assert.deepEqual(Array.from(data.list, item => item.source), ['tx', 'kg'])
  assert.deepEqual(Array.from(data.failedSources), ['wy'])
  assert.equal(data.hasMore, false)
  await assert.rejects(api.searchAlbums('专辑', 'wy'), /failed/)
})

test('QQ 专辑曲目按碟号与曲序排列，拒绝重复分页，详情参数不接受路径', async () => {
  let repeated = false
  const api = albumsHarness({
    '@renderer/utils/musicSdk/tx/utils': { signRequest: async () => ({ body: { code: 0, req: { code: 0, data: {
      totalNum: repeated ? 3 : 2,
      songList: [{ mid: 'b', index_cd: 1, index_album: 2 }, { mid: 'a', index_cd: 1, index_album: 1 }].map(songInfo => ({ songInfo })),
    } } } }) },
    '@renderer/utils/musicSdk/tx/musicSearch': { handleResult: rows => rows },
  })
  assert.deepEqual(Array.from(await api.getAlbumTracks('tx', 'album1'), song => song.mid), ['a', 'b'])
  repeated = true
  await assert.rejects(api.getAlbumTracks('tx', 'album1'), /Repeated/)
  await assert.rejects(api.getAlbumTracks('wy', '../1'), /Invalid/)
})

test('网易云专辑详情乱序时恢复曲序，缺歌时报告失败', async () => {
  let incomplete = false
  const api = albumsHarness({
    '@renderer/utils/musicSdk/wy/utils': { eapiRequest: url => ({ promise: Promise.resolve({ body: url.includes('/album/') ? { code: 200, songs: [{ id: 1 }, { id: 2 }] } : { code: 200, songs: [], privileges: [] } }) }) },
    '@renderer/utils/musicSdk/wy/musicDetail': { filterList: () => incomplete ? [{ songmid: 1 }] : [{ songmid: 2 }, { songmid: 1 }] },
  })
  assert.deepEqual(Array.from(await api.getAlbumTracks('wy', '123'), song => song.songmid), [1, 2])
  incomplete = true
  await assert.rejects(api.getAlbumTracks('wy', '123'), /Incomplete/)
})

test('酷狗专辑按 hash 恢复顺序，详情缺失不会以部分曲目冒充完整专辑', async () => {
  let incomplete = false
  const api = albumsHarness({
    '@renderer/utils/request': { httpFetch: () => ({ promise: Promise.resolve({ body: { errcode: 0, data: { total: 2, info: [{ hash: 'A' }, { hash: 'B' }] } } }) }) },
    '@renderer/utils/musicSdk/kg/musicInfo': { getMusicInfosByList: async () => incomplete ? [{ hash: 'a' }] : [{ hash: 'b' }, { hash: 'a' }] },
  })
  assert.deepEqual(Array.from(await api.getAlbumTracks('kg', '123'), song => song.hash), ['a', 'b'])
  incomplete = true
  await assert.rejects(api.getAlbumTracks('kg', '123'), /Incomplete/)
})

test('排行榜、专辑和搜索的单曲操作统一交给页面队列入口，不再绕过播放偏好', async () => {
  const events = []
  const added = []
  const song = { id: 'tx_1', source: 'tx' }
  const props = { list: [song], playInContext: true }
  const api = load('src/renderer/components/material/OnlineList/usePlay.ts', {
    '@renderer/store/list/state': { defaultList: { id: 'default' } },
    '@renderer/store/list/action': { addListMusics: async (id, songs) => added.push(...songs), getListMusics: async () => [song] },
    '@renderer/store/player/action': {}, '@renderer/store/setting': { appSetting: {} },
    '@common/utils/vueTools': {}, '@renderer/core/player': { playList: () => {} }, '@common/constants': { LIST_IDS: {} },
  }).default({ selectedList: { value: [] }, props, removeAllSelect() {}, emit: (...args) => events.push(args) })
  await api.handlePlayMusic(0, true)
  assert.equal(added.length, 0)
  assert.deepEqual(events, [['play-list', 0]])
  props.playInContext = false
  await api.handlePlayMusic(0, true)
  assert.equal(added.length, 0)
  assert.deepEqual(events, [['play-list', 0], ['play-list', 0]])
})

test('先后播放两个榜单，同榜单再次播放，旧完整列表均不能覆盖最后一次队列', async () => {
  const fullRequests = []
  const writes = []
  const meta = { id: '' }
  const api = load('src/renderer/views/Leaderboard/action.ts', {
    '@renderer/store/setting': { appSetting: { 'list.playAllMode': 'replace' } },
    '@renderer/core/player/selection': {},
    '@renderer/store/list/state': { tempListMeta: meta, userLists: [] },
    '@renderer/plugins/Dialog': {}, '@renderer/store/list/syncSourceList': {},
    '@renderer/store/leaderboard/action': { getListDetailAll: () => { const task = deferred(); fullRequests.push(task); return task.promise } },
    '@renderer/store/list/action': { setTempList: async (id, songs) => { meta.id = id; writes.push(songs[0].id) } },
    '@renderer/core/player/action': { playList() {} }, '@common/constants': { LIST_IDS: { TEMP: 'temp' } }, '@renderer/utils': {},
  })
  const a = api.playSongListDetail('tx__a', [{ id: 'a-page' }]); await new Promise(setImmediate)
  const b = api.playSongListDetail('tx__b', [{ id: 'b-page' }]); await new Promise(setImmediate)
  const a2 = api.playSongListDetail('tx__a', [{ id: 'a-new-page' }]); await new Promise(setImmediate)
  fullRequests[2].resolve([{ id: 'a-new-full' }]); await a2
  fullRequests[0].resolve([{ id: 'a-old-full' }]); await a
  fullRequests[1].resolve([{ id: 'b-old-full' }]); await b
  assert.deepEqual(writes, ['a-page', 'b-page', 'a-new-page', 'a-new-full'])
})

test('QQ 搜索按原始条目确认末页，估算总数和不可播放条目不会制造多余页码或提前截断', async () => {
  const sdk = load('src/renderer/utils/musicSdk/tx/musicSearch.js', {
    '../../index': {}, '../utils': {}, './utils': {},
  }).default
  let rawCount = 9
  sdk.musicSearch = async () => ({ body: { item_song: Array.from({ length: rawCount }, (_, id) => ({ id })) }, meta: { estimate_sum: 300 } })
  sdk.handleResult = list => list.slice(0, 9)
  let data = await sdk.search('尘间星旅', 1, 30)
  assert.equal(data.total, 9)
  assert.equal(data.allPage, 1)
  rawCount = 30
  data = await sdk.search('尘间星旅', 1, 30)
  assert.equal(data.total, 300)
  assert.equal(data.allPage, 10)
  rawCount = 0
  data = await sdk.search('尘间星旅', 2, 30)
  assert.equal(data.total, 30)
  assert.equal(data.allPage, 1)
  sdk.musicSearch = async () => ({ body: {}, meta: {} })
  await assert.rejects(sdk.search('尘间星旅'), /Invalid QQ/)
})

function musicSearchHarness() {
  const vue = require('vue')
  const calls = []
  const info = () => vue.reactive({ list: [], page: 1, limit: 30, total: 0, key: null, noItemLabel: '' })
  const state = { sources: ['tx', 'all'], maxPages: {}, listInfos: { tx: info(), all: info() } }
  const api = load('src/renderer/store/search/music/action.ts', {
    '@common/utils/vueTools': vue,
    '@renderer/utils/musicSdk': { tx: { musicSearch: { search: () => { const gate = deferred(); calls.push(gate); return gate.promise } } } },
    '@renderer/utils': { toNewMusicInfo: item => item },
    '@renderer/store/utils': { assertApiSupport: () => true },
    './state': state,
    './ranking': load('src/renderer/store/search/music/ranking.ts'),
  })
  const respond = (id, name, total = 90) => calls[id].resolve({ list: name ? [{ id: name, source: 'tx', name, singer: '歌手', meta: { albumName: '' } }] : [], total, allPage: Math.ceil(total / 30), limit: 30, source: 'tx' })
  return { api, calls, state: state.listInfos.tx, respond }
}

test('搜索翻页空结果有提示和真实总数，重试不会命中空缓存', async () => {
  const app = musicSearchHarness()
  const first = app.api.search('测试', 1, 'tx')
  app.respond(0, '歌曲')
  await first
  const next = app.api.search('测试', 2, 'tx')
  assert.equal(app.state.list.length, 0)
  assert.equal(app.state.page, 2)
  assert.equal(app.state.noItemLabel, 'list__loading')
  app.respond(1, '', 30)
  await next
  assert.equal(app.state.noItemLabel, 'search__page_empty')
  assert.equal(app.state.total, 30)
  const retry = app.api.search('测试', 2, 'tx')
  assert.equal(app.calls.length, 3)
  app.respond(2, '重试歌曲')
  await retry
  assert.equal(app.state.list[0].name, '重试歌曲')
})

test('搜索 A → B → A 的迟到成功、失败均不能覆盖最新结果', async () => {
  const app = musicSearchHarness()
  const a = app.api.search('A', 1, 'tx')
  const b = app.api.search('B', 1, 'tx')
  const latest = app.api.search('A', 1, 'tx')
  app.respond(2, '最新结果')
  await latest
  app.respond(0, '旧结果')
  app.calls[1].reject(Error('old failure'))
  await Promise.all([a, b])
  assert.equal(app.state.list[0].name, '最新结果')
  assert.equal(app.state.noItemLabel, '')
})

test('清空搜索使在途响应失效', async () => {
  const app = musicSearchHarness()
  const pending = app.api.search('A', 1, 'tx')
  await app.api.search('', 1, 'tx')
  app.respond(0, '旧结果')
  await pending
  assert.equal(app.state.list.length, 0)
  assert.equal(app.state.key, null)
})

function searchRouteHarness(savedSource, readFails = false) {
  const setting = { source: savedSource, type: 'music' }
  const writes = []
  const api = load('src/renderer/views/Search/index.vue', {
    vue: require('vue'),
    '@common/utils/vueRouter': {},
    '@common/constants': { DEFAULT_SETTING: { search: { source: 'all', type: 'music' } } },
    '@renderer/store/search/state': { searchText: { value: '' } },
    '@renderer/utils/data': {
      getSearchSetting: async () => { if (readFails) throw Error('unavailable'); return { ...setting } },
      setSearchSetting: async value => { Object.assign(setting, value); writes.push(value) },
    },
    './MusicList/index.vue': {},
    './SongListList/index.vue': {},
    './AlbumList.vue': {},
    './components/BlankView.vue': {},
    '@common/utils/vueTools': require('vue'),
    '@renderer/utils/musicSdk': { sources: ['kw', 'kg', 'tx', 'wy', 'mg'].map(id => ({ id })) },
  }).default
  const navigate = async (query, update = false) => {
    let redirect
    await (update ? api.beforeRouteUpdate : api.beforeRouteEnter)({ path: '/search', query }, {}, value => { redirect = value })
    if (redirect) await api.beforeRouteEnter(redirect, {}, () => {})
    return redirect?.query ?? query
  }
  return { setting, writes, navigate }
}

test('返回搜索首页与重新进入时恢复上次音源，不覆盖为聚合搜索', async () => {
  for (const source of ['kw', 'kg', 'tx', 'wy', 'mg', 'all']) {
    const app = searchRouteHarness(source)
    assert.equal((await app.navigate({})).source, source)
    assert.equal(app.setting.source, source)
    assert.equal((await app.navigate({ text: '起风了' })).source, source)
    assert.equal((await searchRouteHarness(app.setting.source).navigate({})).source, source)
  }
})

test('显式切源优先于保存值，选择聚合搜索也会记住', async () => {
  const app = searchRouteHarness('tx')
  await app.navigate({ source: 'wy', type: 'music' }, true)
  assert.equal((await app.navigate({})).source, 'wy')
  await app.navigate({ source: 'all', type: 'music' }, true)
  assert.equal((await app.navigate({})).source, 'all')
})

test('无效路由音源恢复保存值；保存值无效或读取失败时安全回退', async () => {
  assert.equal((await searchRouteHarness('tx').navigate({ source: 'removed' })).source, 'tx')
  assert.equal((await searchRouteHarness('removed').navigate({})).source, 'all')
  assert.equal((await searchRouteHarness('tx', true).navigate({})).source, 'all')
})
function harness(kind) {
  const calls = []
  const request = (...args) => { const gate = deferred(); calls.push({ args, ...gate }); return gate.promise }
  const state = { boards: {}, tags: {}, listInfo: { list: [] }, listDetailInfo: { list: [], info: {} } }
  const sdk = { getList: request, getListDetail: request, getBoards: async () => ({ source: 'wy', list: [] }) }
  const api = load(`src/renderer/store/${kind}/action.ts`, {
    '@renderer/utils': { deduplicationList: x => x, toNewMusicInfo: x => x },
    '@renderer/utils/musicSdk': { wy: { leaderboard: sdk, songList: sdk }, kw: { songList: sdk } },
    '@common/utils/vueTools': { markRaw: x => x, markRawList: x => x },
    './state': state,
    '../browseRequest': timeout,
  })
  return { api, state, calls }
}

test('排行榜 A → B 立即清空旧内容，A 迟到不能覆盖 B', async () => {
  const { api, state, calls } = harness('leaderboard')
  state.listDetailInfo.list = [{ id: 'old' }]
  const a = api.getAndSetListDetail('wy__a', 1)
  const b = api.getAndSetListDetail('wy__b', 1)
  assert.equal(state.listDetailInfo.list.length, 0)
  assert.equal(state.listDetailInfo.id, 'wy__b')
  calls[1].resolve(result('B')); await b
  calls[0].resolve(result('A')); await a
  assert.equal(state.listDetailInfo.list[0].name, 'B')
})

test('歌单最新 → 最热 → 最新使用本次请求，旧同名请求不能覆盖', async () => {
  const { api, state, calls } = harness('songList')
  const a = api.getAndSetList('kw', '', 'new', 1)
  const b = api.getAndSetList('kw', '', 'hot', 1)
  const c = api.getAndSetList('kw', '', 'new', 1)
  calls[2].resolve(result('new-current', 'kw')); await c
  calls[1].resolve(result('hot', 'kw')); await b
  calls[0].resolve(result('new-stale', 'kw')); await a
  assert.equal(state.listInfo.list[0].name, 'new-current')
  await api.getAndSetList('kw', '', 'new', 1)
  assert.equal(calls.length, 3)
})

test('歌单取消旧请求后不重试干扰新排序', async () => {
  const { api, state, calls } = harness('songList')
  const a = api.getAndSetList('kw', '', 'new', 1)
  const b = api.getAndSetList('kw', '', 'hot', 1)
  calls[0].reject(Error('cancelled')); await a
  calls[1].resolve(result('hot', 'kw')); await b
  assert.equal(calls.length, 2)
  assert.equal(state.listInfo.sortId, 'hot')
})

test('切换至已缓存歌单会使未完成请求失效', async () => {
  const { api, state, calls } = harness('songList')
  const a = api.getAndSetList('kw', '', 'new', 1)
  calls[0].resolve(result('new', 'kw')); await a
  const b = api.getAndSetList('kw', '', 'hot', 1)
  await api.getAndSetList('kw', '', 'new', 1)
  calls[1].resolve(result('hot', 'kw')); await b
  assert.equal(state.listInfo.list[0].name, 'new')
})

test('歌单详情同 ID 的强制刷新拒绝更早响应', async () => {
  const { api, state, calls } = harness('songList')
  const a = api.getAndSetListDetail('a', 'wy', 1)
  const b = api.getAndSetListDetail('a', 'wy', 1, true)
  calls[1].resolve(result('fresh')); await b
  calls[0].resolve(result('stale')); await a
  assert.equal(state.listDetailInfo.list[0].name, 'fresh')
  assert.equal((await api.getListDetail('a', 'wy', 1)).list[0].name, 'fresh')
})

test('歌单请求失败后保留筛选条件，并允许原条件重试', async () => {
  const { api, state, calls } = harness('songList')
  const failed = assert.rejects(api.getAndSetList('kw', 'rock', 'hot', 2), /offline/)
  for (let i = 0; i < 3; i++) {
    while (!calls[i]) await new Promise(resolve => setTimeout(resolve, 20))
    calls[i].reject(Error('offline'))
  }
  await failed
  assert.equal(state.listInfo.source, 'kw')
  assert.equal(state.listInfo.tagId, 'rock')
  assert.equal(state.listInfo.sortId, 'hot')
  assert.equal(state.listInfo.page, 2)
  const retry = api.getAndSetList('kw', 'rock', 'hot', 2)
  calls[3].resolve(result('recovered', 'kw')); await retry
  assert.equal(state.listInfo.list[0].name, 'recovered')
  assert.equal(state.listInfo.noItemLabel, '')
})

test('清空排行榜使在途请求失效', async () => {
  const { api, state, calls } = harness('leaderboard')
  const a = api.getAndSetListDetail('wy__a', 1)
  api.clearListDetail()
  calls[0].resolve(result('stale')); await a
  assert.equal(state.listDetailInfo.list.length, 0)
  assert.equal(state.listDetailInfo.id, '')
})

test('永不返回的请求有超时，正常请求不遗留定时器', async () => {
  await assert.rejects(timeout.withBrowseTimeout(new Promise(() => {}), 10), /timed out/)
  assert.equal(await timeout.withBrowseTimeout(Promise.resolve('ok'), 100), 'ok')
})

test('聚合结果换源通知列表订阅者，显示与后续播放读取一致，且可切回原源', async () => {
  const vue = require('vue')
  const ranking = load('src/renderer/store/search/music/ranking.ts')
  const song = source => vue.markRaw({ id: `${source}_1`, source, name: '起风了', singer: '买辣椒也用券', meta: { albumName: '起风了' } })
  const kw = song('kw')
  const tx = song('tx')
  const state = { sources: ['kw', 'tx', 'all'], maxPages: {}, listInfos: { all: vue.reactive({ list: [], limit: 30 }) } }
  const api = load('src/renderer/store/search/music/action.ts', {
    '@common/utils/vueTools': vue,
    '@renderer/utils/musicSdk': Object.fromEntries([kw, tx].map(item => [item.source, {
      musicSearch: { search: async () => ({ source: item.source, list: [item], allPage: 1, total: 1, limit: 30 }) },
    }])),
    '@renderer/utils': { toNewMusicInfo: item => item },
    '@renderer/store/utils': { assertApiSupport: () => true },
    './state': state,
    './ranking': ranking,
  })
  await api.search('起风了', 1, 'all')
  const changes = []
  const stop = vue.watch(() => state.listInfos.all.list, list => changes.push(list[0].source))
  try {
    api.selectAggregateSource(0, 'tx')
    await vue.nextTick()
    assert.deepEqual(changes, ['tx'])
    assert.equal(state.listInfos.all.list[0], tx)
    assert.equal(api.getAggregateSources(tx).length, 2)
    api.selectAggregateSource(0, 'kw')
    await vue.nextTick()
    assert.deepEqual(changes, ['tx', 'kw'])
    assert.equal(state.listInfos.all.list[0], kw)
    api.selectAggregateSource(0, 'kg')
    api.selectAggregateSource(100, 'tx')
    api.selectAggregateSource(0, 'kw')
    await vue.nextTick()
    assert.deepEqual(changes, ['tx', 'kw'])
  } finally { stop() }
})
