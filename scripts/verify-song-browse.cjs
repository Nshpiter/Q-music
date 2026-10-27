const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../src/core/music/songBrowse.ts'), 'utf8')
const sample = { id: 'tx_abc', source: 'tx', name: 'Hello', singer: 'Adele', interval: '04:55', meta: { songId: 'abc', albumId: '123' } }
const convert = row => ({ id: `${row.source}_${row.songmid}`, source: row.source, name: row.name, singer: row.singer, interval: row.interval, meta: { songId: row.songmid } })
function fixture(overrides = {}) {
  const requests = []
  const sdk = { tx: { musicSearch: { handleResult: rows => rows.map(row => ({ source: 'tx', songmid: row.mid, name: row.name })) } }, wy: { musicSearch: { search: async() => ({ list: [] }) } } }
  const modules = {
    '@/utils/musicSdk': { default: sdk },
    '@/utils/request': { httpFetch: url => { requests.push(url); return { promise: Promise.resolve({ body: { code: 200, songs: [{ id: 2, name: '推荐歌曲', artists: [{ name: '歌手' }], album: { id: 3, name: '专辑' }, duration: 185000 }] } }), cancelHttp() {} } } },
    '@/utils': { toNewMusicInfo: convert, formatPlayTime: seconds => `${Math.floor(seconds / 60)}`.padStart(2, '0') + ':' + `${Math.floor(seconds % 60)}`.padStart(2, '0') },
    '@/utils/musicSdk/tx/utils': {}, '@/utils/musicSdk/wy/utils': {}, '@/utils/musicSdk/kg/musicInfo': {},
    ...overrides,
  }
  const context = { exports: {}, require: id => modules[id], setTimeout, clearTimeout }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context)
  return { ...context.exports, requests, sdk }
}
test('网易云两种曲目字段均保留专辑、歌手、时长及音质', () => {
  const api = fixture()
  for (const raw of [{ id: 1, name: 'Hello', artists: [{ name: 'Adele' }], album: { id: 2, name: '25' }, duration: 295000, hMusic: {} }, { id: 1, name: 'Hello', ar: [{ name: 'Adele' }], al: { id: 2, name: '25' }, dt: 295000, h: {} }]) {
    const result = api.fromNeteaseSong(raw)
    assert.equal(result.singer, 'Adele'); assert.equal(result.meta.albumId, 2); assert.equal(result.interval, '04:55'); assert.ok(result.meta._qualitys['320k'])
  }
})
test('取消专辑请求后终止等待，不把迟到结果交给列表', async() => {
  let finish
  const api = fixture({ '@/utils/musicSdk/wy/utils': { eapiRequest: () => ({ promise: new Promise(resolve => { finish = resolve }), cancelHttp() {} }) } })
  const task = api.createSongBrowseTask({ ...sample, source: 'wy' }, 'album')
  task.cancel()
  await assert.rejects(task.promise, error => error.reason == 'cancelled')
  finish({ body: { code: 200, songs: [] } })
})

test('QQ 专辑数字 ID 和 MID 分开传递，第二页偏移正确', async() => {
  const calls = []
  const api = fixture({ '@/utils/musicSdk/tx/utils': { signRequest: async data => { calls.push(data.req.param); return { body: { code: 0, req: { code: 0, data: { songList: [{ songInfo: { mid: 'track1', name: 'one' } }], totalNum: 201 } } } } } } })
  const first = await api.createSongBrowseTask(sample, 'album', '', 2).promise
  assert.equal(calls[0].albumID, 123); assert.equal(calls[0].albumMid, ''); assert.equal(calls[0].begin, 100); assert.equal(first.hasMore, true)
  await api.createSongBrowseTask({ ...sample, meta: { ...sample.meta, albumMid: '001abcdef12345' } }, 'album').promise
  assert.equal(calls[1].albumID, 0); assert.equal(calls[1].albumMid, '001abcdef12345')
})
test('酷狗专辑分页和元数据转换，网易云专辑直接读取曲目顺序', async() => {
  const api = fixture({
    '@/utils/request': { httpFetch: () => ({ promise: Promise.resolve({ body: { errcode: 0, data: { info: [{ hash: 'h1' }], total: 1 } } }), cancelHttp() {} }) },
    '@/utils/musicSdk/kg/musicInfo': { getMusicInfosByList: async rows => rows.map(row => ({ source: 'kg', songmid: row.hash, name: 'one' })) },
    '@/utils/musicSdk/wy/utils': { eapiRequest: () => ({ promise: Promise.resolve({ body: { code: 200, songs: [{ id: 9, name: 'first' }, { id: 3, name: 'second' }] } }), cancelHttp() {} }) },
  })
  const kg = await api.createSongBrowseTask({ ...sample, source: 'kg' }, 'album').promise
  assert.equal(kg.songs[0].id, 'kg_h1'); assert.equal(kg.hasMore, false)
  const wy = await api.createSongBrowseTask({ ...sample, source: 'wy' }, 'album').promise
  assert.equal(wy.songs.map(row => row.name).join(','), 'first,second')
})
