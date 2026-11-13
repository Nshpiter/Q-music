const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.join(__dirname, '..')
const mobile = fs.existsSync(path.join(root, 'src/utils/playbackPolicy.ts'))
function load(file, deps = {}) {
  const context = { exports: {}, Error, Number, Date, console: { warn() {} }, require: id => {
    if (!(id in deps)) throw Error(id)
    return deps[id]
  } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, context)
  return context.exports
}
const policy = load(mobile ? 'src/utils/playbackPolicy.ts' : 'src/common/utils/playbackPolicy.ts')

test('平台顺序去重、过滤未知值并补齐，候选原数组不被修改', () => {
  assert.deepEqual(Array.from(policy.fallbackPlatformOrder('kg,kg,invalid,tx')), ['kg', 'tx', 'wy', 'kw', 'mg'])
  const items = Object.freeze([{ source: 'wy', id: 1 }, { source: 'kg', id: 2 }, { source: 'kg', id: 3 }])
  assert.deepEqual(Array.from(policy.orderFallbackCandidates(items, 'kg,wy'), item => item.id), [2, 3, 1])
  assert.equal(items[0].id, 1)
})

test('网易云响应音质以实际档位或码率为准，未知信息不冒充 Hi-Res', () => {
  assert.equal(policy.neteasePlaybackQuality('standard', 128000), '128k')
  assert.equal(policy.neteasePlaybackQuality('hires', 2400000), 'flac24bit')
  assert.equal(policy.neteasePlaybackQuality(undefined, 320000), '320k')
  assert.equal(policy.neteasePlaybackQuality(undefined, undefined), null)
})

test('禁用降档只试原档位；取消取址后不再启动平台搜索', async() => {
  let searches = 0, requests = 0
  const controller = new AbortController()
  await assert.rejects(policy.resolveQualityFirst({
    quality: 'flac', downgrade: false, signal: controller.signal, cancelledMessage: 'cancelled',
    original: async() => { requests++; controller.abort(); throw Error('failed') },
    alternatives: async() => { searches++; return [] },
    fallback: async() => { throw Error('should not reach') },
  }), /cancelled/)
  assert.equal(searches, 0)
  assert.equal(requests, 1)
  assert.deepEqual(Array.from(policy.playbackQualitySteps('flac', false)), ['flac'])
})

if (mobile) test('官方返回低音质不会污染严格音质缓存；严格请求不再隐藏降档', async() => {
  const calls = []
  const api = load('src/core/music/official.ts', {
    '@/utils/playbackPolicy': policy,
    '@/utils/request': { httpFetch: (url, options) => {
      calls.push(options.form.level)
      return { promise: Promise.resolve({ body: { code: 200, data: [{ code: 200, url: 'https://audio.test/low.mp3', level: 'standard', br: 128000 }] } }) }
    } },
    '@/utils/musicSdk/wy/utils/crypto': { weapi: data => data },
    '@/core/musicAccount/cookies': { getProviderCookies: async() => ({}), isNeteaseLoginCookieValid: () => false },
    '@/core/musicAccount/qqCredentials': {},
  })
  const song = { id: 'wy_1', source: 'wy', meta: { songId: 1 } }
  assert.equal((await api.getOfficialMusicUrl(song, 'flac', false, true)).quality, '128k')
  assert.equal(await api.getOfficialMusicUrl(song, 'flac', false, false), null)
  assert.deepEqual(calls, ['lossless', 'lossless'])
  assert.equal((await api.getOfficialMusicUrl(song, '128k', false, false)).quality, '128k')
})
