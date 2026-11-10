// 使用真实账号适配器与请求封装，网络和原生 Cookie 读取使用离线夹具。
const test = require('node:test')
const assert = require('node:assert/strict')
const harness = require('./verify-account-playlists.cjs')
const { load, requests, cookies, qq, wy, utils, setHandler, setCookie } = harness
const api = load('core/musicAccount/playlists.ts', {
  './requests': requests, './cookies': cookies,
  '@/utils/musicSdk/tx/songList': qq, '@/utils/musicSdk/wy/songList': wy, '@/utils': utils,
})
const csrf = load('core/musicAccount/qqCredentials.ts', {})
const cookie = 'uin=123; qqmusic_key=test-key; skey=test-web-key'
const owned = [{ dirId: 201, dirName: '我喜欢', songNum: 230 }, { dirId: 2, tid: '300', dirName: '默认收藏', songNum: 0 }]
function install(web, options = {}) {
  setCookie(cookie)
  setHandler((url, init) => {
    if (url.includes('profile_homepage')) return options.profile ?? { code: 1306 }
    if (url.includes('musicu.fcg')) {
      const body = JSON.parse(init.body)
      if (body.created) return { code: 0, created: { code: 0, data: { v_playlist: owned, bFinish: true } } }
      if (body.favorite) return { code: 0, favorite: options.favorite ?? { code: 1306 } }
      throw Error('unexpected music request')
    }
    const parsed = new URL(url)
    assert.equal(parsed.origin, 'https://c.y.qq.com')
    assert.equal(parsed.pathname, '/fav/fcgi-bin/fcg_get_profile_order_asset.fcg')
    for (const [key, value] of Object.entries({ userid: '123', loginUin: '123', reqtype: '3', cid: '205360956', ...csrf.getQQWebCsrfTokens({ skey: 'test-web-key', qqmusic_key: 'test-key' }) })) {
      assert.equal(parsed.searchParams.get(key), value)
    }
    assert.equal(init.method ?? 'GET', 'GET')
    assert.equal(init.credentials, 'omit')
    assert.match(init.headers.Cookie, /qqmusic_key=test-key/)
    assert.equal(init.headers.Referer, 'https://y.qq.com/')
    assert.match(init.headers['User-Agent'], /Chrome/)
    return web(parsed, init)
  })
}

test('安卓主页不可用时使用官网收藏接口，205 个收藏跨页完整读取及映射', async() => {
  const offsets = []
  install(url => {
    const offset = Number(url.searchParams.get('sin'))
    assert.equal(Number(url.searchParams.get('ein')), offset + 100)
    offsets.push(offset)
    return { code: 0, data: { totaldiss: 205, has_more: offset < 200 ? 1 : 0, cdlist: Array.from({ length: Math.min(100, 205 - offset) }, (_, i) => ({ dissid: String(1000 + offset + i), dissname: '收藏' + (offset + i), logo: '//example.com/cover.jpg', songnum: 10 })) } }
  })
  const session = await api.openPlaylistSession('tx')
  assert.equal(session.encryptedUin, '')
  const lists = await api.getAccountPlaylists(session)
  assert.deepEqual(offsets, [0, 100, 200])
  assert.equal(lists.length, 207)
  assert.equal(lists[2].id, '1000')
  assert.equal(lists[2].name, '收藏0')
  assert.equal(lists[2].cover, 'https://example.com/cover.jpg')
  assert.equal(lists[2].count, 10)
  assert.equal(lists[2].kind, 'favorite')
  assert.equal(session.catalogPartial, false)
})

test('安卓音乐收藏接口不可用时回退，正常返回不额外请求，明确空收藏也是完整结果', async() => {
  for (const profile of [{ code: 1306 }, { code: 0, data: { creator: { encrypt_uin: 'encrypted' } } }]) {
    install(() => ({ code: 0, data: { totaldiss: 0, cdlist: null } }), { profile })
    const session = await api.openPlaylistSession('tx')
    assert.equal((await api.getAccountPlaylists(session)).length, 2)
    assert.equal(session.catalogPartial, false)
  }
  install(() => { throw Error('must not fall back') }, { profile: { code: 0, data: { creator: { encrypt_uin: 'encrypted' } } }, favorite: { code: 0, data: { v_list: [] } } })
  const session = await api.openPlaylistSession('tx')
  assert.equal((await api.getAccountPlaylists(session)).length, 2)
  assert.equal(session.catalogPartial, false)
})

test('安卓官网收藏拒绝残缺分页，不将异常当成没有收藏', async() => {
  for (const data of [
    { totaldiss: 2, cdlist: [] },
    { totaldiss: 2, cdlist: [{ dissid: '500' }], has_more: 0 },
    { totaldiss: 0, cdlist: [{ dissid: '500' }] },
  ]) {
    install(() => ({ code: 0, data }))
    await assert.rejects(api.getAccountPlaylists(await api.openPlaylistSession('tx')), /incomplete/)
  }
  for (const response of [{ code: 1306 }, { code: 0, data: {} }, { data: { totaldiss: 0 } }]) {
    install(() => response)
    const session = await api.openPlaylistSession('tx')
    assert.equal((await api.getAccountPlaylists(session)).length, 2)
    assert.equal(session.catalogPartial, true)
  }
})

test('安卓官网收藏登录失效、换号和取消不能提交旧账号目录', async() => {
  for (const code of [1000, 104401]) {
    install(() => ({ code }))
    await assert.rejects(api.getAccountPlaylists(await api.openPlaylistSession('tx')), /login_required/)
  }
  install(() => { setCookie('uin=999; qqmusic_key=another-account'); return { code: 0, data: { totaldiss: 0 } } })
  await assert.rejects(api.getAccountPlaylists(await api.openPlaylistSession('tx')), /account_changed/)
  install(() => ({ code: 0, data: { totaldiss: 0 } }))
  const session = await api.openPlaylistSession('tx')
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(api.getAccountPlaylists(session, controller.signal), /cancelled/)
})
