const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { createHash } = require('node:crypto')
const root = path.resolve(__dirname, '..')
const mobile = fs.existsSync(path.join(root, 'src/core/musicAccount/kugouApi.ts'))
function load(file, dependencies = {}, extra = {}) {
  const context = { exports: {}, Error, URLSearchParams, AbortController, setTimeout, clearTimeout, ...extra, require: id => { if (!(id in dependencies)) throw Error(id); return dependencies[id] } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context)
  return context.exports
}
const { createKugouFavoriteClient } = load(mobile ? 'src/utils/kugouFavorite.ts' : 'src/common/utils/kugouFavorite.ts')
const { createKugouApi } = load(mobile ? 'src/core/musicAccount/kugouApi.ts' : 'src/common/utils/kugouAccount.ts')
const md5 = value => createHash('md5').update(value).digest('hex')
const song = { hash: 'ABCDEF0123456789ABCDEF0123456789', name: '歌手 - 歌曲', albumId: '456' }
const session = { userId: '123', token: 'test-token', mid: 'a'.repeat(32) }
function fixture(options = {}) {
  let hashes = options.existing ? [song.hash.toLowerCase()] : []
  let reads = 0, writes = 0, assertions = 0
  const client = createKugouFavoriteClient(async () => ({
    assertSession: async () => { assertions++; if (options.assert) await options.assert(assertions) },
    getFavorites: async () => options.lists || [{ id: '1', name: '我喜欢' }, { id: '2', isFavorite: true }],
    getHashes: async id => { assert.equal(id, '2'); reads++; return options.read ? options.read(reads) : hashes },
    addSong: async (id, input) => {
      writes++; assert.equal(id, '2'); assert.equal(input.hash, song.hash)
      if (options.write) return options.write()
      hashes = [song.hash]
    },
    verifySession: options.verify,
  }), async () => {})
  return { client, counts: () => ({ reads, writes }) }
}
test('酷狗只追加到官方喜欢歌单，重复收藏不写入', async () => {
  const added = fixture()
  assert.equal((await added.client(song)).status, 'added')
  assert.deepEqual(added.counts(), { reads: 2, writes: 1 })
  const existing = fixture({ existing: true })
  assert.equal((await existing.client(song)).status, 'added')
  assert.equal(existing.counts().writes, 0)
})
test('只读核对、结果未落库和延迟可见不会重复提交', async () => {
  const missing = fixture({ write: async () => {} })
  assert.equal((await missing.client({ ...song, action: 'check' })).status, 'not_found')
  assert.equal(missing.counts().writes, 0)
  assert.equal((await missing.client(song)).status, 'unconfirmed')
  assert.equal(missing.counts().writes, 1)
  const delayed = fixture({ read: n => n < 4 ? [] : [song.hash] })
  assert.equal((await delayed.client(song)).status, 'added')
  assert.equal(delayed.counts().writes, 1)
})
test('不能定位唯一我喜欢、不完整读回、切换账号均不会错误写入', async () => {
  for (const lists of [[], [{ id: '1', name: '我喜欢' }], [{ id: '1', isFavorite: true }, { id: '2', isFavorite: true }]]) {
    const f = fixture({ lists })
    assert.equal((await f.client(song)).status, 'unavailable')
    assert.equal(f.counts().writes, 0)
  }
  const incomplete = fixture({ read: () => { throw Error('incomplete') } })
  assert.equal((await incomplete.client(song)).status, 'unavailable')
  assert.equal(incomplete.counts().writes, 0)
  const changed = fixture({ assert: n => { if (n === 5) throw Error('account_changed') } })
  assert.equal((await changed.client(song)).status, 'account_changed')
  assert.equal(changed.counts().writes, 0)
})
test('掉登录、安全验证、写入超时分别呈现，回查失败不能误报拒绝', async () => {
  for (const [reason, status] of [['login_required', 'login_required'], ['verification_required', 'verification_pending'], ['timeout', 'unknown']]) {
    const f = fixture({ write: () => { throw Error(reason) } })
    const result = await f.client(song)
    assert.equal(result.status, status)
    if (reason === 'verification_required') assert.equal(result.code, 20028)
  }
  const rejected = fixture({ write: () => { throw Object.assign(Error('rejected'), { code: 12345 }) } })
  assert.equal((await rejected.client(song)).code, 12345)
  const verify = fixture({ read: n => { if (n > 1) throw Error('network'); return [] } })
  assert.equal((await verify.client(song)).status, 'unknown')
})

