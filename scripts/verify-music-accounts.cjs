const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { createHash } = require('node:crypto')
const root = path.join(__dirname, '..')
const mobile = fs.existsSync(path.join(root, 'src/core/musicAccount/kugouApi.ts'))
const base = mobile ? 'src/core/musicAccount' : 'src/common/utils'
function load(file, dependencies = {}, extra = {}) {
  if (file == `${base}/playlistSync.ts`) dependencies['@/utils/playlistMerge'] = load('src/utils/playlistMerge.ts')
  const context = { exports: {}, Error, URL, URLSearchParams, AbortController, AbortSignal, setTimeout, clearTimeout, console, ...extra,
    require: id => { if (!(id in dependencies)) throw Error(id); return dependencies[id] },
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, context)
  return context.exports
}
const qq = load(`${base}/qqCredentials.ts`)
const kg = load(`${base}/${mobile ? 'kugouApi' : 'kugouAccount'}.ts`)
const md5 = value => createHash('md5').update(value).digest('hex')
const session = { userId: '123', token: 'private-test-token', mid: 'a'.repeat(32), nickname: '测试', avatar: '' }
const qr = { key: 'test-code', mid: session.mid, expiresAt: Date.now() + 120000 }
const response = data => ({ ok: true, status: 200, json: async () => ({ status: 1, error_code: 0, data }) })
const hash = n => n.toString(16).padStart(32, '0').toUpperCase()

test('酷狗服务端缩小分页时继续读取，短页重复仍拒绝覆盖', async () => {
  const requested = []
  const api = kg.createKugouApi(async (_url, init) => {
    const page = JSON.parse(init.body).page
    requested.push(page)
    return response({ count: 5, info: [1, 2, 3, 4, 5].slice((page - 1) * 2, page * 2).map(n => ({ hash: hash(n) })) })
  }, md5)
  assert.equal((await api.getPlaylistHashes(session, '7')).join(','), [1, 2, 3, 4, 5].map(hash).join(','))
  assert.equal(requested.join(','), '1,2,3')
  let calls = 0
  const repeated = kg.createKugouApi(async () => {
    calls++
    return response({ count: 4, info: [{ hash: hash(1) }, { hash: hash(2) }] })
  }, md5)
  await assert.rejects(repeated.getPlaylistHashes(session, '7'), /incomplete/)
  assert.equal(calls, 2)
})

const loadKugouSongs = fetchDetails => load(mobile ? 'src/utils/musicSdk/kg/songList.js' : 'src/renderer/utils/musicSdk/kg/songList.js', {
  '../../request': { httpFetch: (_url, options) => ({ promise: Promise.resolve(fetchDetails(options.body.data)).then(data => ({ statusCode: 200, body: { error_code: 0, data } })) }) },
  '../../index': { decodeName: value => value, formatPlayTime: value => String(value), sizeFormate: value => String(value) },
  './vendors/infSign.min': {}, '@renderer/utils/musicSdk/kg/vendors/infSign.min': {}, './util': {},
}).default
const kugouDetail = (n, audioId = n, extras = {}) => ({
  songname: 'song-' + n, author_name: 'artist', album_info: { album_id: '1', album_name: 'album' },
  audio_info: { audio_id: String(audioId), hash: hash(n), filesize: '1024', timelength: '1000', filesize_320: '0', filesize_flac: '0', filesize_high: '0', ...extras },
})

test('酷狗同一歌曲的不同文件和音质不再按去重后的数量误报缺歌', async () => {
  const rows = [kugouDetail(1, 99), kugouDetail(2, 99)]
  const sdk = loadKugouSongs(() => rows.map(row => [row]))
  const result = await sdk.getMusicInfos([1, 2].map(n => ({ hash: hash(n) })), { requireComplete: true })
  assert.equal(result.map(row => row.hash).join(','), [1, 2].map(hash).join(','))
  const qualities = loadKugouSongs(() => [[kugouDetail(1, 99, { hash_320: hash(2), filesize_320: '2048' })]])
  const merged = await qualities.getMusicInfos([1, 2].map(n => ({ hash: hash(n) })), { requireComplete: true })
  assert.equal(merged.length, 1)
  assert.equal(merged[0]._types['320k'].hash, hash(2))
})

