const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.join(__dirname, '..')
const mobile = fs.existsSync(path.join(root, 'src/utils/userApiFallback.ts'))
const source = mobile ? 'src/utils/userApiFallback.ts' : 'src/common/utils/userApiFallback.ts'
const sandbox = { exports: {}, setTimeout, clearTimeout, AbortController, Date, Promise }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, source), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, sandbox)
const { getUserApiProviderIds, resolveUserApiFallback, USER_API_CANCELLED } = sandbox.exports
const primary = 'user_api_primary', backup = 'user_api_backup', unused = 'user_api_unused'
const info = (id, qualitys = ['128k']) => ({ id, name: id, sources: { tx: { type: 'music', actions: ['musicUrl'], qualitys } } })
const flush = async() => { for (let i = 0; i < 30; i++) await Promise.resolve() }
const deferred = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej }); return { promise, resolve, reject } }
const harness = (overrides = {}) => {
  const calls = []
  const options = {
    providers: [primary, backup], source: 'tx', quality: '128k', timeoutMs: 20, budgetMs: 400,
    getInfo: async id => { calls.push(`init:${id}`); return info(id) },
    request: (id, quality) => {
      calls.push(`request:${id}:${quality}`)
      return { promise: id === primary ? Promise.reject(Error('unavailable')) : Promise.resolve('https://music.example/backup.mp3') }
    },
    ...overrides,
  }
  return { calls, run: () => resolveUserApiFallback(options), options }
}

test('only explicitly selected existing providers are used, primary first and deduplicated', () => {
  assert.deepEqual(Array.from(getUserApiProviderIds(primary, [backup, primary, backup, 'deleted'], [{ id: primary }, { id: backup }, { id: unused }])), [primary, backup])
  assert.deepEqual(Array.from(getUserApiProviderIds('temp', [backup], [{ id: backup }])), [])
})
test('primary success never initializes a backup', async() => {
  const h = harness({ request: () => ({ promise: Promise.resolve('https://music.example/primary.mp3') }) })
  const result = await h.run()
  assert.equal(result.providerId, primary)
  assert.equal(result.isFromCache, false)
  assert.deepEqual(h.calls, [`init:${primary}`])
})

test('primary-only and backup-only phases never promote or duplicate the primary source', () => {
  const imported = [{ id: primary }, { id: backup }]
  assert.deepEqual(Array.from(getUserApiProviderIds(primary, [backup, primary], imported, 'primary')), [primary])
  assert.deepEqual(Array.from(getUserApiProviderIds(primary, [backup, primary], imported, 'backup')), [backup])
  assert.deepEqual(Array.from(getUserApiProviderIds('user_api_deleted', [backup], imported, 'primary')), [])
})

test('an expired cached URL is skipped and refreshed on the primary before any backup', async() => {
  const h = harness({
    excludedUrls: new Set(['https://music.example/expired.mp3']),
    readCache: async() => 'https://music.example/expired.mp3',
    request: () => ({ promise: Promise.resolve('https://music.example/fresh.mp3') }),
  })
  const result = await h.run()
  assert.equal(result.url, 'https://music.example/fresh.mp3')
  assert.equal(result.providerId, primary)
  assert.deepEqual(h.calls, [`init:${primary}`])
})
test('failed primary falls back in order and reports the actual provider', async() => {
  const h = harness()
  const result = await h.run()
  assert.equal(result.providerId, backup)
  assert.equal(result.providerName, backup)
  assert.deepEqual(h.calls, [`init:${primary}`, `request:${primary}:128k`, `init:${backup}`, `request:${backup}:128k`])
})
test('QQ, NetEase and Kugou each fall back without changing the song platform', async() => {
  for (const source of ['tx', 'wy', 'kg']) {
    const requests = []
    const h = harness({ source, getInfo: async id => ({ id, name: id, sources: { [source]: { type: 'music', actions: ['musicUrl'], qualitys: ['128k'] } } }),
      request: id => { requests.push(id); return { promise: id === primary ? Promise.reject(Error('network error')) : Promise.resolve('https://music.example/backup.mp3') } },
    })
    assert.equal((await h.run()).providerId, backup)
    assert.deepEqual(requests, [primary, backup])
  }
})

test('a primary init failure does not block a healthy backup', async() => {
  const h = harness({ getInfo: async id => { if (id === primary) throw Error('source init failed'); return info(id) } })
  assert.equal((await h.run()).providerId, backup)
})
test('unsupported platform and quality are skipped without sending a request', async() => {
  const h = harness({ quality: '320k', getInfo: async id => id === primary ? { id, sources: {} } : info(id, ['128k']) })
  const result = await h.run()
  assert.equal(result.quality, '128k')
  assert.deepEqual(h.calls, [`request:${backup}:128k`])
})
test('try a lower declared quality on the primary before changing scripts', async() => {
  const calls = []
  const h = harness({ quality: 'flac', getInfo: async id => info(id, ['flac', '128k']), request: (id, quality) => {
    calls.push([id, quality])
    return { promise: quality === 'flac' ? Promise.reject(Error('quality unavailable')) : Promise.resolve('https://music.example/standard.mp3') }
  } })
  assert.equal((await h.run()).providerId, primary)
  assert.deepEqual(calls, [[primary, 'flac'], [primary, '128k']])
})
test('timeout cancels the stalled request and proceeds to backup', async() => {
  let cancelled = 0
  const h = harness({ request: id => id === primary
    ? { promise: new Promise(() => {}), cancel: () => { cancelled++ } }
    : { promise: Promise.resolve('https://music.example/backup.mp3') } })
  assert.equal((await h.run()).providerId, backup)
  assert.equal(cancelled, 1)
})
test('timeout still falls back when cancelling rejects the pending operation', async() => {
  const pending = deferred()
  let cancelled = 0
  const h = harness({ request: id => id === primary
    ? { promise: pending.promise, cancel: () => { cancelled++; pending.reject(Error(USER_API_CANCELLED)) } }
    : { promise: Promise.resolve('https://music.example/backup.mp3') } })
  assert.equal((await h.run()).providerId, backup)
  assert.equal(cancelled, 1)
})

