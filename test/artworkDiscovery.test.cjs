const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.join(__dirname, '..')
const mobile = fs.existsSync(path.join(root, 'src/core/songlist.ts'))
const sdk = mobile ? 'src/utils/musicSdk/kg/' : 'src/renderer/utils/musicSdk/kg/'
const utils = mobile ? 'src/utils/' : 'src/common/utils/'
function load(file, dependencies = {}) {
  const context = { exports: {}, setTimeout, clearTimeout, Date, require: id => {
    if (!(id in dependencies)) throw Error(id)
    return dependencies[id]
  } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context)
  return context.exports
}
const artwork = load(sdk + 'artwork.js')
const { createArtworkLoader } = load(utils + 'artworkLoader.ts')
const { createDiscoveryLoader } = load(utils + 'discoveryPlaylists.ts')
const track = id => ({ id, source: 'kg', meta: {} })

if (!mobile) test('首页账号状态暂时未确认时，仍能打开已读取的歌单并展示实际登录提示', async () => {
  const source = fs.readFileSync(path.join(root, 'src/renderer/views/Search/components/BlankView.vue'), 'utf8')
  const canRead = source.match(/const canReadAccountPlaylists = .*$/m)[0]
  const open = source.slice(source.indexOf('const openAccountPlaylist ='), source.indexOf('\nconst isCurrentTrack ='))
  let requests = 0
  const context = {
    accountStatus: { value: { kg: false, accounts: { kg: { hasSession: true } } } },
    accountPlaylistsProvider: { value: 'kg' }, selectedDailyProvider: { value: 'tx' },
    playlistDetailRequestId: 0,
    getMusicAccountPlaylistDetail: async (provider, id) => { requests++; assert.equal(provider, 'kg'); assert.equal(id, 0); return { status: 'login_required' } },
  }
  for (const key of ['selectedAccountPlaylist', 'playlistDetailError', 'selectedAccountPlaylistProvider', 'playlistDetailList', 'detailKind', 'isShowDailyDetail', 'isPlaylistDetailLoading']) context[key] = { value: null }
  vm.runInNewContext(`${canRead}\n${open}\nthis.open = openAccountPlaylist`, context)
  await context.open({ id: 0, name: '我喜欢' })
  assert.equal(requests, 1)
  assert.equal(context.isShowDailyDetail.value, true)
  assert.equal(context.playlistDetailError.value, 'search__account_expired')
  assert.equal(context.isPlaylistDetailLoading.value, false)
})

test('酷狗真实专辑、排行榜、搜索封面字段不再丢失，并替换尺寸与 HTTP', () => {
  const image = 'http://imge.kugou.com/stdmusic/{size}/20260924/20260924154603458622.jpg'
  for (const row of [{ album_info: { sizable_cover: image } }, { album_sizable_cover: image }, { trans_param: { union_cover: image } }]) {
    assert.equal(artwork.getKugouArtwork(row), image.replace('http:', 'https:').replace('{size}', '240'))
  }
  assert.equal(artwork.getKugouArtwork({ album_info: { sizable_cover: '' }, image }), image.replace('http:', 'https:').replace('{size}', '240'))
  assert.equal(artwork.getKugouArtwork({ image: 'javascript:alert(1)' }), '')
})

test('账号歌单的歌曲转换保留封面，不要求播放填充', () => {
  const api = load(sdk + 'songList.js', {
    './artwork': artwork, '../../request': {}, '../../index': { decodeName: String, formatPlayTime: String, sizeFormate: String },
    './util': {}, './vendors/infSign.min': {}, '@renderer/utils/musicSdk/kg/vendors/infSign.min': {},
  }).default
  const list = api.filterData2([{ songname: 'song', author_name: 'artist', album_info: { album_id: '1', album_name: 'album', sizable_cover: 'https://example.com/{size}/cover.jpg' }, audio_info: { audio_id: '1', hash: 'A'.repeat(32), timelength: '1000', filesize: '10', filesize_320: '0', filesize_flac: '0', filesize_high: '0' } }])
  assert.equal(list[0].img, 'https://example.com/240/cover.jpg')
})

test('旧歌曲缺封面先查专辑资料，成功时不依赖旧播放鉴权接口', async () => {
  let lookups = 0
  const api = load(sdk + 'pic.js', {
    './artwork': artwork,
    './musicInfo': { getMusicInfoRaw: async hash => { lookups++; assert.equal(hash, 'A'.repeat(32)); return { album_info: { sizable_cover: 'http://image/{size}/a.png' } } } },
    '../../request': { httpFetch: () => { throw Error('Legacy endpoint must not run') } },
  }).default
  assert.equal(await api.getPic({ songmid: 123, hash: 'A'.repeat(32) }), 'https://image/240/a.png')
  assert.equal(lookups, 1)
})

test('QQ 歌单排序以数字发送，避免平台忽略字符串排序', () => {
  const api = load((mobile ? 'src/utils/musicSdk/' : 'src/renderer/utils/musicSdk/') + 'tx/songList.js', { '../../request': {}, '../../index': {}, '../utils': {} }).default
  for (const order of ['5', '2']) {
    const payload = JSON.parse(new URL(api.getListUrl(order, '', 1)).searchParams.get('data'))
    assert.equal(payload.playlist.param.order, Number(order))
  }
})

