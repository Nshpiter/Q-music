const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.join(__dirname, '..')
const mobile = fs.existsSync(path.join(root, 'src/utils/userApiImport.ts'))
const source = mobile ? 'src/utils/userApiImport.ts' : 'src/common/utils/userApiImport.ts'
const sandbox = { exports: {}, Promise, Error }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, source), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, sandbox)
const { createUserApiImporter } = sandbox.exports
const script = '/** @name fixture */'
const deferred = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej }); return { promise, resolve, reject } }

test('accepts a successful script response and trims pasted links', async() => {
  const calls = []
  const importer = createUserApiImporter(url => { calls.push(url); return { promise: Promise.resolve({ statusCode: 200, body: script }) } })
  assert.equal(await importer.load('  HTTPS://example.test/source.js  '), script)
  assert.deepEqual(calls, ['HTTPS://example.test/source.js'])
})

test('invalid addresses never send requests', async() => {
  const importer = createUserApiImporter(() => { throw Error('must not request') })
  for (const url of ['', 'file:///test.js', 'javascript:alert(1)', 'https://', 'https://bad host/source']) {
    await assert.rejects(importer.load(url), /Invalid HTTP/)
  }
})

test('HTTP errors and non-text responses cannot be imported', async() => {
  for (const [statusCode, body, message] of [[403, script, /HTTP 403/], [404, script, /HTTP 404/], [500, script, /HTTP 500/],
    [200, null, /Invalid script/], [200, { error: 'denied' }, /Invalid script/], [204, '', /Invalid script/], [200, ' '.repeat(4), /Invalid script/],
    [200, 'x'.repeat(9_000_001), /Too large/]]) {
    const importer = createUserApiImporter(() => ({ promise: Promise.resolve({ statusCode, body }) }))
    await assert.rejects(importer.load('https://example.test/source'), message)
  }
})

test('repeated submissions share one pending operation instead of importing twice', async() => {
  const pending = deferred()
  let requests = 0
  const importer = createUserApiImporter(() => { requests++; return { promise: pending.promise } })
  const first = importer.load('https://example.test/first')
  assert.equal(await importer.load('https://example.test/second'), null)
  pending.resolve({ statusCode: 200, body: script })
  assert.equal(await first, script)
  assert.equal(requests, 1)
})

test('closing cancels the request and suppresses the cancellation error', async() => {
  const pending = deferred()
  let cancelled = 0
  const importer = createUserApiImporter(() => ({ promise: pending.promise, cancelHttp() { cancelled++; pending.reject(Error('Aborted')) } }))
  const first = importer.load('https://example.test/first')
  importer.cancel()
  importer.cancel()
  assert.equal(await first, null)
  assert.equal(cancelled, 1)
})

test('late results after closing cannot import or cancel the next operation', async() => {
  for (const fail of [false, true]) {
    const requests = [deferred(), deferred()]
    let count = 0
    const importer = createUserApiImporter(() => ({ promise: requests[count++].promise }))
    const first = importer.load('https://example.test/first')
    importer.cancel()
    const second = importer.load('https://example.test/second')
    if (fail) requests[0].reject(Error('offline'))
    else requests[0].resolve({ statusCode: 200, body: 'old script' })
    assert.equal(await first, null)
    assert.equal(await importer.load('https://example.test/duplicate'), null)
    requests[1].resolve({ statusCode: 200, body: script })
    assert.equal(await second, script)
    assert.equal(count, 2)
  }
})

test('network failure releases the operation for retry', async() => {
  let attempts = 0
  const importer = createUserApiImporter(() => ({ promise: ++attempts === 1 ? Promise.reject(Error('offline')) : Promise.resolve({ statusCode: 200, body: script }) }))
  await assert.rejects(importer.load('https://example.test/source'), /offline/)
  assert.equal(await importer.load('https://example.test/source'), script)
})