test('invalid and previously failed URLs fall through to the next script', async() => {
  for (const failedUrl of ['', 'javascript:alert(1)', 'https://music.example/bad.mp3']) {
    const h = harness({ excludedUrls: new Set(['https://music.example/bad.mp3']), request: id => ({ promise: Promise.resolve(id === primary ? failedUrl : 'https://music.example/good.mp3') }) })
    assert.equal((await h.run()).providerId, backup)
  }
})
test('already cancelled requests execute no scripts', async() => {
  const controller = new AbortController()
  controller.abort()
  const h = harness({ signal: controller.signal })
  await assert.rejects(h.run(), { message: USER_API_CANCELLED })
  assert.deepEqual(h.calls, [])
})
test('cancelling one concurrent request does not affect the other or start its backup', async() => {
  const controller = new AbortController()
  const pending = deferred()
  let cancelled = 0
  const first = harness({ signal: controller.signal, request: () => ({ promise: pending.promise, cancel: () => { cancelled++ } }) })
  const result = first.run()
  await flush()
  controller.abort()
  await assert.rejects(result, { message: USER_API_CANCELLED })
  pending.resolve('https://music.example/stale.mp3')
  const second = harness()
  assert.equal((await second.run()).providerId, backup)
  assert.ok(cancelled >= 1)
  assert.deepEqual(first.calls, [`init:${primary}`])
})
test('switching settings or deleting a source stops the old fallback chain', async() => {
  const pending = deferred()
  let current = true
  const h = harness({ isCurrent: () => current, request: () => ({ promise: pending.promise }) })
  const result = h.run()
  await flush()
  current = false
  pending.reject(Error('source removed'))
  await assert.rejects(result, { message: USER_API_CANCELLED })
  assert.deepEqual(h.calls, [`init:${primary}`])
})
test('cache lookup is scoped to its provider and cannot revive a disabled source', async() => {
  const reads = []
  const h = harness({ readCache: async(id, quality) => { reads.push([id, quality]); return id === backup ? 'https://music.example/cached.mp3' : '' } })
  const result = await h.run()
  assert.equal(result.providerId, backup)
  assert.equal(result.isFromCache, true)
  assert.deepEqual(reads, [[primary, '128k'], [backup, '128k']])
  assert.ok(!h.calls.includes(`init:${backup}`))
})
test('excluded routes and blocked providers are not retried', async() => {
  const h = harness({ isProviderBlocked: id => id === primary })
  assert.equal((await h.run()).providerId, backup)
  assert.ok(!h.calls.includes(`init:${primary}`))
  const other = harness({ isExcluded: (id, quality, cached) => !cached && id === primary })
  assert.equal((await other.run()).providerId, backup)
  assert.ok(!other.calls.includes(`request:${primary}:128k`))
})
test('total request budget bounds a long chain of unavailable scripts', async() => {
  const calls = []
  const h = harness({ providers: Array.from({ length: 20 }, (_, i) => `user_api_${i}`), budgetMs: 35,
    getInfo: async id => info(id), request: id => { calls.push(id); return { promise: new Promise(() => {}) } },
  })
  await assert.rejects(h.run(), /timeout/)
  assert.ok(calls.length <= 3)
})
test('backup selection survives setting updates and reloads, invalid data is rejected', () => {
  const file = mobile ? 'src/config/setting.ts' : 'src/main/utils/index.ts'
  const text = fs.readFileSync(path.join(root, file), 'utf8')
  const start = text.indexOf('const primitiveType =')
  const mergeStart = text.indexOf('export const mergeSetting =', start) >= 0 ? text.indexOf('export const mergeSetting =', start) : text.indexOf('const mergeSetting =', start)
  const end = text.indexOf('export const updateSetting', mergeStart)
  const excerpt = text.slice(start, end).replace(/export /g, '') + '\nexports.mergeSetting = mergeSetting'
  const ctx = { exports: {} }
  vm.runInNewContext(ts.transpileModule(excerpt, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, ctx)
  const defaults = { version: '1', 'common.apiSource': primary, 'common.apiBackupSources': [] }
  const saved = ctx.exports.mergeSetting(defaults, { 'common.apiBackupSources': [backup] }).setting
  assert.deepEqual(Array.from(saved['common.apiBackupSources']), [backup])
  const loaded = ctx.exports.mergeSetting(defaults, JSON.parse(JSON.stringify(saved))).setting
  assert.deepEqual(Array.from(loaded['common.apiBackupSources']), [backup])
  for (const bad of [null, 1, {}, ['not_a_script'], [42]]) {
    assert.deepEqual(Array.from(ctx.exports.mergeSetting(defaults, { 'common.apiBackupSources': bad }).setting['common.apiBackupSources']), [])
  }
})