test('旧歌单封面请求合并，最多三个并发，缓存结果且不触碰歌曲对象', async () => {
  let active = 0, peak = 0, calls = 0
  const loader = createArtworkLoader(async song => {
    calls++; peak = Math.max(peak, ++active)
    await new Promise(resolve => setTimeout(resolve, 5))
    active--; return 'https://cover/' + song.id
  })
  const song = track('one')
  const results = await Promise.all([loader(song), loader(song), ...Array.from({ length: 7 }, (_, i) => loader(track(String(i))))])
  assert.equal(results[0], results[1]); assert.equal(calls, 8); assert.equal(peak, 3)
  assert.equal(await loader(song), 'https://cover/one'); assert.equal(calls, 8)
  assert.equal(song.meta.picUrl, undefined)
  assert.equal(await loader({ ...track('local'), source: 'local' }), '')
})

test('失败封面不会永远缓存空值，坏旧 URL 可刷新一次', async () => {
  let now = 100, calls = 0
  const fakeDate = class extends Date { static now() { return now } }
  const context = { exports: {}, Date: fakeDate }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, utils + 'artworkLoader.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context)
  const loader = context.exports.createArtworkLoader(async (_song, refresh) => { calls++; if (calls == 1) throw Error('offline'); return refresh ? 'https://new' : 'https://cover' })
  assert.equal(await loader(track('1')), ''); assert.equal(await loader(track('1')), ''); assert.equal(calls, 1)
  now += 31_000; assert.equal(await loader(track('1')), 'https://cover')
  assert.equal(await loader({ ...track('2'), meta: { picUrl: 'https://old' } }, true), 'https://new')
})

test('三个平台的发现分类、分页与缓存相互隔离，不依赖账号登录', async () => {
  const calls = []
  const loader = createDiscoveryLoader(async (...args) => {
    calls.push(args)
    return { list: [{ id: '1', name: args[0], img: 'http://image/{size}/a', author: 'a' }, { id: '1', name: 'duplicate' }], total: 60, limit: 30 }
  })
  const first = await Promise.all([loader('tx', 'hot', 1), loader('tx', 'hot', 1)])
  assert.equal(calls.length, 1); assert.equal(first[0].list.length, 1)
  assert.equal(first[0].list[0].source, 'tx'); assert.equal(first[0].list[0].img, 'https://image/240/a')
  await loader('kg', 'new', 2); await loader('wy', 'relax', 1)
  assert.deepEqual(calls, [['tx', '5', '', 1], ['kg', '7', '', 2], ['wy', 'hot', '轻音乐', 1]])
  await assert.rejects(loader('tx', 'relax', 1), /Invalid/)
})

test('发现请求失败后可以重试，错误响应不会缓存成空歌单', async () => {
  let calls = 0
  const loader = createDiscoveryLoader(async () => {
    if (++calls == 1) throw Error('offline')
    if (calls == 2) return { list: [], limit: 0, total: 0 }
    return { list: [{ id: '1', name: 'ok' }], total: 1, limit: 30 }
  })
  await assert.rejects(loader('kg', 'hot', 1), /offline/)
  await assert.rejects(loader('kg', 'hot', 1), /Invalid/)
  assert.equal((await loader('kg', 'hot', 1)).list[0].name, 'ok')
})


test('刷新后重新进入列表复用新封面，列表元数据更新时采用最新地址', async () => {
  let calls = 0
  const loader = createArtworkLoader(async () => { calls++; return 'https://new/cover' })
  const song = { ...track('recovered'), meta: { picUrl: 'https://old/cover' } }
  assert.equal(await loader(song), 'https://old/cover')
  assert.equal(await loader(song, true), 'https://new/cover')
  assert.equal(await loader(song), 'https://new/cover')
  assert.equal(calls, 1)
  assert.equal(await loader({ ...song, meta: { picUrl: 'https://changed/cover' } }), 'https://changed/cover')
  assert.equal(await loader({ id: 'local', source: 'local', meta: { picUrl: '/local.jpg' } }), '/local.jpg')
})

test('酷狗公共资料遇到 20028 立即退出，不连发三次，也不降级请求播放鉴权', async () => {
  let requests = 0
  const { createHttpFetch } = load(sdk + 'util.js', {
    pako: {}, 'buffer': { Buffer }, '../../nativeModules/crypto': {},
    '../utils': {}, '../../request': { httpFetch: () => { requests++; return { promise: Promise.resolve({ statusCode: 200, body: { error_code: 20028 } }) } } },
  })
  await assert.rejects(createHttpFetch('https://example.com', {}), /verification_required/)
  assert.equal(requests, 1)
  const api = load(sdk + 'pic.js', {
    './artwork': artwork,
    './musicInfo': { getMusicInfoRaw: async () => { throw Error('verification_required') } },
    '../../request': { httpFetch: () => { throw Error('must not request playback API') } },
  }).default
  await assert.rejects(api.getPic({ hash: 'A'.repeat(32) }), /verification_required/)
})

test('排行榜转换完整保留原接口封面，不依赖点击播放', () => {
  const api = load(sdk + 'leaderboard.js', {
    './artwork': artwork, '../../request': {},
    '../../index': { decodeName: String, formatPlayTime: String, sizeFormate: String },
    '../utils': { formatSingerName: () => 'artist' },
  }).default
  const [song] = api.filterData([{ songname: 'song', audio_id: 12, album_sizable_cover: 'http://imge.kugou.com/{size}/cover.jpg' }])
  assert.equal(song.img, 'https://imge.kugou.com/240/cover.jpg')
})
