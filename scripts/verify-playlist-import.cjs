const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.join(__dirname, '..')
const mobile = fs.existsSync(path.join(root, 'src/core/songlist.ts'))
const sdkRoot = mobile ? 'src/utils/musicSdk' : 'src/renderer/utils/musicSdk'
function load(file, dependencies = {}) {
  const context = { exports: {}, Error, console, setTimeout, clearTimeout, require: id => {
    if (!(id in dependencies)) throw Error(id)
    return dependencies[id]
  } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, context)
  return context.exports
}
function sdk(provider, request, extra = {}) {
  return load(`${sdkRoot}/${provider}/songList.js`, {
    '../../request': { httpFetch: (url, options) => ({ promise: Promise.resolve().then(() => request(url, options)) }) },
    '../../index': { decodeName: value => value || '', formatPlayTime: String, sizeFormate: String, formatPlayCount: String },
    '../utils': { formatSingerName: () => 'artist' },
    './util': { signatureParams: () => 'test-signature' },
    '@renderer/utils/musicSdk/kg/vendors/infSign.min': {}, './vendors/infSign.min': {},
    './utils/crypto': { linuxapi: value => value }, './musicDetail': {}, './utils/index': {}, ...extra,
  }).default
}
const hash = n => n.toString(16).padStart(32, '0').toUpperCase()
const detail = (n, audioId = n) => ({
  songname: `song-${n}`, author_name: 'artist', album_info: { album_id: '1', album_name: 'album' },
  audio_info: { hash: hash(n), audio_id: audioId, timelength: '1000', filesize: '128', filesize_320: '0', filesize_flac: '0', filesize_high: '0' },
})
const response = data => ({ statusCode: 200, headers: {}, body: { error_code: 0, data } })

test('酷狗旧 hash 通过单曲查询确认新 hash，不按批量响应位置猜测', async () => {
  const calls = []
  const api = sdk('kg', (_url, options) => {
    const hashes = options.body.data.map(row => row.hash)
    calls.push(hashes.join(','))
    return response(hashes.length > 1 ? [[detail(2)], [detail(9, 1)]] : [[detail(9, 1)]])
  })
  const result = await api.getMusicInfos([{ hash: hash(1) }, { hash: hash(2) }], { requireComplete: true })
  assert.equal(result.map(row => row.hash).join(','), [hash(9), hash(2)].join(','))
  assert.equal(calls.at(-1), hash(1))
  assert.equal(calls.length, 3)
})

test('酷狗单曲映射拒绝多结果、错误歌曲 ID 和取消后的响应', async () => {
  const multiple = sdk('kg', () => response([[detail(8)], [detail(9)]]))
  await assert.rejects(multiple.getMusicInfos([{ hash: hash(1) }], { requireComplete: true }), /incomplete/)
  const mismatch = sdk('kg', () => response([[detail(8, 9)]]))
  await assert.rejects(mismatch.getMusicInfos([{ hash: hash(1), audio_id: 1 }], { requireComplete: true }), /incomplete/)
  let cancelled = false
  const stopped = sdk('kg', () => { cancelled = true; return response([[detail(9)]]) })
  await assert.rejects(stopped.getMusicInfos([{ hash: hash(1) }], { requireComplete: true, shouldCancel: () => cancelled }), /cancelled/)
})

test('酷狗新分享接口按实际偏移读完短页，保留总数和顺序', async () => {
  const offsets = []
  const api = sdk('kg', url => {
    const parsed = new URL(url)
    assert.equal(parsed.pathname, '/pubsongs/v2/get_other_list_file_nofilt')
    const offset = Number(parsed.searchParams.get('begin_idx'))
    offsets.push(offset)
    return response({ count: 5, list_info: { name: '公开歌单', pic: 'https://example.test/{size}', list_create_username: 'creator' }, songs: [1, 2, 3, 4, 5].slice(offset, offset + 2).map(n => ({ hash: hash(n) })) })
  })
  api.getMusicInfos = async (rows, options) => { assert.equal(options.requireComplete, true); return rows }
  const result = await api.getUserListDetail2('collection_3_123_4_0')
  assert.deepEqual(offsets, [0, 2, 4])
  assert.equal(result.total, 5)
  assert.equal(result.list.length, 5)
  assert.equal(result.info.name, '公开歌单')
})

