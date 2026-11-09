// 用真实 Electron 网络栈验证收藏请求；所有请求只发到本地服务器，不读取真实账号。
const { app, session } = require('electron')
const assert = require('node:assert/strict')
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.join(__dirname, '..')
const load = (file, dependencies = {}) => {
  if (file == 'src/main/modules/winMain/musicAccount.ts') {
    for (const name of ['qqAccountCatalog', 'qqPlaylistTarget', 'neteaseFavorite', 'cloudSnapshot']) {
      dependencies[`@common/utils/${name}`] = load(`src/common/utils/${name}.ts`)
    }
  }
  const context = { exports: {}, Error, URL, URLSearchParams, AbortSignal, setTimeout, clearTimeout, console, Buffer,
    require: id => { if (!(id in dependencies)) throw Error(id); return dependencies[id] },
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, context)
  return context.exports
}
app.whenReady().then(async () => {
  const songMid = '003testSongMid0'
  const signing = load('src/common/utils/qqSign.ts', { 'node:crypto': require('node:crypto') })
  const cookies = { login_type: '1', uin: 'o1234', qqmusic_key: 'Q_H_L_fake_test' }
  let receivedWrites = 0
  let cloudHasSong = false
  let persistWrites = true
  let origin
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try {
        res.setHeader('Access-Control-Allow-Origin', origin)
        res.setHeader('Access-Control-Allow-Credentials', 'true')
        // 对齐官方响应：musicu 允许 Content-Type 预检，musics 没有该响应头。
        if (req.url.startsWith('/cgi-bin/musicu.fcg')) res.setHeader('Access-Control-Allow-Headers', 'content-type')
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        res.setHeader('Content-Type', 'application/json')
        if (req.method == 'OPTIONS') { res.end(); return }
        const payload = JSON.parse(body)
        if (payload.favorite) {
          assert.equal(new URL(req.url, origin).searchParams.get('sign'), signing.signQQRequest(body))
          assert.equal('authst' in payload.comm, false)
          assert.equal('tmeLoginType' in payload.comm, false)
          assert.match(req.headers['content-type'], /^application\/x-www-form-urlencoded/)
        }
        if (payload.verify) {
          assert.match(req.headers.cookie ?? '', /test_session=local-only/)
          res.end(JSON.stringify({ code: 0, verify: { code: 0, data: { m_fan: { [songMid]: cloudHasSong } } } }))
        } else if (payload.detail) {
          res.end(JSON.stringify({ code: 0, detail: { code: 0, data: { track_info: { mid: songMid, id: 456, type: 0 } } } }))
        } else {
          receivedWrites++
          assert.equal(req.headers.referer, origin + '/')
          assert.match(req.headers.cookie ?? '', /test_session=local-only/)
          assert.equal(payload.favorite.param.v_songInfo[0].songId, 456)
          assert.equal(payload.favorite.param.dirId, 201)
          if (persistWrites) cloudHasSong = true
          res.end(JSON.stringify({ code: 0, favorite: { code: 0 } }))
        }
      } catch (error) { res.statusCode = 500; res.end('{}'); console.error(error) }
    })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const target = `http://127.0.0.1:${server.address().port}`
  // 与 QQ 网页到接口一样，保持同站点、不同源，允许 SameSite 会话 Cookie。
  origin = 'http://127.0.0.1'
  const realSession = session.fromPartition('qq-favorite-transport-regression')
  await realSession.setProxy({ mode: 'direct' })
  await realSession.cookies.set({ url: target, name: 'test_session', value: 'local-only' })
  const accountSession = {
    cookies: { get: async () => Object.entries(cookies).map(([name, value]) => ({ name, value })) },
    setProxy: async () => {},
    fetch: async (url, init) => realSession.fetch(target + new URL(url).pathname + new URL(url).search, {
      ...init,
      // 只替换测试站点与协议，保留生产代码的 Referer 路径来复现来源策略问题。
      headers: { ...init.headers, Origin: origin, Referer: origin + new URL(init.headers.Referer).pathname },
    }),
  }
  try {
    await assert.rejects(realSession.fetch(target + '/favorite', {
      method: 'POST', credentials: 'include', body: 'unused=1',
      headers: { Origin: origin, Referer: origin + '/portal/player.html' },
    }), /ERR_BLOCKED_BY_CLIENT/)
    assert.equal(receivedWrites, 0, '旧请求应在发往服务器前被拒绝')
    // 错误的 JSON 请求头会在预检阶段失败，复现真实 ERR_FAILED；不触发写入。
    await assert.rejects(realSession.fetch(target + '/cgi-bin/musics.fcg', {
      method: 'POST', credentials: 'include', body: JSON.stringify({ verify: {} }),
      headers: { Origin: origin, Referer: origin + '/', 'Content-Type': 'application/json;charset=UTF-8' },
    }), /ERR_FAILED/)
    assert.equal(receivedWrites, 0)
    const api = load('src/main/modules/winMain/musicAccount.ts', {
      electron: { session: { fromPartition: () => accountSession }, safeStorage: {}, shell: {} },
      '@main/utils': { getProxy: () => null }, '@main/utils/store': () => ({}),
      '@main/utils/navigationPolicy': {}, 'node:crypto': require('node:crypto'),
      '@common/utils/qqCredentials': load('src/common/utils/qqCredentials.ts'),
      '@common/utils/qqPlaylist': load('src/common/utils/qqPlaylist.ts'), '@common/utils/qqSign': signing,
      './kugouAccount': {}, './accountLoginLayout': {}, './officialAccountLogin': {}, './accountLoginNavigation': {},
    })
    assert.equal((await api.addQQFavoriteSong({ songMid })).status, 'added')
    assert.equal(receivedWrites, 1, '修复后的请求携带会话 Cookie 且只提交一次')
    cloudHasSong = false
    persistWrites = false
    assert.equal((await api.addQQFavoriteSong({ songMid })).status, 'unconfirmed')
    assert.equal(receivedWrites, 2, '接口报成功但未入库时也只写一次')
    assert.equal((await api.addQQFavoriteSong({ songMid, action: 'check' })).status, 'not_found')
    assert.equal(receivedWrites, 2, '核对云端不写入')
    console.log('PASS: JSON preflight failure reproduced; signed simple request succeeds; queries stay on musicu; success requires readback; checks never write')
  } finally { await new Promise(resolve => server.close(resolve)) }
}).then(() => app.exit(0), error => { console.error(error); app.exit(1) })