test('酷狗只补查缺失详情并按歌单顺序返回，真实缺失和取消仍拒绝', async () => {
  const calls = []
  const sdk = loadKugouSongs(rows => {
    calls.push(rows.map(row => row.hash).join(','))
    return calls.length === 1 ? [[kugouDetail(3)], [kugouDetail(1)]] : [[kugouDetail(2)]]
  })
  const input = [1, 2, 3].map(n => ({ hash: hash(n) }))
  const result = await sdk.getMusicInfos(input, { requireComplete: true })
  assert.equal(result.map(row => row.hash).join(','), input.map(row => row.hash).join(','))
  assert.equal(calls.length, 2)
  assert.equal(calls[1], hash(2))
  let tries = 0
  const missing = loadKugouSongs(() => { tries++; return [[kugouDetail(1)]] })
  await assert.rejects(missing.getMusicInfos(input, { requireComplete: true }), /incomplete/)
  assert.equal(tries, 4)
  const wrongSong = loadKugouSongs(() => [[kugouDetail(9)]])
  await assert.rejects(wrongSong.getMusicInfos([{ hash: hash(1), audio_id: 1 }], { requireComplete: true }), /incomplete/)
  let cancelled = false
  const stopped = loadKugouSongs(() => { cancelled = true; return [[kugouDetail(1)]] })
  await assert.rejects(stopped.getMusicInfos(input, { requireComplete: true, shouldCancel: () => cancelled }), /cancelled/)
})



test('账号导入和日推使用逐曲完整性校验，合法音质合并可导入，真实缺失仍失败', async () => {
  let complete = true
  const songList = loadKugouSongs(() => complete ? [[kugouDetail(1, 9, { hash_320: hash(2), filesize_320: '2048' })]] : [[kugouDetail(1)]])
  let read
  if (mobile) {
    const playlists = load('src/core/musicAccount/playlists.ts', {
      './cookies': {}, './requests': { fail: (code = 'unavailable') => { throw Error(code) } }, './types': {},
      '@/utils/musicSdk/tx/songList': {}, '@/utils/musicSdk/wy/songList': {}, '@/utils/musicSdk/kg/songList': songList,
      '@/utils': { toNewMusicInfo: row => row }, './kugou': {
        assertKugouSession: async () => {},
        kugouApi: { getPlaylistHashes: async () => [hash(1), hash(2)] },
      },
    })
    read = () => playlists.getAccountPlaylistTracks({ provider: 'kg', kugou: session }, '7')
    const daily = load('src/core/musicAccount/daily.ts', {
      '@react-native-async-storage/async-storage': {}, 'react-native': { NativeModules: {} }, './cookies': {}, './types': {},
      './requests': { fail: (code = 'unavailable') => { throw Error(code) } },
      './kugou': { assertKugouSession: async () => {}, requireKugouSession: async () => session, kugouApi: { getDailyHashes: async () => [hash(1), hash(2)] } },
      '@/utils/musicSdk/tx/songList': {}, '@/utils/musicSdk/wy/songList': {}, '@/utils/musicSdk/kg/songList': songList,
      '@/utils': { toNewMusicInfo: row => row }, '@/core/dailyRecommend': { getDailyRecommend: async () => [] },
    })
    const recommendation = await daily.getAccountDaily('kg', true)
    assert.equal(recommendation.kind, 'kugou_daily')
    assert.equal(recommendation.list.length, 1)
  } else {
    const imported = load('src/renderer/views/List/MyList/importPlaylist.ts', {
      '@common/constants': { LIST_IDS: {} },
      '@renderer/utils': { toNewMusicInfo: row => row, filterMusicList: rows => rows },
      '@renderer/utils/request': {}, '@renderer/utils/musicSdk': { kg: { songList } },
      '@renderer/store/songList/action': {}, '@renderer/store/list/action': {}, '@renderer/store/list/state': {},
      '@renderer/utils/ipc': {}, '@renderer/utils/musicSdk/wy/musicDetail': {}, '@renderer/utils/musicSdk/tx/musicInfo': {},
    })
    read = () => imported.loadKugouHashMusic([hash(1), hash(2)])
    await assert.rejects(imported.loadKugouHashMusic([hash(1)], undefined, () => true), error => error.code === 'cancelled')
  }
  assert.equal((await read()).length, 1)
  complete = false
  await assert.rejects(read(), error => mobile ? error.message === 'incomplete' : error.code === 'account_unavailable')
})

