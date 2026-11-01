const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const mobile = fs.existsSync(path.join(root, 'src/core/songlist.ts'))
const file = path.join(root, mobile ? 'src/utils/neteaseFavorite.ts' : 'src/common/utils/neteaseFavorite.ts')
const context = { exports: {}, Error, setTimeout }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context)
const { createNeteaseFavoriteClient } = context.exports

const detail = (ids, extra = {}) => ({ code: 200, playlist: { id: 789, creator: { userId: 123 }, trackIds: ids.map(id => ({ id })), trackCount: ids.length, ...extra } })
function fixture({ ids = [], write, read, lists, assertSession } = {}) {
  let liked = ids
  let reads = 0
  const calls = []
  const client = createNeteaseFavoriteClient(async () => ({
    assertSession: assertSession || (async () => {}),
    request: async (route, data) => {
      calls.push({ route, data })
      if (route === 'w/nuser/account/get') return { code: 200, profile: { userId: 123 } }
      if (route === 'user/playlist') return lists ? lists(data) : { code: 200, playlist: [
        { id: 100, specialType: 0, name: '我喜欢的音乐', creator: { userId: 123 } },
        { id: 200, specialType: 5, creator: { userId: 999 } },
        { id: 789, specialType: 5, creator: { userId: 123 } },
      ] }
      if (route === 'v6/playlist/detail') {
        assert.equal(data.id, '789')
        return read ? read(++reads) : detail(liked)
      }
      assert.equal(route, 'playlist/manipulate/tracks')
      assert.equal(data.pid, '789')
      assert.equal(data.op, 'add')
      assert.deepEqual(JSON.parse(data.trackIds), ['456'])
      if (write) return write()
      liked = [456]
      return { code: 200 }
    },
  }), async () => {})
  return { client, calls }
}

test('网易云已收藏歌曲不重复写入；新收藏必须回查成功', async () => {
  const existing = fixture({ ids: [456] })
  assert.equal((await existing.client({ songId: '456' })).status, 'added')
  assert.equal(existing.calls.some(c => c.route === 'playlist/manipulate/tracks'), false)
  const fresh = fixture()
  assert.equal((await fresh.client({ songId: '456' })).status, 'added')
  assert.equal(fresh.calls.filter(c => c.route === 'playlist/manipulate/tracks').length, 1)
  assert.equal(fresh.calls.at(-1).route, 'v6/playlist/detail')
})

test('写入受理但回查未命中不报成功，核对操作不会写入', async () => {
  const f = fixture({ write: async () => ({ code: 200 }) })
  assert.equal((await f.client({ songId: '456' })).status, 'unconfirmed')
  assert.equal(f.calls.filter(c => c.route === 'playlist/manipulate/tracks').length, 1)
  assert.equal((await f.client({ songId: '456', action: 'check' })).status, 'not_found')
  assert.equal(f.calls.filter(c => c.route === 'playlist/manipulate/tracks').length, 1)
})

test('读写错误区分登录失效、拒绝和结果未知', async () => {
  for (const [code, expected] of [[301, 'login_required'], [401, 'login_required'], [403, 'rejected'], [250, 'rejected'], [-460, 'rejected'], [512, 'rejected']]) {
    const f = fixture({ write: async () => ({ code }) })
    const result = await f.client({ songId: '456' })
    assert.equal(result.status, expected)
    assert.equal(result.code, code)
  }
  const network = fixture({ write: async () => { throw Error('timeout') } })
  assert.equal((await network.client({ songId: '456' })).status, 'unknown')
  const malformed = fixture({ read: () => ({ code: 200 }) })
  assert.equal((await malformed.client({ songId: '456' })).status, 'unavailable')
  assert.equal(malformed.calls.some(c => c.route === 'playlist/manipulate/tracks'), false)
  const verifyFailed = fixture({ read: n => n === 1 ? detail([]) : { code: 403 } })
  assert.equal((await verifyFailed.client({ songId: '456' })).status, 'unknown')
})

test('账号切换时停止，不能把另一账号的成功作为当前结果', async () => {
  let checks = 0
  const f = fixture({ assertSession: async () => { if (++checks === 5) throw Error('account_changed') } })
  assert.equal((await f.client({ songId: '456' })).status, 'account_changed')
  assert.equal(f.calls.some(c => c.route === 'playlist/manipulate/tracks'), false)
})

test('重复点击只提交一次，非法平台 ID 不发请求', async () => {
  const f = fixture()
  const results = await Promise.all([f.client({ songId: '456' }), f.client({ songId: '456' })])
  assert.ok(results.every(result => result.status === 'added'))
  assert.equal(f.calls.filter(c => c.route === 'playlist/manipulate/tracks').length, 1)
  const invalid = fixture()
  for (const songId of ['qqmid', '0', '-1', '1.2', '9007199254740992', '']) assert.equal((await invalid.client({ songId })).status, 'unsupported')
  assert.equal((await invalid.client({ songId: '456', action: 'delete' })).status, 'unsupported')
  assert.equal(invalid.calls.length, 0)
})

test('喜欢歌单可分页定位，不能写入同名普通歌单或他人歌单', async () => {
  const f = fixture({ lists: data => data.offset === 0
    ? { code: 200, more: true, playlist: [{ id: 1, specialType: 0, creator: { userId: 123 } }] }
    : { code: 200, more: false, playlist: [{ id: 789, specialType: 5, creator: { userId: 123 } }] } })
  assert.equal((await f.client({ songId: '456' })).status, 'added')
  assert.equal(f.calls.filter(c => c.route === 'user/playlist').length, 2)
  const missing = fixture({ lists: () => ({ code: 200, playlist: [{ id: 789, specialType: 5, creator: { userId: 999 } }] }) })
  assert.equal((await missing.client({ songId: '456' })).status, 'unavailable')
  assert.equal(missing.calls.some(c => c.route === 'playlist/manipulate/tracks'), false)
})

test('响应不完整不重写；异步可见与已存在响应仍需回查', async () => {
  const partial = fixture({ read: () => detail([], { trackCount: 100 }) })
  assert.equal((await partial.client({ songId: '456' })).status, 'unavailable')
  assert.equal(partial.calls.some(c => c.route === 'playlist/manipulate/tracks'), false)
  for (const code of [200, 502]) {
    const delayed = fixture({ write: async () => ({ code }), read: n => detail(n >= 4 ? [456] : []) })
    assert.equal((await delayed.client({ songId: '456' })).status, 'added')
    assert.equal(delayed.calls.filter(c => c.route === 'playlist/manipulate/tracks').length, 1)
  }
})
