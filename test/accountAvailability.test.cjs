const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const crypto = require('node:crypto')
function load(file, dependencies, extra = {}) {
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
    '@common/utils/qqPlaylist': {}, '@common/utils/qqSign': {}, './officialAccountLogin': {}, './accountLoginNavigation': {}, './accountLoginLayout': {}, './kugouAccount': { readKugouSession: () => null },
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