test('微信凭证使用 wxuin 和微信音乐令牌，不混入残留的 QQ 身份', () => {
  const result = qq.getQQRequestComm({ login_type: '2', wxuin: '009876', uin: 'o1234', qqmusic_key: 'Q_H_L_old', qm_keyst: 'W_X_current' })
  assert.equal(result.uin, '9876')
  assert.equal(result.authst, 'W_X_current')
  assert.equal(result.tmeLoginType, 1)
  assert.equal(qq.getQQCredentials({ login_type: '2', uin: 'o1234', qm_keyst: 'W_X_key' }).uin, '')
})
test('QQ 登录不受残留微信 Cookie 影响；空字段、通用 skey 不视为音乐凭证', () => {
  const result = qq.getQQRequestComm({ login_type: '1', wxuin: '9876', uin: 'o001234', qm_keyst: 'Q_H_L_current', qqmusic_key: '' })
  assert.equal(result.uin, '1234')
  assert.equal(result.tmeLoginType, 2)
  assert.equal(qq.getQQCredentials({ uin: '1234', skey: 'generic', wxopenid: 'openid' }).authst, '')
  assert.equal(qq.getQQCredentials({ wxuin: '9876', qm_keyst: 'W_X_key' }).isWeChat, true)
  assert.equal(qq.getQQCredentials({ uin: 'o000', qm_keyst: 'key' }).uin, '')
})
test('酷狗二维码等待、确认、过期、成功均有独立状态，非法成功响应不保存', async () => {
  let data = { status: 1 }
  const api = kg.createKugouApi(async () => response(data), md5)
  for (const [code, status] of [[1, 'waiting'], [2, 'scanned'], [0, 'expired']]) {
    data = { status: code }
    assert.equal((await api.checkQr(qr)).status, status)
  }
  data = { status: 4, userid: '123', token: session.token, nickname: '测试' }
  const connected = await api.checkQr(qr)
  assert.equal(connected.status, 'connected')
  assert.equal(connected.session.mid, qr.mid)
  delete data.token
  await assert.rejects(api.checkQr(qr), /unavailable/)
  assert.equal((await api.checkQr({ ...qr, expiresAt: 0 })).status, 'expired')
})
test('创建二维码校验图片，官方请求签名包含完整 query 和 body', async () => {
  const api = kg.createKugouApi(async (url, init) => {
    const parsed = new URL(url)
    assert.equal(parsed.origin, 'https://login-user.kugou.com')
    const signature = parsed.searchParams.get('signature')
    parsed.searchParams.delete('signature')
    const params = [...parsed.searchParams].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('')
    const salt = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt'
    assert.equal(signature, md5(salt + params + salt))
    assert.equal(init.credentials, 'omit')
    assert.equal(init.headers.mid, parsed.searchParams.get('mid'))
    return response({ qrcode: 'test', qrcode_img: 'data:image/png;base64,YQ==' })
  }, md5)
  assert.match((await api.createQr()).image, /^data:image\/png/)
  await assert.rejects(kg.createKugouApi(async () => response({ qrcode: 'x', qrcode_img: 'https://third-party.test/image' }), md5).createQr())
})
test('酷狗完整分页后返回歌曲，签名和设备标识与登录保持一致', async () => {
  let calls = 0
  const api = kg.createKugouApi(async (url, init) => {
    calls++
    const parsed = new URL(url)
    const body = JSON.parse(init.body)
    assert.equal(parsed.origin, 'https://gateway.kugou.com')
    assert.equal(parsed.searchParams.get('token'), session.token)
    assert.equal(body.userid, session.userId)
    assert.equal(init.headers['x-router'], 'cloudlist.service.kugou.com')
    const signature = parsed.searchParams.get('signature')
    parsed.searchParams.delete('signature')
    const params = [...parsed.searchParams].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('')
    const salt = 'OIlwieks28dk2k092lksi2UIkp'
    assert.equal(signature, md5(salt + params + init.body + salt))
    return response({ count: 301, info: body.page === 1 ? Array.from({ length: 300 }, (_, i) => ({ hash: hash(i + 1) })) : [{ hash: hash(301) }] })
  }, md5)
  const result = await api.getPlaylistHashes(session, '7')
  assert.equal(result.length, 301)
  assert.equal(calls, 2)
  assert.equal(result[300], hash(301))
})
test('缺失分页、总数变化、非法歌曲不返回可覆盖本地歌单的结果', async () => {
  for (const data of [{ count: 2, info: [{ hash: hash(1) }] }, { count: 1, info: [{ hash: 'bad' }] }]) {
    await assert.rejects(kg.createKugouApi(async () => response(data), md5).getPlaylistHashes(session, '7'), /incomplete/)
  }
  let page = 0
  const api = kg.createKugouApi(async () => response(++page === 1 ? { count: 301, info: Array.from({ length: 300 }, (_, i) => ({ hash: hash(i) })) } : { count: 302, info: [] }), md5)
  await assert.rejects(api.getPlaylistHashes(session, '7'), /incomplete/)
  const repeated = kg.createKugouApi(async () => response({ count: 600, info: Array.from({ length: 300 }, (_, i) => ({ hash: hash(i) })) }), md5)
  await assert.rejects(repeated.getPlaylistHashes(session, '7'), /incomplete/)
})
test('账号歌单分页完整、重复页失败，封面只接受 HTTP(S)', async () => {
  let page = 0
  const api = kg.createKugouApi(async () => response({ total: 2, info: [{ listid: ++page, name: '我的歌单', pic: 'http://example.test/{size}.png' }] }), md5)
  const lists = await api.getPlaylists(session)
  assert.equal(lists.length, 2)
  assert.equal(lists[0].cover, 'https://example.test/240.png')
  await assert.rejects(kg.createKugouApi(async () => response({ total: 2, info: [{ listid: 1 }] }), md5).getPlaylists(session), /incomplete/)
})
test('网络错误不泄露带 token 的 URL，取消与权限错误可区分', async () => {
  const api = kg.createKugouApi(async () => { throw Error(`failed https://gateway.kugou.com/?token=${session.token}`) }, md5)
  await assert.rejects(api.getPlaylists(session), error => error.message === 'unavailable' && !error.message.includes(session.token))
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(api.getPlaylists(session, controller.signal), /cancelled/)
  await assert.rejects(kg.createKugouApi(async () => ({ ok: false, status: 401 }), md5).getPlaylists(session), /login_required/)
  assert.equal(kg.parseKugouSession({ ...session, userId: '000' }), null)
  assert.equal(kg.parseKugouSession({ ...session, token: '' }), null)
})

