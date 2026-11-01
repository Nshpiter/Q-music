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
  if (file == 'src/main/modules/winMain/kugouAccount.ts') dependencies['@common/utils/kugouFavorite'] = load('src/common/utils/kugouFavorite.ts')
  if (file == 'src/main/modules/winMain/kugouAccount.ts') dependencies['./kugouVerification'] = {}
  if (file == 'src/main/modules/winMain/musicAccount.ts') dependencies['@common/utils/neteaseFavorite'] = load('src/common/utils/neteaseFavorite.ts')
  if (file == 'src/main/modules/winMain/musicAccount.ts') dependencies['./accountLoginNavigation'] = load('src/main/modules/winMain/accountLoginNavigation.ts', {
    '../../utils/navigationPolicy': load('src/main/utils/navigationPolicy.ts', { '@common/config': { navigationUrlWhiteList: [] } }),
  })
  if (file == 'src/renderer/views/List/MyList/importPlaylist.ts') dependencies['@common/utils/playlistMerge'] = load('src/common/utils/playlistMerge.ts')
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

test('酷狗安全验证不再误报为账号失效或普通网络失败', async () => {
  const api = kg.createKugouApi(async () => ({ ok: true, status: 200, json: async () => ({ status: 0, error_code: 20028, data: {} }) }), md5)
  await assert.rejects(api.getPlaylists(session), /verification_required/)
  await assert.rejects(api.getPlaylistHashes(session, '7'), /verification_required/)
})

