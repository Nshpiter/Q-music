const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const root = path.resolve(__dirname, '..')
const mobile = fs.existsSync(path.join(root, 'src/core/player/session.ts'))
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const load = (file, dependencies = {}) => {
  const context = { exports: {}, AbortController, URLSearchParams, require: name => { if (dependencies[name]) return dependencies[name]; throw new Error('Unexpected dependency: ' + name) } }
  vm.runInNewContext(ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
  return context.exports
}
const utils = mobile ? 'src/utils/' : 'src/common/utils/'
const { PlayHistory } = load(utils + 'playHistory.ts')
const song = (id, source = 'wy') => ({ id, source, name: id, singer: 'Artist', meta: { albumName: 'Album' } })
const plain = value => JSON.parse(JSON.stringify(value))

test('持久历史串行写入、同曲更新到最近；删单条/清空不改歌曲数据；重启保留上限', async() => {
  let saved
  const a = song('a'), b = song('b')
  const history = new PlayHistory(async() => saved, async value => { saved = plain(value) })
  await Promise.all([history.record(a, 1), history.record(b, 2), history.record(a, 3)])
  assert.deepEqual(plain(history.snapshot().entries.map(x => [x.track.id, x.playedAt])), [['a', 3], ['b', 2]])
  a.meta.albumName = 'changed'
  assert.equal(saved.entries[0].track.meta.albumName, 'Album')
  await history.setLimit(1)
  const restored = new PlayHistory(async() => saved, async value => { saved = plain(value) })
  await restored.load()
  assert.equal(restored.snapshot().limit, 1)
  assert.equal(restored.snapshot().entries.length, 1)
  await restored.remove(a)
  assert.equal(restored.snapshot().entries.length, 0)
  await restored.record(b, 4)
  await restored.clear()
  assert.equal(saved.entries.length, 0)
  assert.equal(b.name, 'b')
})
test('历史保存失败不假报成功；下一次操作可恢复，不因一次拒绝阻塞队列', async() => {
  let reject = true
  const history = new PlayHistory(async() => null, async() => { if (reject) throw new Error('disk full') })
  await assert.rejects(history.record(song('a')), /disk full/)
  assert.equal(history.snapshot().entries.length, 0)
  reject = false
  await history.record(song('b'))
  assert.equal(history.snapshot().entries[0].track.id, 'b')
  await assert.rejects(history.setLimit(-1), /history_limit_invalid/)
})
test('历史恢复过滤坏数据、按时间保留最新重复项；跨平台同 ID 不合并', async() => {
  const history = new PlayHistory(async() => ({ limit: 0, entries: [{ track: song('a'), playedAt: 1 }, null, { track: song('a'), playedAt: 3 }, { track: song('a', 'tx'), playedAt: 2 }] }), async() => {})
  await history.load()
  assert.deepEqual(plain(history.snapshot().entries.map(x => [x.track.source, x.playedAt])), [['wy', 3], ['tx', 2]])
})

test('音质排序优先匹配，不把不相关无损放在准确匹配前，缺失音质稳定垫后', () => {
  const { sortSearchQuality } = load(utils + 'searchQuality.ts')
  const list = [song('unrelated'), song('low'), song('high'), song('unknown')]
  list[0].meta._qualitys = { flac24bit: {} }
  for (const item of list.slice(1)) item.name = '晴天'
  list[1].meta._qualitys = { '128k': {} }
  list[2].meta._qualitys = { flac: {} }
  assert.equal(sortSearchQuality(list, '晴天', 'relevance'), list)
  assert.deepEqual(Array.from(sortSearchQuality(list, '晴天', 'quality'), x => x.id), ['high', 'low', 'unknown', 'unrelated'])
  assert.deepEqual(list.map(x => x.id), ['unrelated', 'low', 'high', 'unknown'])
})
test('公开B站收藏夹链接和 ml 编号，拒绝伪造域名；分页导入保留封面/UP主和刷新来源', async() => {
  const { createBilibiliClient, parseBilibiliCollection: parse } = load(utils + 'bilibili.ts')
  for (const input of ['ml123', 'https://www.bilibili.com/medialist/detail/ml123', 'https://space.bilibili.com/456/favlist?fid=123']) assert.equal(parse(input).id, '123')
  assert.equal(parse('https://space.bilibili.com.evil.test/456/favlist?fid=123'), undefined)
  const pages = []
  const client = createBilibiliClient(async url => {
    const query = new URL(url); assert.equal(query.pathname, '/x/v3/fav/resource/list')
    assert.equal(query.searchParams.get('media_id'), '123')
    const page = Number(query.searchParams.get('pn')); pages.push(page)
    return { code: 0, data: { info: { title: 'My folder', media_count: 31 }, medias: Array.from({ length: page == 1 ? 30 : 1 }, (_, i) => ({ type: 2, bvid: 'BV' + String((page - 1) * 30 + i).padStart(10, '0'), title: 'song', upper: { name: 'UP' }, cover: 'https://i0.hdslb.com/a.jpg', attr: 0 })) } }
  })
  const result = await client.importCollection('ml123')
  assert.equal(result.list.length, 31); assert.equal(result.name, 'My folder')
  assert.equal(result.list[0].singer, 'UP'); assert.equal(result.list[0].img, 'https://i0.hdslb.com/a.jpg')
  assert.deepEqual(pages, [1, 2])
})
test('私密/失效视频、变化的B站收藏夹不能把半份结果当成功覆盖本地', async() => {
  const { createBilibiliClient } = load(utils + 'bilibili.ts')
  const unavailable = createBilibiliClient(async() => ({ code: -403 }))
  await assert.rejects(unavailable.importCollection('ml123'), /-403/)
  const deleted = createBilibiliClient(async() => ({ code: 0, data: { info: { title: 'folder', media_count: 1 }, medias: [{ type: 2, bvid: 'BV0000000001', attr: 9 }] } }))
  await assert.rejects(deleted.importCollection('ml123'), /incomplete/)
  const empty = createBilibiliClient(async() => ({ code: 0, data: { info: { title: 'empty', media_count: 0 }, medias: null } }))
  assert.equal((await empty.importCollection('ml123')).total, 0)
})
test('热门歌手真实接口结构、请求合并和缓存；失败可重试、图片域名受限', async() => {
  const { createPopularArtistsLoader } = load(utils + 'popularArtists.ts')
  let calls = 0
  const get = createPopularArtistsLoader(async() => { calls++; return { code: 200, artists: [{ id: 1, name: 'Artist', picUrl: 'http://p1.music.126.net/a.jpg' }, { id: 2, name: 'Other', picUrl: 'https://example.com/a.jpg' }] } })
  const [a, b] = await Promise.all([get(), get()])
  assert.equal(calls, 1); assert.equal(a, b); assert.equal(a[0].picture, 'https://p1.music.126.net/a.jpg'); assert.equal(a[1].picture, '')
  await get(); assert.equal(calls, 1)
  const fail = createPopularArtistsLoader(async() => { throw new Error('offline') })
  await assert.rejects(fail(), /offline/); await assert.rejects(fail(), /offline/)
})
if (mobile) test('酷狗 Cookie 和 JSON 输入仅接收所需字段，保留等号，拒绝空/过长/损坏凭证', () => {
  const account = load('src/core/musicAccount/kugouApi.ts')
  const { parseKugouLoginInput: parse } = load('src/utils/kugouLoginInput.ts', { '@/core/musicAccount/kugouApi': account })
  const mid = 'a'.repeat(32)
  assert.equal(parse('userid=123; token=abc==; other=x', mid).token, 'abc==')
  assert.equal(parse('{"userId":"123","token":"abc"}', mid).mid, mid)
  for (const input of ['', '{bad', 'userid=123', 'userid=0; token=abc', 'x'.repeat(16385)]) assert.throws(() => parse(input, mid), /invalid_credentials/)
})


test('默认收藏只使用本地目录，删除目录回退，快速连点不重复写入，失败可重试', async() => {
  const lists = { defaultList: { id: 'default' }, loveList: { id: 'love' }, userList: [{ id: 'local' }, { id: 'online', source: 'tx' }] }
  const setting = { 'list.favoriteTargetId': 'local', 'list.addMusicLocationType': 'bottom' }
  const songs = []
  let fail = false, writes = 0
  const add = async(listId, tracks) => { writes++; if (fail) throw Error('disk full'); songs.push(...tracks) }
  const remove = async(...args) => { const ids = mobile ? args[1] : args[0].ids; for (let i = songs.length - 1; i >= 0; i--) if (ids.includes(songs[i].id)) songs.splice(i, 1) }
  const deps = mobile ? {
    '@/store/setting/state': { default: { setting } }, '@/store/list/state': { default: lists },
    '@/core/list': { getListMusics: async() => songs, addListMusics: add, removeListMusics: remove },
  } : {
    '@renderer/store/setting': { appSetting: setting },
    '@renderer/store/list/state': { ...lists, userLists: lists.userList },
    '@renderer/store/list/action': { checkListExistMusic: async(_, id) => songs.some(x => x.id == id), addListMusics: add, removeListMusics: remove },
  }
  const api = load(mobile ? 'src/core/localFavorite.ts' : 'src/renderer/core/localFavorite.ts', deps)
  assert.equal(api.getFavoriteListId(), 'local')
  const a = song('a')
  await Promise.all([api.toggleLocalFavorite(a), api.toggleLocalFavorite(a)])
  assert.equal(writes, 1); assert.equal(songs.length, 1)
  assert.equal(await api.toggleLocalFavorite(a), false); assert.equal(songs.length, 0)
  setting['list.favoriteTargetId'] = 'online'; assert.equal(api.getFavoriteListId(), 'love')
  setting['list.favoriteTargetId'] = 'deleted'; assert.equal(api.getFavoriteListId(), 'love')
  setting['list.favoriteTargetId'] = 'default'; assert.equal(api.getFavoriteListId(), 'default')
  fail = true; await assert.rejects(api.toggleLocalFavorite(a), /disk full/)
  fail = false; assert.equal(await api.toggleLocalFavorite(a), true)
})
