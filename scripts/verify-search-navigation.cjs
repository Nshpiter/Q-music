const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const ts = require('typescript')
function load(file, modules = {}) {
  const context = { exports: {}, require: id => { if (!(id in modules)) throw Error(id); return modules[id] } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/core/search', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context)
  return context.exports
}
const song = { id: 'tx_1', name: '歌曲', singer: '歌手甲、歌手乙', source: 'tx', meta: { albumName: '专辑', albumId: '123' } }

test('聚合专辑按平台及发行 ID 区分同名结果，失败的平台从原页重试', async() => {
  let wyOffline = true
  const calls = []
  const api = load('albums.ts', {
    '@/core/browseRequest': { withBrowseTimeout: pending => pending },
    '@/utils/musicSdk/tx/musicSearch': { default: { musicSearch: async(text, page, limit, retry, type) => {
      calls.push(['tx', page])
      assert.equal(type, 2)
      return { meta: { sum: 21 }, body: { item_album: Array.from({ length: page == 1 ? limit : 1 }, (_, i) => ({ albummid: String((page - 1) * limit + i + 1), name: '同名专辑' })) } }
    } } },
    '@/utils/musicSdk/wy/utils': { eapiRequest: (url, params) => {
      calls.push(['wy', params.offset])
      assert.equal(params.type, 10)
      return { promise: wyOffline ? Promise.reject(Error('offline')) : Promise.resolve({ body: { code: 200, result: { albumCount: 1, albums: [{ id: 1, name: '同名专辑', artists: [{ name: '歌手' }] }] } } }) }
    } },
    '@/utils/request': { httpFetch: url => {
      assert.equal(new URL(url).searchParams.get('keyword'), '同名 & live')
      return { promise: Promise.resolve({ body: { status: 1, data: { total: 1, info: [{ albumid: 1, albumname: '同名专辑' }] } } }) }
    } },
  })
  assert.equal(api.firstAlbumPages('bi').length, 0)
  const first = await api.searchAlbumPages('同名 & live', api.firstAlbumPages('all'))
  assert.deepEqual(Array.from(first.list.slice(0, 2), item => [item.source, item.id]), [['tx', '1'], ['kg', '1']])
  assert.deepEqual(Array.from(first.failed), ['wy'])
  wyOffline = false
  const second = await api.searchAlbumPages('同名 & live', first.next)
  assert.deepEqual(Array.from(second.list, item => [item.source, item.id]), [['tx', '21'], ['wy', '1']])
  assert.equal(second.next.length, 0)
  assert.deepEqual(calls, [['tx', 1], ['wy', 0], ['tx', 2], ['wy', 0]])
})

test('未挂载时保留最后一次搜索，已挂载时即时消费，卸载后不再接收', () => {
  const nav = load('navigation.ts')
  nav.requestSearch(nav.buildSongSearchRequest(song, 'song'))
  nav.requestSearch(nav.buildSongSearchRequest(song, 'artist', '歌手乙'))
  assert.equal(nav.takeSearchRequest().keyword, '歌手乙')
  assert.equal(nav.takeSearchRequest(), null)
  const received = []
  const off = nav.onSearchRequest(() => received.push(nav.takeSearchRequest()))
  nav.requestSearch(nav.buildSongSearchRequest(song, 'album'))
  assert.equal(received[0].related.song.id, song.id)
  off()
  nav.requestSearch(nav.buildSongSearchRequest(song, 'song'))
  assert.equal(received.length, 1)
  assert.equal(nav.takeSearchRequest().keyword, '歌曲')
})

test('多歌手单独搜索，缺专辑 ID 时降级关键词，本地音乐不请求平台专辑', () => {
  const nav = load('navigation.ts')
  const artist = nav.buildSongSearchRequest(song, 'artist', '歌手乙')
  assert.equal(artist.source, 'tx'); assert.equal(artist.keyword, '歌手乙'); assert.equal(artist.related, undefined)
  const missing = nav.buildSongSearchRequest({ ...song, meta: { albumName: '专辑' } }, 'album')
  assert.equal(missing.keyword, '专辑'); assert.equal(missing.related, undefined)
  const local = nav.buildSongSearchRequest({ ...song, source: 'local' }, 'album')
  assert.equal(local.source, 'all'); assert.equal(local.related, undefined)
})

test('播放器关闭完成后才切换主页搜索；导航失败不发布残留请求', async() => {
  const nav = load('navigation.ts')
  const calls = []
  let finish
  const state = { componentIds: { home: 'home', playDetail: 'player' } }
  const api = load('openSongSearch.ts', {
    './navigation': nav,
    '@/navigation': { popToRoot: id => { calls.push(id); return new Promise(resolve => { finish = resolve }) } },
    '@/core/common': { setNavActiveId: id => calls.push(id) },
    '@/store/common/state': { default: state },
  })
  const pending = api.openSongSearch(song, 'artist', '歌手乙')
  assert.deepEqual(calls, ['player']); assert.equal(nav.takeSearchRequest(), null)
  finish(); await pending
  assert.deepEqual(calls, ['player', 'nav_search']); assert.equal(nav.takeSearchRequest().keyword, '歌手乙')
  const failed = load('openSongSearch.ts', {
    './navigation': nav,
    '@/navigation': { popToRoot: async() => { throw Error('gone') } },
    '@/core/common': { setNavActiveId: () => assert.fail('must not switch') },
    '@/store/common/state': { default: state },
  })
  await assert.rejects(failed.openSongSearch(song, 'album'), /gone/)
  assert.equal(nav.takeSearchRequest(), null)
})