if (!mobile) {
  const songMid = '003testSongMid0'
  const signing = load('src/common/utils/qqSign.ts', { 'node:crypto': require('node:crypto') }, { Buffer })

  test('QQ 签名固定向量覆盖空对象、收藏请求和非 ASCII 字符，与原搜索签名兼容', async () => {
    const legacy = load('src/renderer/utils/musicSdk/tx/utils/crypto.js', { '@common/utils/qqPlaylist': load('src/common/utils/qqPlaylist.ts'), '@common/utils/qqSign': signing })
    for (const [body, expected] of [
      ['{}', 'zzcf8e26805gyafigxmxjehoe02mvsjjgtwzw6f1a05f9'],
      ['{"comm":{"uin":"1234"},"favorite":{"param":{"dirId":201}}}', 'zzc36246e6gjtgucbu5pxbmgbyfaybru3ymxk6bcd66f5'],
      ['{"text":"我喜欢/灼け落ちない翼"}', 'zzca732b8eqagzrmvg6iehetaxkrkqsf4rukeb87de9b0'],
    ]) {
      assert.equal(signing.signQQRequest(body), expected)
      assert.equal(await legacy.zzcSign(body), expected)
    }
  })

  const favoriteHarness = (options = {}) => {
    let cookies = options.cookies ?? { login_type: '1', uin: 'o1234', qqmusic_key: 'Q_H_L_test', skey: 'csrf-test' }
    const calls = []
    let reads = 0
    const accountSession = {
      cookies: { get: async ({ url }) => Object.entries(url == 'https://u.y.qq.com/' ? options.targetCookies ?? cookies : cookies).map(([name, value]) => ({ name, value })) },
      setProxy: async () => {},
      fetch: async (url, init) => {
        const body = JSON.parse(init.body)
        if (body.favorite) {
          assert.equal(new URL(url).pathname, '/cgi-bin/musics.fcg')
          assert.equal(new URL(url).searchParams.get('sign'), signing.signQQRequest(init.body))
          assert.equal('authst' in body.comm, false)
          assert.equal('tmeLoginType' in body.comm, false)
          assert.equal(init.headers['Content-Type'], 'application/x-www-form-urlencoded;charset=UTF-8')
        } else {
          assert.equal(new URL(url).pathname, '/cgi-bin/musicu.fcg')
          assert.equal(new URL(url).searchParams.has('sign'), false)
        }
        calls.push({ url, body, method: init.method, credentials: init.credentials })
        if (body.verify) {
          const value = options.states?.[reads] ?? (options.states ? undefined : reads > 0)
          reads++
          if (options.verifyFails && reads > 1) throw new Error('timeout')
          if (options.switchAfterRead) cookies = { login_type: '2', wxuin: '9876', qqmusic_key: 'W_X_other' }
          return { ok: true, json: async () => ({ code: 0, verify: { code: 0, data: { m_fan: { [songMid]: value } } } }) }
        }
        if (body.detail) {
          if (options.switchAccount) cookies = { login_type: '2', wxuin: '9876', qqmusic_key: 'W_X_other' }
          return { ok: true, json: async () => options.detailResult ?? { code: 0, detail: { code: 0, data: { track_info: options.track ?? { mid: songMid, id: 456, type: 0 } } } } }
        }
        if (options.switchAfterWrite) cookies = { login_type: '2', wxuin: '9876', qqmusic_key: 'W_X_other' }
        if (options.timeout) throw new Error('timeout')
        return { ok: !options.httpStatus, status: options.httpStatus ?? 200, json: async () => options.result ?? { code: 0, favorite: { code: 0, data: { retCode: 0 } } } }
      },
    }
    const api = load('src/main/modules/winMain/musicAccount.ts', {
      electron: { session: { fromPartition: () => accountSession }, safeStorage: {}, shell: {} },
      '@main/utils': { getProxy: () => null }, '@main/utils/store': () => ({}),
      '@main/utils/navigationPolicy': {}, 'node:crypto': require('node:crypto'),
      '@common/utils/qqCredentials': qq, '@common/utils/qqPlaylist': load('src/common/utils/qqPlaylist.ts'), '@common/utils/qqSign': signing, './kugouAccount': {}, './accountLoginLayout': {}, './officialAccountLogin': {},
    }, { Buffer, setTimeout: callback => setTimeout(callback, 0) })
    return { add: (value = songMid, action) => api.addQQFavoriteSong({ songMid: value, action }), calls, writes: () => calls.filter(x => x.body.favorite) }
  }

  test('QQ 网页 CSRF 按现行官网取值，长字符串不溢出', () => {
    const hash = value => String([...value].reduce((sum, c) => (sum * 33n + BigInt(c.charCodeAt(0))) & 0x7fffffffn, 5381n))
    for (const cookies of [{ skey: 'abc', qqmusic_key: 'def' }, { p_skey: 'test', qqmusic_key: 'music' }, { qqmusic_key: 'x'.repeat(1000) }, {}]) {
      const tokens = qq.getQQWebCsrfTokens(cookies)
      assert.equal(tokens.g_tk, hash(cookies.skey || cookies.qqmusic_key || ''))
      assert.equal(tokens.g_tk_new_20200303, hash(cookies.qqmusic_key || cookies.p_skey || cookies.skey || ''))
    }
  })

  test('QQ 收藏使用真实数字歌曲 ID 与官网认证参数，QQ／微信都在云端核实后才成功', async () => {
    for (const cookies of [
      { login_type: '1', uin: 'o1234', qqmusic_key: 'Q_H_L_test', skey: 'web-csrf' },
      { login_type: '2', wxuin: '98765432101234567', qqmusic_key: 'W_X_test', uin: '1234' },
    ]) {
      const api = favoriteHarness({ cookies })
      assert.equal((await api.add()).status, 'added')
      assert.equal(api.calls.length, 4)
      assert.equal(api.writes().length, 1)
      const { body, credentials } = api.writes()[0]
      assert.equal(credentials, 'include')
      assert.equal(body.comm.uin, cookies.wxuin ?? '1234')
      assert.equal('tmeLoginType' in body.comm, false)
      assert.equal('authst' in body.comm, false)
      assert.equal(body.comm.cv, 4747474)
      const tokens = qq.getQQWebCsrfTokens(cookies)
      for (const key of Object.keys(tokens)) assert.equal(body.comm[key], Number(tokens[key]))
      assert.equal(body.favorite.module, 'music.musicasset.PlaylistDetailWrite')
      assert.equal(body.favorite.method, 'AddSonglist')
      assert.deepEqual(body.favorite.param, { dirId: 201, v_songInfo: [{ songId: 456, songType: 0 }] })
    }
  })

  test('QQ 收藏拒绝无登录、错误歌曲和中途切换账号，不发送写请求', async () => {
    for (const [options, expected] of [
      [{ cookies: {} }, 'login_required'],
      [{ track: { mid: 'wrong', id: 456 } }, 'unsupported'],
      [{ track: { mid: songMid, id: 0 } }, 'unsupported'],
      [{ track: { mid: songMid, id: 456, type: 1 } }, 'unsupported'],
      [{ switchAccount: true }, 'account_changed'],
      [{ switchAfterRead: true }, 'account_changed'],
      [{ targetCookies: {} }, 'account_changed'],
      [{ states: [] }, 'unavailable'],
    ]) {
      const api = favoriteHarness(options)
      assert.equal((await api.add()).status, expected)
      assert.equal(api.writes().length, 0)
    }
    const malformed = favoriteHarness()
    assert.equal((await malformed.add('../bad')).status, 'unsupported')
    assert.equal((await malformed.add(songMid, 'delete')).status, 'unsupported')
    assert.equal(malformed.calls.length, 0)
  })

  test('QQ 返回 code=0 但云端无记录不报成功，只读核对不产生写入', async () => {
    const absent = favoriteHarness({ states: [false, false, false] })
    assert.equal((await absent.add()).status, 'unconfirmed')
    assert.equal(absent.writes().length, 1)
    const delayed = favoriteHarness({ states: [0, 0, 1] })
    assert.equal((await delayed.add()).status, 'added')
    assert.equal(delayed.writes().length, 1)
    for (const state of [false, true]) {
      const api = favoriteHarness({ states: [state] })
      assert.equal((await api.add(songMid, 'check')).status, state ? 'added' : 'not_found')
      assert.equal(api.writes().length, 0)
    }
    const existing = favoriteHarness({ states: [true] })
    assert.equal((await existing.add()).status, 'added')
    assert.equal(existing.writes().length, 0)
    for (const options of [{ verifyFails: true }, { states: [false] }]) {
      const api = favoriteHarness(options)
      assert.equal((await api.add()).status, 'unknown')
      assert.equal(api.writes().length, 1)
    }
  })

  test('QQ 收藏检查外层、模块和业务错误码；写入超时不自动重发', async () => {
    for (const [result, status, code] of [
      [{ code: 31 }, 'rejected', 31],
      [{ code: 0, favorite: { code: 32 } }, 'rejected', 32],
      [{ code: 0, favorite: { code: 80105 } }, 'rejected', 80105],
      [{ code: 0, favorite: { code: 0, data: { retCode: 41 } } }, 'rejected', 41],
      [{ code: 0, favorite: { code: 0, data: { retCode: 1000 } } }, 'login_required', 1000],
      [{ code: 1000 }, 'login_required', 1000],
      [{ code: 0, favorite: { code: 403 } }, 'login_required', 403],
      [{}, 'unknown'], [{ code: false }, 'unknown'], [{ code: '' }, 'unknown'],
      [{ code: 0 }, 'unknown'],
    ]) {
      const api = favoriteHarness({ result })
      const response = await api.add()
      assert.equal(response.status, status)
      assert.equal(response.code, code)
      assert.equal(api.writes().length, 1)
    }
    const timeout = favoriteHarness({ timeout: true })
    assert.equal((await timeout.add()).status, 'unknown')
    assert.equal(timeout.writes().length, 1)
    const serverError = favoriteHarness({ httpStatus: 500 })
    assert.equal((await serverError.add()).status, 'unknown')
    assert.equal(serverError.writes().length, 1)
    const switched = favoriteHarness({ switchAfterWrite: true })
    assert.equal((await switched.add()).status, 'account_changed')
    const detailRejected = favoriteHarness({ detailResult: { code: 0, detail: { code: 1000 } } })
    assert.equal((await detailRejected.add()).status, 'login_required')
    assert.equal(detailRejected.writes().length, 0)
  })
}

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
      '@renderer/utils/data': {}, '@common/utils/qqPlaylist': load('src/common/utils/qqPlaylist.ts'),
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
  await assert.rejects(read(), error => mobile ? error.message === 'incomplete' : error.code === 'playlist_incomplete')
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
  test('酷狗登录先显示前置窗口；代理初始化超时可重试，关闭后不再启动扫码', async () => {
    const { EventEmitter } = require('node:events')
    const parent = {}
    const windows = []
    const timers = []
    let proxyReady = false
    let createCalls = 0
    let releaseProxy
    class Window extends EventEmitter {
      constructor(options) {
        super(); this.options = options; this.messages = []; this.webContents = new EventEmitter()
        this.webContents.executeJavaScript = async code => { this.messages.push(code) }
        this.webContents.setWindowOpenHandler = handler => { this.openHandler = handler }
        windows.push(this)
      }
      static getFocusedWindow() { return parent }
      loadURL() { this.emit('ready-to-show'); return Promise.resolve() }
      isDestroyed() { return !!this.destroyed }
      show() { this.visible = true }
      focus() { this.focused = true }
      close() { this.destroyed = true; this.emit('closed') }
    }
    const main = load('src/main/modules/winMain/kugouAccount.ts', {
      electron: { BrowserWindow: Window, safeStorage: { isEncryptionAvailable: () => true }, session: { fromPartition: () => ({ setProxy: () => proxyReady ? Promise.resolve() : new Promise(resolve => { releaseProxy = resolve }) }) } },
      '@main/utils': { getProxy: () => null }, '@main/utils/store': () => ({}), 'node:crypto': require('node:crypto'),
      '@common/utils/kugouAccount': { ...kg, createKugouApi: () => ({ createQr: async () => { createCalls++; return { ...qr, image: 'data:image/png;base64,YQ==' } }, checkQr: async () => ({ status: 'waiting' }) }) },
    }, { setTimeout: (callback, delay) => { const timer = { callback, delay }; timers.push(timer); return timer }, clearTimeout: () => {} })
    const pending = main.openKugouLogin()
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(windows[0].visible, true)
    assert.equal(windows[0].focused, true)
    assert.equal(windows[0].options.parent, parent)
    assert.equal(windows[0].options.modal, true)
    assert.equal(createCalls, 0)
    timers.find(timer => timer.delay === 12000).callback()
    await new Promise(resolve => setImmediate(resolve))
    assert.ok(windows[0].messages.some(message => message.includes('二维码加载失败')))
    proxyReady = true
    assert.equal(windows[0].openHandler({ url: 'about:blank#refresh' }).action, 'deny')
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(createCalls, 1)
    const repeated = main.openKugouLogin()
    assert.equal(windows.length, 1)
    windows[0].close()
    assert.equal(await pending, 'cancelled')
    assert.equal(await repeated, 'cancelled')
    proxyReady = false
    const next = main.openKugouLogin()
    await new Promise(resolve => setImmediate(resolve))
    windows[1].close()
    releaseProxy()
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(await next, 'cancelled')
    assert.equal(createCalls, 1)
  })

  test('PC 账号入口恢复官方网页登录，并将验证后的凭证用于歌单请求', async () => {
    const { EventEmitter } = require('node:events')
    const navigation = load('src/main/utils/navigationPolicy.ts', { '@common/config': load('src/common/config.ts') })
    const contents = new EventEmitter()
    contents.getUserAgent = () => 'Chrome/1 Electron/40'
    contents.setUserAgent = () => {}
    contents.setWindowOpenHandler = () => {}
    const loadedUrls = []
    contents.loadURL = async url => { loadedUrls.push(url) }
    // 模拟真实创建顺序：全局 guard 先安装，账号窗口的专属规则后注册。
    navigation.installNavigationGuard(contents)
    const current = { login_type: '2', wxuin: '9876', qm_keyst: 'W_X_key' }
    let comm
    const accountSession = { cookies: { get: async () => Object.entries(current).map(([name, value]) => ({ name, value })) },
      setProxy: async () => {}, fetch: async (_url, init) => {
        if (!init?.body) return { ok: true, json: async () => ({ data: { creator: {} } }) }
        comm = JSON.parse(init.body).comm
        return { ok: true, json: async () => ({ code: 0, status: { code: 0 } }) }
      } }
    const main = load('src/main/modules/winMain/musicAccount.ts', {
      electron: { session: { fromPartition: () => accountSession }, safeStorage: {}, shell: {} },
      '@main/utils': { getProxy: () => null }, '@main/utils/store': () => ({}),
      '@main/utils/navigationPolicy': navigation,
      'node:crypto': require('node:crypto'), '@common/utils/qqCredentials': qq,
      '@common/utils/qqPlaylist': load('src/common/utils/qqPlaylist.ts'), '@common/utils/qqSign': load('src/common/utils/qqSign.ts', { 'node:crypto': require('node:crypto') }, { Buffer }),
      './kugouAccount': { readKugouSession: () => null },
      './accountLoginLayout': {},
      './officialAccountLogin': { openOfficialAccountLogin: async (provider, options) => {
        assert.equal(provider, 'tx'); assert.equal(options.session, accountSession)
        assert.equal(options.url, 'https://y.qq.com/n/ryqq/profile')
        options.configureContents(contents, () => {})
        const allowed = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true } }
        contents.emit('will-navigate', allowed, 'https://y.qq.com/portal/wx_redirect.html?login_type=2&code=test')
        assert.equal(allowed.defaultPrevented, false)
        contents.emit('will-redirect', allowed, 'http://y.qq.com/portal/wx_redirect.html?login_type=2&code=test')
        assert.equal(allowed.defaultPrevented, true)
        assert.equal(loadedUrls.at(-1), 'https://y.qq.com/portal/wx_redirect.html?login_type=2&code=test')
        assert.equal(await options.verify(), true)
        return 'connected'
      } },
    }, { Buffer, console: { warn() {} } })
    assert.equal((await main.openMusicAccountLogin('tx')).status, 'connected')
    assert.equal((await main.getMusicAccountStatus()).tx, true)
    assert.equal(comm.uin, '9876')
    assert.equal(comm.tmeLoginType, 1)
  })

}

if (mobile) {
  test('安卓微信凭证进入真实请求路径，切换身份后拒绝导入', async () => {
    let current = { login_type: '2', wxuin: '9876', qm_keyst: 'W_X_key', uin: '1234' }
    const cookies = load(`${base}/cookies.ts`, {
      './qqCredentials': qq,
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
      '@/core/list': { setFetchingListStatus() {}, createList: async () => { writes++ }, overwriteListMusics: async (_id, tracks) => { writes++; saved = tracks } },
      '@/utils/data': { setListUpdateTime: async () => {} },
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
test("酷狗 HTTP 200 内的失效凭证单独提示重新登录", async () => {
  const api = kg.createKugouApi(async () => ({ ok: true, status: 200, json: async () => ({ status: 0, error_code: 999, error_msg: "token expired" }) }), md5)
  await assert.rejects(api.getPlaylistHashes(session, "7"), /login_required/)
  const network = kg.createKugouApi(async () => { throw Error("network") }, md5)
  await assert.rejects(network.getPlaylistHashes(session, "7"), /unavailable/)
})