if (!mobile) {
  test('PC 微信 iframe 异步写入 Cookie 后验证音乐账号并关闭登录窗口', async () => {
    const { EventEmitter } = require('node:events')
    const windows = []
    let current = {}
    let comm
    let rejectLogin = false
    const cookies = new EventEmitter()
    cookies.get = async ({ url }) => {
      assert.ok(['https://u.y.qq.com/', 'https://y.qq.com/'].includes(url))
      return Object.entries(current).map(([name, value]) => ({ name, value }))
    }
    const accountSession = {
      cookies, setProxy: async () => {},
      fetch: async (_url, init) => {
        comm = JSON.parse(init.body).comm
        return { ok: true, json: async () => ({ code: 0, status: { code: rejectLogin ? 1000 : 0, data: {} } }) }
      },
    }
    class Window extends EventEmitter {
      constructor() { super(); this.webContents = new EventEmitter(); this.webContents.setWindowOpenHandler = () => {}; this.webContents.getUserAgent = () => 'test Electron/40'; this.webContents.setUserAgent = () => {}; windows.push(this) }
      static getFocusedWindow() { return null }
      isDestroyed() { return !!this.destroyed }
      loadURL() { return Promise.resolve() }
      show() {}
      focus() {}
      close() { this.destroyed = true; this.emit('closed') }
    }
    const main = load('src/main/modules/winMain/musicAccount.ts', {
      electron: { BrowserWindow: Window, session: { fromPartition: () => accountSession }, safeStorage: {}, shell: {} },
      '@main/utils': { getProxy: () => null }, '@main/utils/store': () => ({}),
      'node:crypto': require('node:crypto'), '@common/utils/qqCredentials': qq, './kugouAccount': {},
    }, { Buffer, setInterval, clearInterval, console: { warn() {} } })
    const pending = main.openMusicAccountLogin('tx')
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(windows.length, 1)
    current = { login_type: '2', wxuin: '9876', uin: '1234', qm_keyst: 'W_X_key' }
    rejectLogin = true
    cookies.emit('changed')
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(windows[0].isDestroyed(), false)
    rejectLogin = false
    cookies.emit('changed')
    const result = await pending
    assert.equal(result.status, 'connected')
    assert.equal(comm.uin, '9876')
    assert.equal(comm.tmeLoginType, 1)
    assert.equal(windows[0].isDestroyed(), true)
    assert.equal(cookies.listenerCount('changed'), 0)
  })
}