test('20028发生在读前或写后均进入安全验证，不伪装成收藏被拒', async () => {
  const before = fixture({ read: () => { throw Error('verification_required') } })
  assert.equal((await before.client(song)).status, 'verification_required')
  assert.equal(before.counts().writes, 0)
  const after = fixture({ read: n => { if (n > 1) throw Error('verification_required'); return [] } })
  assert.equal((await after.client(song)).status, 'verification_pending')
  assert.equal(after.counts().writes, 1)
})

test('完成验证只核对；取消、过期、失败和不支持均不会隐式收藏', async () => {
  for (const reason of [null, 'verification_cancelled', 'verification_expired', 'verification_failed', 'verification_unsupported']) {
    const f = fixture({ verify: async () => { if (reason) throw Error(reason) } })
    assert.equal((await f.client({ ...song, action: 'verify' })).status, reason || 'not_found')
    assert.equal(f.counts().writes, 0)
  }
  const added = fixture({ existing: true, verify: async () => {} })
  assert.equal((await added.client({ ...song, action: 'verify' })).status, 'added')
  assert.equal(added.counts().writes, 0)
})

function verificationFixture(options = {}) {
  const calls = []
  let now = 1000
  const fakeDate = class extends Date { static now() { return now } }
  const { createKugouApi: createApi } = load(mobile ? 'src/core/musicAccount/kugouApi.ts' : 'src/common/utils/kugouAccount.ts', {}, { Date: fakeDate })
  const api = createApi(async (url, init) => {
    const path = new URL(url).pathname
    calls.push({ url, init, path })
    let data
    if (path === '/v7/get_all_list') return { ok: true, status: 200, headers: { get: () => options.missingEvent ? null : 'private-event-id' }, json: async () => ({ status: 0, error_code: 20028 }) }
    if (path.endsWith('get_verify_info')) data = { v_type: options.type ?? 23, txappid: '123456789', url: 'KGCodeTX' }
    else data = {}
    return { ok: true, status: 200, json: async () => ({ status: options.failed && path.endsWith('verify_user_info') ? 0 : 1, error_code: options.failed && path.endsWith('verify_user_info') ? 123 : 0, data }) }
  }, md5, async () => ({ pk: 'rsa', params: 'aes' }))
  return { api, calls, expire: () => { now += 300001 } }
}

test('官方验证码事件留在宿主，页面只接收appid，验证票据交回酷狗且绑定当前设备', async () => {
  const f = verificationFixture()
  await assert.rejects(f.api.getPlaylists(session), /verification_required/)
  await f.api.verifySession(session, async appId => {
    assert.equal(appId, '123456789')
    return { ticket: 'captcha-ticket', randstr: 'captcha-random' }
  }, async () => {})
  assert.deepEqual(f.calls.map(x => x.path), ['/v7/get_all_list', '/verifyservice/v3/get_verify_info', '/v4/verify_user_info'])
  const { url, init } = f.calls[2], body = JSON.parse(init.body)
  assert.equal(new URL(url).origin, 'https://verifyservice.kugou.com')
  assert.equal(new URL(url).searchParams.get('clientver'), '11510')
  assert.equal(body.eventid, 'private-event-id')
  assert.equal(body.verifycode, 'KGCodeTX|{"ticket":"captcha-ticket","randstr":"captcha-random","txappid":"123456789"}')
  assert.equal(init.headers.mid, session.mid)
  assert.equal(body.pk, 'rsa')
  await assert.rejects(f.api.verifySession(session, async () => { throw Error('must not reopen') }, async () => {}), /verification_expired/)
})

test('验证过期、取消、换账号、缺事件、短信验证均不提交验证码或收藏', async () => {
  for (const mode of ['expired', 'cancelled', 'changed', 'missing', 'sms', 'invalid', 'during']) {
    const f = verificationFixture({ missingEvent: mode === 'missing', type: mode === 'sms' ? 32 : 23 })
    await assert.rejects(f.api.getPlaylists(session), /verification_required/)
    if (mode === 'expired') f.expire()
    const current = mode === 'changed' ? { ...session, token: 'new-token' } : session
    let changed = false
    await assert.rejects(f.api.verifySession(current, async () => {
      if (mode === 'cancelled') throw Error('verification_cancelled')
      if (mode === 'during') changed = true
      return { ticket: '', randstr: '' }
    }, async () => { if (changed) throw Error('account_changed') }))
    assert.equal(f.calls.some(x => x.path.endsWith('verify_user_info')), false)
  }
})

