const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
function load(file, globals) {
  const context = { exports: {}, ...globals }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/core/musicAccount', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, context)
  return context.exports
}
let rawCookie = ''
const cookies = load('cookies.ts', { require: () => ({ NativeModules: { UtilsModule: { getWebCookie: async () => rawCookie } } }) })
for (const identifier of ['uin', 'qqmusic_uin', 'musicid']) {
  for (const key of ['qm_keyst', 'qqmusic_key', 'musickey']) {
    const fixture = { [identifier]: 'o00123456', [key]: 'fixture-token' }
    assert.equal(cookies.isQQLoginCookieValid(fixture), true)
    assert.deepEqual({ ...cookies.getQQCredentials(fixture) }, { uin: '123456', authst: 'fixture-token' })
  }
}
for (const fixture of [{}, { uin: '123456', skey: 'qq-only' }, { uin: '0', qm_keyst: 'fixture' }, { qqmusic_uin: 'abc', qqmusic_key: 'fixture' }, { uin: '123456', qqmusic_key: ' ' }]) {
  assert.equal(cookies.isQQLoginCookieValid(fixture), false)
}
let requestBody
const qq = load('qq.ts', {
  require: () => cookies, AbortController, setTimeout, clearTimeout,
  fetch: async (_url, request) => {
    requestBody = JSON.parse(request.body)
    return { ok: true, json: async () => ({ code: 0, url: { code: 0, data: { sip: ['https://audio.example.test/'], midurlinfo: [{ filename: requestBody.url.param.filename[0], purl: 'fixture.mp3' }] } } }) }
  },
})
async function main() {
  rawCookie = 'qqmusic_uin=o00123456; qqmusic_key=fixture-token'
  assert.equal(await qq.hasQQLoginCookie(), true)
  const result = await qq.getQQOfficialMusicUrl('song-fixture', 'media-fixture', '128k')
  assert.equal(requestBody.comm.uin, '123456')
  assert.equal(requestBody.comm.authst, 'fixture-token')
  assert.equal(result.url, 'https://audio.example.test/fixture.mp3')
  console.log('PASS: QQ cookie aliases, account normalization, false-positive rejection and playback credential consistency (mock transport)')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