test('酷狗分享接口缺页、重复页、总数变化均不返回可覆盖原列表的数据', async () => {
  for (const kind of ['empty', 'repeat', 'changed']) {
    let calls = 0
    const api = sdk('kg', () => {
      calls++
      return response({ count: kind === 'changed' && calls > 1 ? 4 : 3, list_info: {}, songs: calls > 1 && kind === 'empty' ? [] : [{ hash: hash(1) }, { hash: hash(2) }] })
    })
    await assert.rejects(api.getUserListDetail2('collection_test'), /incomplete/)
    assert.equal(calls, 2)
  }
})

test('酷狗明确隐藏的占位条目允许手动导入可用歌曲，但标记不可覆盖同步', async () => {
  const api = sdk('kg', () => response({ count: 2, list_info: { name: 'test' }, songs: [{ hash: hash(1) }, { fileid: 2, shield: 1 }] }))
  api.getMusicInfos = async rows => { assert.equal(rows.length, 1); return rows }
  const result = await api.getUserListDetail2('collection_test')
  assert.equal(result.total, 2)
  assert.equal(result.list.length, 1)
  assert.equal(result.incomplete, true)
  const corrupt = sdk('kg', () => response({ count: 1, list_info: {}, songs: [{ fileid: 2 }] }))
  await assert.rejects(corrupt.getUserListDetail2('collection_test'), /incomplete/)
})

test('酷狗不完整结果即使已被浏览缓存，也不能用于全量覆盖同步', async () => {
  const detail = { list: [{ id: 'kg-1' }], total: 2, page: 1, limit: 300, incomplete: true, info: {}, source: 'kg' }
  const music = { kg: { songList: { getListDetail: async () => ({ ...detail, list: [...detail.list] }) } } }
  const utils = { deduplicationList: rows => rows, toNewMusicInfo: row => row }
  const core = mobile ? load('src/core/songlist.ts', {
    '@/store/songlist/state': { default: {} }, '@/store/songlist/action': {}, '@/utils': utils, '@/utils/musicSdk': music,
    './browseRequest': { withBrowseTimeout: async value => value },
  }) : load('src/renderer/store/songList/action.ts', {
    '@renderer/utils': utils, '@renderer/utils/musicSdk': music, '@common/utils/vueTools': { markRaw: value => value, markRawList: value => value },
    '../browseRequest': { withBrowseTimeout: async value => value }, './state': {},
  })
  // 浏览及手动导入可获取部分结果。
  assert.equal((await core.getListDetail('collection_test', 'kg', 1, true)).list.length, 1)
  await assert.rejects(mobile ? core.getListDetailAll('kg', 'collection_test') : core.getListDetailAll('collection_test', 'kg'), /incomplete/)
})

test('酷狗数字错误码、登录失效单独返回，不重复请求安全验证失败', async () => {
  for (const [body, expected] of [[{ error_code: '20028' }, 'verification_required'], [{ error_code: 20010, errmsg: 'token expired' }, 'login_required']]) {
    let calls = 0
    const api = sdk('kg', () => { calls++; return { statusCode: 200, body } })
    await assert.rejects(api.createHttp('https://gateway.kugou.com/test'), new RegExp(expected))
    assert.equal(calls, 1)
  }
})

test('酷狗分享文案、带井号的酷狗码、新版分享参数和相对重定向可解析', async () => {
  const api = sdk('kg', () => ({ statusCode: 302, headers: { location: '/share/?global_specialid=collection_test' } }))
  api.getUserListDetailByCode = async code => `code:${code}`
  api.getUserListDetail2 = async id => `list:${id}`
  assert.equal(await api.getListDetail('复制酷狗码 #12345678# 来听歌', 1), 'code:12345678')
  assert.equal(await api.getListDetail('酷狗码：12345678', 1), 'code:12345678')
  assert.equal(await api.getListDetail('来听 https://activity.kugou.com/share/index.html?global_specialid=collection_test 分享', 1), 'list:collection_test')
  assert.equal(await api.getListDetail('https://t.kugou.com/short', 1), 'list:collection_test')
  await assert.rejects(api.getListDetail('不是链接也不是酷狗码', 1), /invalid_link/)
})

test('酷狗码解析出的全局歌单 ID 进入新接口，保留酷狗码入口协议', async () => {
  const api = sdk('kg', (url, options) => {
    assert.equal(new URL(url).pathname, '/command/')
    assert.equal(options.body.data, '12345678')
    return response({ info: { type: 2, global_collection_id: 'collection_test' } })
  })
  api.getUserListDetail2 = async id => id
  assert.equal(await api.getListDetail('#12345678#', 1), 'collection_test')
})