test('验证页面不注入账号，不接受畸形票据或任意appid脚本', () => {
  const helper = load(mobile ? 'src/utils/kugouVerification.ts' : 'src/common/utils/kugouVerification.ts')
  assert.throws(() => helper.createKugouCaptchaHtml("1234';alert(1)"))
  const html = helper.createKugouCaptchaHtml('123456789')
  assert.ok(html.includes('https://turing.captcha.qcloud.com/TCaptcha.js'))
  for (const secret of [session.token, 'private-event-id', session.mid]) assert.ok(!html.includes(secret))
  for (const input of ['{}', '{', JSON.stringify({ ret: 0, ticket: 'a', randstr: '' }), JSON.stringify({ ret: 2, ticket: 'a', randstr: 'b' })]) assert.equal(helper.parseKugouCaptchaMessage(input), null)
  assert.equal(helper.parseKugouCaptchaMessage('{"ret":0,"ticket":"a","randstr":"b"}').ticket, 'a')
})

test('两端安全验证 AES/RSA 与公开协议一致，包含右侧补零和十六进制输出', async () => {
  const crypto = require('node:crypto')
  const helper = load(mobile ? 'src/utils/kugouVerification.ts' : 'src/common/utils/kugouVerification.ts')
  const key = '1234567890abcdef', aesKey = md5(key)
  const pad = Buffer.alloc(128); pad.write(JSON.stringify({ key }))
  const rsa = crypto.publicEncrypt({ key: helper.KUGOU_VERIFY_PUBLIC_KEY, padding: crypto.constants.RSA_NO_PADDING }, pad).toString('hex')
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(aesKey), Buffer.from(aesKey.slice(-16)))
  const aes = Buffer.concat([cipher.update('{}'), cipher.final()]).toString('hex')
  const native = {
    RSA_PADDING: { NoPadding: 'RSA/ECB/NoPadding' }, AES_MODE: { CBC_128_PKCS7Padding: 'AES/CBC/PKCS7Padding' },
    rsaEncrypt: async (text, publicKey, padding) => {
      assert.equal(padding, 'RSA/ECB/NoPadding'); assert.equal(Buffer.from(text, 'base64').toString('hex'), pad.toString('hex'))
      return crypto.publicEncrypt({ key: publicKey, padding: crypto.constants.RSA_NO_PADDING }, Buffer.from(text, 'base64')).toString('base64')
    },
    aesEncrypt: async (text, k, iv, mode) => {
      assert.equal(mode, 'AES/CBC/PKCS7Padding')
      const c = crypto.createCipheriv('aes-256-cbc', Buffer.from(k, 'base64'), Buffer.from(iv, 'base64'))
      return Buffer.concat([c.update(Buffer.from(text, 'base64')), c.final()]).toString('base64')
    },
  }
  const file = mobile ? 'src/core/musicAccount/kugouVerification.ts' : 'src/main/modules/winMain/kugouVerification.ts'
  const module = load(file, mobile ? {
    buffer: { Buffer }, 'react-native': { NativeModules: { CryptoModule: { verificationNonce: async () => Buffer.from(key, 'hex').toString('base64') } } },
    '@/utils/musicSdk/utils': { toMD5: md5 }, '@/utils/nativeModules/crypto': native, '@/utils/kugouVerification': helper,
  } : { electron: {}, 'node:crypto': { ...crypto, randomBytes: () => Buffer.from(key, 'hex') }, '@common/utils/kugouVerification': helper }, { Buffer })
  const result = await module.encryptKugouVerification()
  assert.equal(result.pk, rsa)
  assert.equal(result.params, aes)
})
test('无效歌曲不访问账号，大小写 hash 与并发操作合并', async () => {
  for (const invalid of [{ ...song, hash: 'bad' }, { ...song, name: '' }, { ...song, action: 'delete' }, { ...song, albumId: '1&token=x' }]) {
    const f = fixture()
    assert.equal((await f.client(invalid)).status, 'unsupported')
    assert.equal(f.counts().reads, 0)
  }
  const f = fixture()
  const results = await Promise.all([f.client(song), f.client({ ...song, hash: song.hash.toLowerCase() })])
  assert.ok(results.every(r => r.status === 'added'))
  assert.equal(f.counts().writes, 1)
})
test('酷狗喜欢歌单按 is_def 和创建者识别，不把默认收藏或他人列表当目标', async () => {
  const api = createKugouApi(async () => ({ ok: true, status: 200, json: async () => ({ status: 1, data: { info: [
    { listid: 1, is_def: 1, name: '我喜欢', list_create_userid: '123' },
    { listid: 2, is_def: 2, name: '重命名', list_create_userid: '123' },
    { listid: 3, is_def: 2, list_create_userid: '999' },
    { listid: 4, is_def: 2, list_create_userid: '123', is_del: 1 },
  ] } }) }), md5)
  const lists = await api.getPlaylists(session)
  assert.equal(lists.filter(l => l.isFavorite).map(l => l.id).join(','), '2')
})
test('酷狗写入使用官方网关、完整签名、当前凭证和单首追加，不把 audio_id 当 mixsongid', async () => {
  const api = createKugouApi(async (url, init) => {
    const u = new URL(url), body = JSON.parse(init.body)
    assert.equal(u.origin, 'https://gateway.kugou.com')
    assert.equal(u.pathname, '/cloudlist.service/v6/add_song')
    assert.equal(u.searchParams.get('token'), session.token)
    assert.equal(body.token, session.token)
    assert.equal(body.listid, '2')
    assert.equal(body.type, 0)
    assert.equal(body.data.length, 1)
    assert.equal(body.data[0].hash, song.hash)
    assert.equal(body.data[0].album_id, 456)
    assert.equal(body.data[0].mixsongid, 0)
    assert.equal(init.headers['x-router'], undefined)
    const sig = u.searchParams.get('signature'); u.searchParams.delete('signature')
    const query = [...u.searchParams].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('')
    const salt = 'OIlwieks28dk2k092lksi2UIkp'
    assert.equal(sig, md5(salt + query + init.body + salt))
    return { ok: true, status: 200, json: async () => ({ status: 1, error_code: 0 }) }
  }, md5)
  await api.addFavoriteSong(session, '2', song)
})
test('写入错误码保留，网络异常不泄露凭证', async () => {
  const api = createKugouApi(async () => ({ ok: true, status: 200, json: async () => ({ status: 0, error_code: 12345 }) }), md5)
  await assert.rejects(api.addFavoriteSong(session, '2', song), e => e.code === 12345)
  const network = createKugouApi(async () => { throw Error('failed token=' + session.token) }, md5)
  await assert.rejects(network.addFavoriteSong(session, '2', song), e => e.message === 'unavailable')
})


