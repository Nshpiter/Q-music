const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const crypto = require('node:crypto')
function load(file, dependencies, extra = {}) {
  if (file === 'main/modules/winMain/musicAccount.ts') {
    dependencies['@common/utils/playbackPolicy'] = load('common/utils/playbackPolicy.ts', {})
    dependencies['@common/utils/accountFailure'] = load('common/utils/accountFailure.ts', {})
    dependencies['@common/utils/qqPlaylistTarget'] = load('common/utils/qqPlaylistTarget.ts', {})
    dependencies['@common/utils/qqAccountCatalog'] = load('common/utils/qqAccountCatalog.ts', {})
    dependencies['@common/utils/cloudSnapshot'] = load('common/utils/cloudSnapshot.ts', {})
  }
  if (file === 'main/modules/winMain/musicAccount.ts') dependencies['@common/utils/neteaseFavorite'] = load('common/utils/neteaseFavorite.ts', {})
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { exports, require: id => { if (!(id in dependencies)) throw Error(id); return dependencies[id] },
    URL, URLSearchParams, Buffer, Error, setTimeout, clearTimeout, console: { warn() {} }, ...extra,
  })
  return exports
}
function harness(provider, mode) {
  const cookie = provider === 'wy' ? { MUSIC_U: 'test-session' } : { uin: '1234', login_type: '1', qqmusic_key: 'Q_H_L_test' }
  const calls = [], timeouts = []
  const session = {
    cookies: { get: async() => Object.entries(cookie).map(([name, value]) => ({ name, value })) },
    setProxy: async() => {},
    fetch: async(url, init) => {
      calls.push({ url, init })
      if (provider == 'tx' && mode.startsWith('catalog-')) {
        if (!init.body) {
          if (mode == 'catalog-profile-down') throw Error('network unavailable')
          return { ok: true, json: async() => ({ code: 0, data: { creator: { encrypt_uin: 'encrypted' } } }) }
        }
        const body = JSON.parse(init.body)
        const result = { code: 0 }
        for (const key of Object.keys(body).filter(key => key != 'comm')) {
          if (key == 'detail' && mode == 'catalog-readable') {
            assert.equal(body[key].method, 'uniform_get_Dissinfo')
            assert.equal(body[key].param.disstid, 777)
            assert.equal(body[key].param.dirid, 0)
            assert.equal('enc_host_uin' in body[key].param, false)
            const offset = body[key].param.song_begin
            result[key] = { code: 0, data: { code: 0, total_song_num: 230, songlist: Array.from({ length: Math.min(100, 230 - offset) }, (_, i) => ({ mid: 'mid' + (offset + i) })) } }
            continue
          }
          if (key == 'favorite' && mode == 'catalog-favorite-down') throw Error('network unavailable')
          result[key] = key == 'favorite' && mode == 'catalog-expired'
            ? { code: 104401, data: {} }
            : { code: 0, data: key == 'favorite' ? { v_list: [] } : { v_playlist: [{ dirId: 201, tid: 777, dirName: '我喜欢', songNum: 12 }] } }
        }
        return { ok: true, json: async() => result }
      }
      if ((provider === 'wy' && mode === 'timeout') || (provider === 'tx' && !init.body)) {
        assert.ok(init.signal, '账号请求必须有截止时间')
        return new Promise((_, reject) => { init.signal.addEventListener('abort', () => reject(Error('timeout')), { once: true }) })
      }
      const result = provider === 'tx' ? { code: 0, status: { code: 0 } } : mode === 'expired' ? { code: 301 } : mode === 'restricted' ? { code: 403 } :
        url.includes('/account/get') ? { code: 200, profile: { userId: 123 } } : { code: 200, playlist: [] }
      return { ok: true, status: 200, json: async() => result }
    },
  }
  const emptySession = { ...session, cookies: { get: async() => [] } }
  const api = load('main/modules/winMain/musicAccount.ts', {
    electron: { session: { fromPartition: name => name.endsWith(provider === 'wy' ? 'netease' : 'qq') ? session : emptySession }, safeStorage: {}, shell: {} },
    '@main/utils': { getProxy: () => null }, '@main/utils/store': () => ({}), '@main/utils/navigationPolicy': {},
    'node:crypto': crypto, '@common/utils/qqCredentials': load('common/utils/qqCredentials.ts', {}),
    '@common/utils/qqPlaylist': load('common/utils/qqPlaylist.ts', {}), '@common/utils/qqSign': {}, './officialAccountLogin': {}, './accountLoginNavigation': {}, './accountLoginLayout': {}, './kugouAccount': { readKugouSession: () => null },
  }, { AbortSignal: { timeout: ms => { timeouts.push(ms); const c = new AbortController(); setImmediate(() => c.abort()); return c.signal } } })
  return { api, calls, cookie, timeouts }
}
test('网易云超时与平台限制保留会话，明确的 301 才返回登录过期', async() => {
  for (const [mode, state] of [['timeout', 'unavailable'], ['restricted', 'unavailable'], ['expired', 'expired']]) {
    const h = harness('wy', mode)
    const status = await h.api.getMusicAccountStatus()
    assert.equal(status.accounts.wy.state, state)
    assert.equal(status.accounts.wy.hasSession, true)
    assert.equal((await h.api.getMusicAccountPlaylists('wy')).status, state === 'expired' ? 'login_required' : 'unavailable')
    assert.equal(h.cookie.MUSIC_U, 'test-session')
    assert.ok(h.timeouts.every(ms => ms === 12000))
  }
})
test('QQ 头像资料接口挂起不会让整个平台账号状态无限等待', async() => {
  const h = harness('tx', 'timeout')
  const status = await h.api.getMusicAccountStatus()
  assert.equal(status.accounts.tx.state, 'connected')
  assert.ok(h.calls.some(c => c.url.includes('fcg_get_profile_homepage')))
  assert.ok(h.calls.every(c => c.init.signal))
})

test('QQ 真实主进程路径在主页或收藏故障时保留自建列表并告知部分结果', async() => {
  for (const mode of ['catalog-profile-down', 'catalog-favorite-down']) {
    const h = harness('tx', mode)
    const result = await h.api.getMusicAccountPlaylists('tx')
    assert.equal(result.status, 'available')
    assert.equal(result.partial, true)
    assert.equal(result.playlists[0].id, 'dir:201')
    assert.equal(result.playlists[0].trackCount, 12)
    assert.equal(h.calls.some(call => call.init.body && JSON.parse(call.init.body).liked), false)
  }
})

test('QQ 收藏接口明确拒绝登录时主进程不返回部分成功，也不清理用户 Cookie', async() => {
  const h = harness('tx', 'catalog-expired')
  const result = await h.api.getMusicAccountPlaylists('tx')
  assert.equal(result.status, 'login_required')
  assert.equal(result.playlists.length, 0)
  assert.equal(h.cookie.qqmusic_key, 'Q_H_L_test')
})

test('PC 实际歌单详情路径按我喜欢的真实 tid 拉取 230 首，完全不请求旧主页', async() => {
  const h = harness('tx', 'catalog-readable')
  const result = await h.api.getMusicAccountPlaylistDetail('tx', 'dir:201')
  assert.equal(result.status, 'available')
  assert.equal(result.id, 'dir:201', '本地关联保持目录 ID，不能变成另一个歌单')
  assert.equal(result.ids.length, 230)
  assert.equal(result.tracks.length, 230)
  assert.equal(result.ids[229], 'mid229')
  assert.equal(h.calls.some(call => call.url.includes('fcg_get_profile_homepage')), false)
})