if (mobile) {
  test('安卓微信凭证进入真实请求路径，切换身份后拒绝导入', async () => {
    let current = { login_type: '2', wxuin: '9876', qm_keyst: 'W_X_key', uin: '1234' }
    const cookies = load(`${base}/cookies.ts`, {
      './qqCredentials': qq,
      './qqImportedSession': { getQQImportedCookies: async () => null },
      'react-native': { NativeModules: { UtilsModule: { getWebCookie: async () => Object.entries(current).map(([k, v]) => `${k}=${v}`).join('; ') } } },
    })
    let comm
    const requests = load(`${base}/requests.ts`, { './cookies': cookies, './qqCredentials': qq, '@/utils/musicSdk/wy/utils/crypto': {} }, {
      fetch: async (_url, init) => { comm = JSON.parse(init.body).comm; return { ok: true, json: async () => ({ code: 0, list: { code: 0, data: {} } }) } },
    })
    const before = await requests.openAccountSession('tx')
    await requests.qqRequest(before, { list: {} })
    assert.equal(comm.uin, '9876')
    assert.equal(comm.tmeLoginType, 1)
    current = { login_type: '1', uin: '1234', qm_keyst: 'Q_H_L_key' }
    await assert.rejects(requests.assertAccountSession(before), /account_changed/)
  })
  test('安卓导入失败、取消、切换账号不写入，成功后才更新原歌单', async () => {
    let failure
    let changed = false
    let writes = 0
    let saved
    const original = { id: 'local', source: 'kg', sourceListId: 'account:123:7' }
    const state = { userList: [original] }
    const sync = load(`${base}/playlistSync.ts`, {
      '@/store/list/state': state,
      '@/core/list': { getListMusics: async () => [], setFetchingListStatus() {}, createList: async () => { writes++ }, overwriteListMusics: async (_id, tracks) => { writes++; saved = tracks } },
      '@/utils/data': { getListUpdateInfo: async () => ({}), setListSourceSnapshot: async () => {}, setListUpdateTime: async () => {} },
      './qqCredentials': qq,
      './syncState': { setPlaylistSyncState() {} },
      './playlists': {
        assertPlaylistSession: async () => { if (changed) throw Error('account_changed') },
        getAccountPlaylistTracks: async () => { if (failure) throw Error(failure); return [{ id: 'song' }] },
      },
    })
    const account = { provider: 'kg', owner: '123' }
    for (const reason of ['incomplete', 'unavailable']) {
      failure = reason
      await assert.rejects(sync.syncAccountPlaylist(account, { id: '7', name: '歌单' }), new RegExp(reason))
    }
    failure = undefined
    changed = true
    await assert.rejects(sync.syncAccountPlaylist(account, { id: '7', name: '歌单' }), /account_changed/)
    changed = false
    const controller = new AbortController()
    controller.abort()
    await assert.rejects(sync.syncAccountPlaylist(account, { id: '7', name: '歌单' }, controller.signal), /cancelled/)
    assert.equal(writes, 0)
    const result = await sync.syncAccountPlaylist(account, { id: '7', name: '歌单' })
    assert.equal(result.id, 'local')
    assert.equal(writes, 1)
    assert.equal(saved[0].id, 'song')
    assert.equal(sync.findAccountList({ provider: 'kg', owner: '999' }, '7'), undefined)
  })
}

