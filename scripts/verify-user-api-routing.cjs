const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.join(__dirname, '..')
const mobile = fs.existsSync(path.join(root, 'src/core/music/utils.ts'))
function load(file, dependencies = {}, globals = {}) {
  const context = { exports: {}, Error, URL, AbortController, setTimeout, clearTimeout, console: { log() {}, warn() {} }, ...globals,
    require: id => { if (!(id in dependencies)) throw Error('Missing dependency: ' + id); return dependencies[id] },
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, context)
  return context.exports
}
function harness({ primaryFails = true, officialAvailable = true, backups = ['user_api_backup'], signal, officialResponse } = {}) {
  const calls = []
  const setting = { 'common.apiSource': 'user_api_primary', 'common.apiBackupSources': backups, 'player.playQuality': '128k' }
  const song = { id: 'tx_test', source: 'tx', name: 'test', singer: 'artist', meta: {} }
  const fallback = load(mobile ? 'src/utils/userApiFallback.ts' : 'src/common/utils/userApiFallback.ts')
  const resolveCustomMusicUrl = async(info, quality, options, mobileSignal, mobileScope) => {
    const scope = mobile ? mobileScope : options.providerScope
    const providers = scope === 'primary' ? ['user_api_primary'] : scope === 'backup' ? backups : ['user_api_primary', ...backups]
    return fallback.resolveUserApiFallback({
      ...(mobile ? {} : options), providers, source: info.source, quality, signal: mobile ? mobileSignal : options.signal,
      getInfo: async id => ({ id, name: id, sources: { tx: { type: 'music', actions: ['musicUrl'], qualitys: ['128k'] } } }),
      request: id => {
        calls.push(id)
        return { promise: id === 'user_api_primary' && primaryFails ? Promise.reject(Error('unavailable')) : Promise.resolve(`https://audio.test/${id}.mp3`) }
      },
    })
  }
  const official = async() => {
    calls.push('official')
    if (officialResponse) return officialResponse()
    return officialAvailable ? { status: 'available', url: 'https://audio.test/official.mp3', quality: '128k' } : null
  }
  const requestMsg = { cancelRequest: 'Cancel request', tooManyRequests: '429', timeout: 'timeout', notConnectNetwork: 'offline', unachievable: 'unreachable' }
  const deps = mobile ? {
    './userApiFallback': { resolveCustomMusicUrl }, '@/utils/musicSdk': {}, '@/utils/data': {},
    '@/utils': {}, '@/utils/tools': {}, '@/store/setting/state': { setting },
    '@/utils/message': { requestMsg }, 'react-native-background-timer': {}, '@/utils/musicSdk/api-source': {},
    './official': { getOfficialMusicUrl: official },
  } : {
    './userApiFallback': { resolveCustomMusicUrl }, '@renderer/store': { apiSource: { value: 'user_api_primary' } },
    '@renderer/store/utils': {}, '@renderer/utils/musicSdk': {}, '@renderer/utils/ipc': { getMusicAccountMusicUrl: official, getMusicUrl: async() => null },
    '@renderer/store/setting': { appSetting: setting }, '@renderer/utils': {}, '@renderer/utils/message': { requestMsg }, '@renderer/utils/musicSdk/api-source': {},
  }
  const api = load(mobile ? 'src/core/music/utils.ts' : 'src/renderer/core/music/utils.ts', deps, { window: { i18n: { t: key => key } }, global: { i18n: { t: key => key } } })
  return { calls,
    run: () => api.handleGetOnlineMusicUrl({ musicInfo: song, quality: '128k', isRefresh: true, allowToggleSource: false, onToggleSource() {}, signal, requestOptions: { signal } }),
    alternate: () => api.getOnlineOtherSourceMusicUrl({ musicInfos: [song], quality: '128k', isRefresh: true, onToggleSource() {}, signal, requestOptions: { signal } }),
  }
}

test('启用备用源不改变原本可用的主源与官方兜底：失效备用 URL 不得抢在官方前面', async() => {
  for (const backups of [[], ['user_api_backup'], ['user_api_backup', 'user_api_second']]) {
    const h = harness({ backups })
    assert.equal((await h.run()).url, 'https://audio.test/official.mp3')
    assert.deepEqual(h.calls, ['user_api_primary', 'official'])
  }
})

test('主源成功不请求官方或备用；主源和官方均失败才尝试备用', async() => {
  const healthy = harness({ primaryFails: false })
  assert.equal((await healthy.run()).url, 'https://audio.test/user_api_primary.mp3')
  assert.deepEqual(healthy.calls, ['user_api_primary'])
  const fallback = harness({ officialAvailable: false })
  assert.equal((await fallback.run()).url, 'https://audio.test/user_api_backup.mp3')
  assert.deepEqual(fallback.calls, ['user_api_primary', 'official', 'user_api_backup'])
})

test('已取消的播放不能发出官方或备用请求', async() => {
  const controller = new AbortController()
  controller.abort()
  const h = harness({ signal: controller.signal })
  await assert.rejects(h.run(), /Cancel request/)
  assert.deepEqual(h.calls, [])
})

test('等待官方地址期间取消，迟到的结果不能恢复旧歌曲或启动备用源', async() => {
  for (const route of ['run', 'alternate']) {
    const controller = new AbortController()
    let started, release
    const ready = new Promise(resolve => { started = resolve })
    const pending = new Promise(resolve => { release = resolve })
    const h = harness({ signal: controller.signal, officialResponse: () => { started(); return pending } })
    const result = h[route]()
    await ready
    const rejected = assert.rejects(result, /Cancel request/)
    controller.abort()
    release({ status: 'available', url: 'https://audio.test/stale.mp3', quality: '128k' })
    await rejected
    assert.deepEqual(h.calls, ['user_api_primary', 'official'])
  }
})

test('跨平台候选也不会让备用脚本抢占可用的官方线路', async() => {
  const h = harness()
  assert.equal((await h.alternate()).url, 'https://audio.test/official.mp3')
  assert.deepEqual(h.calls, ['user_api_primary', 'official'])
})
