const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.join(__dirname, '..')
const context = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'src/utils/musicRecognition.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context)
const { parseRecognitionResults, parseKugouRecognitionResults, recognitionUrl, RecognitionSession } = context.exports

test('酷狗识曲保留服务候选顺序及平台，过滤重复和畸形项，服务错误不伪装无匹配', () => {
  const song = { mixsongid: 254394571, songname: 'My Soul', singername: 'July', album: [{ albumname: 'Time' }] }
  const result = parseKugouRecognitionResults({ status: 1, error_code: 0, data: [song, song, { ...song, mixsongid: 'bad' }, { ...song, mixsongid: 2, album: null }] })
  assert.equal(result.length, 2)
  assert.equal(result[0].source, 'kg')
  assert.equal(result[0].name, 'My Soul')
  assert.equal(result[1].album, '')
  assert.equal(parseKugouRecognitionResults({ status: 1, error_code: 0, data: [] }).length, 0)
  for (const body of [{}, { status: 0, error_code: 20028 }, { status: 1, error_code: 0, data: null }]) assert.throws(() => parseKugouRecognitionResults(body), /recognition_service_error/)
})

test('recognition preserves candidate order, deduplicates songs, and excludes malformed entries', () => {
  const song = { id: 5308028, name: ' My Soul ', artists: [{ name: 'July' }], album: { name: 'Time...' } }
  const result = parseRecognitionResults({ code: 200, data: { result: [{ song }, { song }, { song: { id: 'invalid', name: 'bad' } }, { song: { ...song, id: 2 } }] } })
  assert.deepEqual(JSON.parse(JSON.stringify(result)), [{ id: '5308028', name: 'My Soul', singer: 'July', album: 'Time...' }, { id: '2', name: 'My Soul', singer: 'July', album: 'Time...' }])
})

test('no match is distinct from service failure, and recognition requests include only validated fingerprints', () => {
  assert.equal(parseRecognitionResults({ code: 200, data: { result: null } }).length, 0)
  for (const body of [{ code: 403 }, { code: 200 }, { code: 200, data: {} }, { code: 200, data: { result: 'bad' } }]) assert.throws(() => parseRecognitionResults(body), /recognition_service_error/)
  const url = new URL(recognitionUrl('ab+c/def==', 6, 'test'))
  assert.equal(url.searchParams.get('rawdata'), 'ab+c/def==')
  assert.equal(url.searchParams.get('duration'), '6.000')
  for (const duration of [NaN, Infinity, 0, 2, 7, 8, 9]) assert.throws(() => recognitionUrl('abcd', duration, 'test'))
  assert.throws(() => recognitionUrl('bad&data', 6, 'test'))
})

test('cancelled permission, audio and network callbacks cannot overwrite a new recognition', () => {
  const session = new RecognitionSession()
  const first = session.begin()
  assert.equal(session.current(first), true)
  session.cancel()
  assert.equal(session.current(first), false)
  const second = session.begin()
  assert.equal(session.current(first), false)
  assert.equal(session.current(second), true)
})

test('bundled WASM and Android PCM bridge generate a fingerprint without network access', { timeout: 15000 }, async() => {
  const assets = path.join(root, 'android/app/src/main/assets/recognition')
  let resolveReady, resolveResult
  const ready = new Promise(resolve => { resolveReady = resolve })
  const result = new Promise(resolve => { resolveResult = resolve })
  const box = vm.createContext({ console: { info() {}, log() {}, warn() {} }, WebAssembly, TextEncoder, TextDecoder, atob, btoa, setTimeout, clearTimeout, setInterval, clearInterval })
  box.window = box
  box.ReactNativeWebView = { postMessage(text) { const data = JSON.parse(text); if (data.type === 'ready') resolveReady(); else resolveResult(data) } }
  for (const name of ['afp.wasm.js', 'afp.js', 'bridge.js']) vm.runInContext(fs.readFileSync(path.join(assets, name), 'utf8'), box)
  await ready
  const pcm = Buffer.alloc(8000 * 3 * 2)
  for (let i = 0; i < pcm.length / 2; i++) pcm.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 440 / 8000) * 12000), i * 2)
  box.fingerprint({ id: 7, pcm: pcm.toString('base64') })
  const data = await result
  assert.equal(data.type, 'fingerprint')
  assert.equal(data.id, 7)
  assert.ok(Buffer.from(data.value, 'base64').length > 0)
})