test('酷狗日推携带当前账号并使用专属路由，保留推荐顺序并去重', async () => {
  const api = kg.createKugouApi(async (url, init) => {
    const parsed = new URL(url)
    assert.equal(parsed.origin, 'https://gateway.kugou.com')
    assert.equal(parsed.pathname, '/everyday_song_recommend')
    assert.equal(parsed.searchParams.get('userid'), session.userId)
    assert.equal(parsed.searchParams.get('token'), session.token)
    assert.equal(init.headers['x-router'], 'everydayrec.service.kugou.com')
    assert.equal(init.credentials, 'omit')
    assert.equal(JSON.parse(init.body).platform, 'android')
    const signature = parsed.searchParams.get('signature')
    parsed.searchParams.delete('signature')
    const params = [...parsed.searchParams].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('')
    const salt = 'OIlwieks28dk2k092lksi2UIkp'
    assert.equal(signature, md5(salt + params + init.body + salt))
    return response({ song_list: [{ hash: hash(5).toLowerCase() }, { hash: hash(2) }, { hash: hash(5) }] })
  }, md5)
  assert.equal(JSON.stringify(await api.getDailyHashes(session)), JSON.stringify([hash(5), hash(2)]))
  await assert.rejects(kg.createKugouApi(async () => response({ song_list: [{ hash: 'invalid' }] }), md5).getDailyHashes(session), /incomplete/)
  await assert.rejects(kg.createKugouApi(async () => response({}), md5).getDailyHashes(session), /unavailable/)
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(kg.createKugouApi(async (_url, init) => { assert.equal(init.signal.aborted, true); throw Error('aborted') }, md5).getDailyHashes(session, controller.signal), /cancelled/)
})

test('酷狗默认收藏和我喜欢归入自建，收藏他人的歌单按创建者区分', async () => {
  const lists = await kg.createKugouApi(async () => response({ info: [
    { listid: 1, name: '默认收藏', list_create_userid: session.userId, is_mine: 0, is_def: 1 },
    { listid: 2, name: '我喜欢', list_create_userid: session.userId, is_mine: 0, is_def: 2 },
    { listid: 3, name: '收藏的歌单', list_create_userid: '456', is_mine: 0 },
  ] }), md5).getPlaylists(session)
  assert.equal(lists.map(x => x.kind).join(','), 'created,created,favorite')
})