test('分享重定向不依赖浏览器 URL，安卓也能正确解析相对路径和查询参数', async () => {
  for (const [location, expected] of [
    ['/landing', 'https://t.kugou.com/landing'],
    ['../landing', 'https://t.kugou.com/start/landing'],
    ['../../../landing', 'https://t.kugou.com/landing'],
    ['//m.kugou.com/landing', 'https://m.kugou.com/landing'],
    ['?key=1', 'https://t.kugou.com/start/nested/item?key=1'],
  ]) {
    const requests = []
    const api = sdk('kg', url => {
      requests.push(url)
      return requests.length === 1
        ? { statusCode: 302, headers: { location } }
        : { statusCode: 200, headers: {}, body: '{"global_collection_id":"collection_test"}' }
    })
    api.getUserListDetail2 = async id => id
    assert.equal(await api.getListDetail('https://t.kugou.com/start/nested/item', 1), 'collection_test')
    assert.equal(requests[1], expected)
  }
})

test('QQ 完整分享文案直接解析 id，不额外打开分享页，也不误读 userid', async () => {
  const api = sdk('tx', () => { throw Error('unexpected request') })
  assert.equal(await api.getListId(' 分享 https://i.y.qq.com/share?userid=999&id=123456 来听 '), '123456')
  assert.equal(await api.getListId('https://y.qq.com/n/ryqq/playlist/123456'), '123456')
  await assert.rejects(api.getListId('not a playlist'), /invalid_link/)
})

test('QQ 公开大歌单按 100 首分页，第三页不是重试次数，保留平台总数', async () => {
  const pages = []
  const api = sdk('tx', url => {
    const query = new URL(url).searchParams
    const start = Number(query.get('song_begin'))
    pages.push(start)
    return { statusCode: 200, body: { code: 0, cdlist: [{ total_song_num: 223, song_begin: start, songlist: Array.from({ length: Math.min(100, 223 - start) }, (_, i) => ({ id: start + i + 1 })) }] } }
  })
  api.filterListDetail = rows => rows
  const songs = []
  for (let page = 1; page <= 3; page++) {
    const result = await api.getListDetail('123456', page)
    assert.equal(result.total, 223)
    songs.push(...result.list)
  }
  assert.deepEqual(pages, [0, 100, 200])
  assert.equal(new Set(songs.map(song => song.id)).size, 223)
})

test('网易云完整分享文案解析，分页不重复整单且不同请求不串用 token', async () => {
  const cookies = []
  const tracks = Array.from({ length: 1005 }, (_, i) => ({ id: i + 1 }))
  const api = sdk('wy', (_url, options) => {
    cookies.push(options.headers.Cookie)
    return { statusCode: 200, body: { code: 200, playlist: { trackIds: tracks, tracks, name: 'test' }, privileges: tracks } }
  })
  api.filterListDetail = ({ playlist }) => playlist.tracks
  const input = ' 分享 https://music.163.com/#/playlist?id=123456 来听###test-token '
  const first = await api.getListDetail(input, 1)
  const second = await api.getListDetail(input, 2)
  await api.getListDetail('123456', 1)
  assert.equal(first.list.length, 1000)
  assert.equal(second.list.length, 5)
  assert.equal(second.list[0].id, 1001)
  assert.deepEqual(cookies, ['MUSIC_U=test-token', 'MUSIC_U=test-token', 'MUSIC_U='])
})

test('网易云详情重试和补全保留当前 token，301 不盲目重试', async () => {
  let calls = 0
  let detailCookie
  const api = sdk('wy', (_url, options) => {
    calls++
    assert.equal(options.headers.Cookie, 'MUSIC_U=test-token')
    return calls === 1 ? { statusCode: 503, body: {} } : { statusCode: 200, body: { code: 200, playlist: { trackIds: [{ id: 1 }] } } }
  }, { './musicDetail': { getList: async (_ids, _retry, cookie) => { detailCookie = cookie; return { list: [{ id: 1 }] } } } })
  await api.getListDetail('123456###test-token', 1)
  assert.equal(detailCookie, 'MUSIC_U=test-token')
  assert.equal(calls, 2)
  const expired = sdk('wy', () => ({ statusCode: 200, body: { code: 301 } }))
  await assert.rejects(expired.getListDetail('123456###expired', 1), /login_required/)
})