test('账号安全验证入口可独立使用，无风控时只读检查，不打开验证码或写入歌曲', async () => {
  const paths = []
  const api = createKugouApi(async url => {
    paths.push(new URL(url).pathname)
    return { ok: true, status: 200, json: async () => ({ status: 1, error_code: 0, data: { info: [], count: 0 } }) }
  }, md5)
  await api.verifyAccess(session, async () => { throw Error('must not open captcha') }, async () => {})
  assert.deepEqual(paths, ['/v7/get_all_list'])
})

test('独立验证会刷新过期事件，取消或缺少事件明确失败，始终不提交收藏', async () => {
  for (const expired of [false, true]) {
    const f = verificationFixture()
    if (expired) { await assert.rejects(f.api.getPlaylists(session)); f.expire() }
    await assert.rejects(f.api.verifyAccess(session, async () => { throw Error('verification_cancelled') }, async () => {}), /verification_cancelled/)
    assert.equal(f.calls.filter(x => x.path === '/v7/get_all_list').length, expired ? 2 : 1)
    assert.equal(f.calls.some(x => x.path.endsWith('verify_user_info')), false)
  }
  const missing = verificationFixture({ missingEvent: true })
  await assert.rejects(missing.api.verifyAccess(session, async () => { throw Error('must not open') }, async () => {}), /verification_unsupported/)
})

test('验证码完成后仍被风控拦截不能误报访问恢复', async () => {
  const f = verificationFixture()
  await assert.rejects(f.api.verifyAccess(session, async () => ({ ticket: 'ticket', randstr: 'random' }), async () => {}), /verification_required/)
  assert.deepEqual(f.calls.map(x => x.path), ['/v7/get_all_list', '/verifyservice/v3/get_verify_info', '/v4/verify_user_info', '/v7/get_all_list'])
})