test('安卓账号日推按身份缓存，切换账号、取消或接口失败不冒充日推', async () => {
  let account = { ...session }
  let requests = 0
  let rejectDaily = false
  let changeIdentity = false
  let savedProvider = 'kg'
  const daily = load('src/core/musicAccount/daily.ts', {
    '@react-native-async-storage/async-storage': { getItem: async () => savedProvider, setItem: async (_key, value) => { savedProvider = value } },
    'react-native': { NativeModules: {} }, './cookies': {}, './types': {},
    './requests': { fail: (reason = 'unavailable') => { throw Error(reason) } },
    './kugou': { requireKugouSession: async () => { if (!account) throw Error('login_required'); return { ...account } },
      assertKugouSession: async before => { if (!account || account.token !== before.token) throw Error('account_changed') },
      kugouApi: { getDailyHashes: async () => { requests++; if (rejectDaily) throw Error('unavailable'); if (changeIdentity) account.token = 'new-token'; return [hash(1), hash(2)] } } },
    '@/utils/musicSdk/tx/songList': {}, '@/utils/musicSdk/wy/songList': {},
    '@/utils/musicSdk/kg/songList': { getMusicInfos: async rows => rows.map(row => ({ id: row.hash, source: 'kg' })) },
    '@/utils': { toNewMusicInfo: value => value }, '@/core/dailyRecommend': { getDailyRecommend: async () => [{ id: 'local-discovery', source: 'kg' }] },
  })
  assert.equal(await daily.getDailyProvider(), 'kg')
  await daily.setDailyProvider('wy')
  assert.equal(await daily.getDailyProvider(), 'wy')
  assert.equal((await daily.getAccountDaily('kg')).kind, 'kugou_daily')
  assert.equal((await daily.getAccountDaily('kg')).list[0].id, hash(1))
  assert.equal(requests, 1)
  changeIdentity = true
  const changed = await daily.getAccountDaily('kg', true)
  assert.equal(changed.kind, 'local')
  assert.equal(changed.reason, 'login_required')
  changeIdentity = false
  rejectDaily = true
  const failed = await daily.getAccountDaily('kg')
  assert.equal(failed.kind, 'local')
  assert.equal(failed.reason, 'unavailable')
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(daily.getAccountDaily('kg', true, controller.signal), /cancelled/)
  account = null
  const loggedOut = await daily.getAccountDaily('kg')
  assert.equal(loggedOut.kind, 'local')
  assert.equal(loggedOut.reason, 'login_required')
})

test('网易云直接读取账号日推，按平台顺序对齐歌曲与权限且无需 QQ 授权', async () => {
  const calls = []
  const daily = load('src/core/musicAccount/daily.ts', {
    '@react-native-async-storage/async-storage': {}, 'react-native': { NativeModules: {} }, './cookies': {}, './kugou': {},
    './requests': { fail: (reason = 'unavailable') => { throw Error(reason) },
      openAccountSession: async provider => ({ provider, cookies: { MUSIC_U: 'test-only' } }), assertAccountSession: async () => {},
      wyRequest: async (_session, path) => {
        calls.push(path)
        return path.includes('recommend') ? { data: { dailySongs: [{ id: 2 }, { id: 1 }] } }
          : { songs: [{ id: 1 }, { id: 2 }], privileges: [{ id: 1 }, { id: 2 }] }
      } },
    '@/utils/musicSdk/tx/songList': {}, '@/utils/musicSdk/kg/songList': {},
    '@/utils/musicSdk/wy/songList': { filterListDetail: data => { assert.equal(data.playlist.tracks[0].id, 2); assert.equal(data.privileges[0].id, 2); return data.playlist.tracks } },
    '@/utils': { toNewMusicInfo: value => value }, '@/core/dailyRecommend': { getDailyRecommend: async () => { throw Error('unexpected fallback') } },
  })
  const result = await daily.getAccountDaily('wy')
  assert.equal(result.kind, 'netease_daily')
  assert.equal(result.list[0].id, 2)
  assert.equal(calls.join(','), 'v3/discovery/recommend/songs,v3/song/detail')
})
