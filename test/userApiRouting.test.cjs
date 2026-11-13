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
function harness({ primaryFails = true, officialAvailable = true, backups = ['user_api_backup'], signal, officialResponse, settings = {}, quality = '128k', allowToggleSource = false, requestUrl, alternatives = [] } = {}) {
  const calls = []
  const routes = []
  const setting = { 'common.apiSource': 'user_api_primary', 'common.apiBackupSources': backups, 'player.playQuality': '128k', 'player.autoQualityFallback': true, 'player.autoSourceFallback': true, ...settings }
  const song = { id: 'tx_test', source: 'tx', name: 'test', singer: 'artist', meta: {} }
  const fallback = load(mobile ? 'src/utils/userApiFallback.ts' : 'src/common/utils/userApiFallback.ts')
  const resolveCustomMusicUrl = async(info, quality, options, mobileSignal, mobileScope, allowQualityFallback) => {
    const scope = mobile ? mobileScope : options.providerScope
    const providers = scope === 'primary' ? ['user_api_primary'] : scope === 'backup' ? backups : ['user_api_primary', ...backups]
    return fallback.resolveUserApiFallback({
      ...(mobile ? { allowQualityFallback } : options), providers, source: info.source, quality, signal: mobile ? mobileSignal : options.signal,
      getInfo: async id => ({ id, name: id, sources: { [info.source]: { type: 'music', actions: ['musicUrl'], qualitys: ['flac', '320k', '128k'] } } }),
      request: (id, type) => {
        calls.push(id)
        routes.push(`${info.source}:${id}:${type}`)
        if (requestUrl) return { promise: requestUrl(info.source, type, id) }
        return { promise: id === 'user_api_primary' && primaryFails ? Promise.reject(Error('unavailable')) : Promise.resolve(`https://audio.test/${id}.mp3`) }
      },
    })
  }
  const official = async(...args) => {
    calls.push('official')
    if (officialResponse) return officialResponse(...args)
    return officialAvailable ? { status: 'available', url: 'https://audio.test/official.mp3', quality: '128k' } : null
  }
  const requestMsg = { cancelRequest: 'Cancel request', tooManyRequests: '429', timeout: 'timeout', notConnectNetwork: 'offline', unachievable: 'unreachable' }
  const policy = load(mobile ? 'src/utils/playbackPolicy.ts' : 'src/common/utils/playbackPolicy.ts')
  const sdk = { findMusic: async() => { calls.push('search'); return alternatives } }
  const deps = mobile ? {
    '@/utils/playbackPolicy': policy,
    './userApiFallback': { resolveCustomMusicUrl }, '@/utils/musicSdk': sdk, '@/utils/data': {},
    '@/utils': { toNewMusicInfo: info => info }, '@/utils/tools': {}, '@/store/setting/state': { setting },
    '@/utils/message': { requestMsg }, 'react-native-background-timer': { setTimeout, clearTimeout }, '@/utils/musicSdk/api-source': {},
    './official': { getOfficialMusicUrl: official },
  } : {
    '@common/utils/playbackPolicy': policy,
    './userApiFallback': { resolveCustomMusicUrl }, '@renderer/store': { apiSource: { value: 'user_api_primary' } },
    '@renderer/store/utils': {}, '@renderer/utils/musicSdk': sdk, '@renderer/utils/ipc': { getMusicAccountMusicUrl: official, getMusicUrl: async() => null },
    '@renderer/store/setting': { appSetting: setting }, '@renderer/utils': { toNewMusicInfo: info => info }, '@renderer/utils/message': { requestMsg }, '@renderer/utils/musicSdk/api-source': {},
  }
  const api = load(mobile ? 'src/core/music/utils.ts' : 'src/renderer/core/music/utils.ts', deps, { window: { i18n: { t: key => key } }, global: { i18n: { t: key => key } } })
  return { calls, routes,
    run: () => api.handleGetOnlineMusicUrl({ musicInfo: song, quality, isRefresh: true, allowToggleSource, onToggleSource() {}, signal, requestOptions: { signal } }),
    alternate: () => api.getOnlineOtherSourceMusicUrl({ musicInfos: alternatives.length ? alternatives : [song], quality, isRefresh: true, onToggleSource() {}, signal, requestOptions: { signal } }),
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

const availableAt = async(source, quality) => {
  if ((source === 'tx' && quality === '128k') || (source === 'wy' && quality === 'flac')) return `https://audio.test/${source}-${quality}.mp3`
  throw Error('unavailable')
}
const other = ['kg', 'wy'].map(source => ({ id: `${source}_test`, source, meta: {} }))

test('优先当前平台先降档，优先音质先跨平台，候选搜索只执行一次', async() => {
  for (const order of ['source', 'quality']) {
    const h = harness({ quality: 'flac', allowToggleSource: true, officialAvailable: false, backups: [], alternatives: other, requestUrl: availableAt,
      settings: { 'player.fallbackOrder': order, 'player.fallbackPlatforms': 'wy,kg' },
    })
    const result = await h.run()
    assert.equal(result.musicInfo.source, order === 'source' ? 'tx' : 'wy')
    assert.equal(result.quality, order === 'source' ? '128k' : 'flac')
    assert.equal(h.calls.filter(call => call === 'search').length, order === 'source' ? 0 : 1)
    if (order === 'quality') assert.deepEqual(h.routes, ['tx:user_api_primary:flac', 'wy:user_api_primary:flac'])
  }
})

test('关闭降档时脚本不请求低音质；关闭跨平台时不发搜索请求', async() => {
  const h = harness({ quality: 'flac', allowToggleSource: true, officialAvailable: false, backups: [], alternatives: other, requestUrl: availableAt,
    settings: { 'player.autoQualityFallback': false, 'player.autoSourceFallback': false, 'player.fallbackOrder': 'quality' },
  })
  await assert.rejects(h.run())
  assert.deepEqual(h.routes, ['tx:user_api_primary:flac'])
  assert.ok(!h.calls.includes('search'))
})

test('优先音质允许逐档回退，但每档仍先主源、官方、备用', async() => {
  const h = harness({ quality: '320k', allowToggleSource: true, officialAvailable: false, alternatives: [], requestUrl: availableAt,
    settings: { 'player.fallbackOrder': 'quality' },
  })
  const result = await h.run()
  assert.equal(result.quality, '128k')
  assert.deepEqual(h.calls.slice(0, 4), ['user_api_primary', 'official', 'user_api_backup', 'search'])
  assert.equal(h.calls.filter(call => call === 'search').length, 1)
})

test('平台优先级包含该平台的官方兜底，不能被较低优先级的平台抢占', async() => {
  const h = harness({ alternatives: other, backups: [], settings: { 'player.fallbackPlatforms': 'wy,kg' },
    requestUrl: async source => { if (source === 'kg') return 'https://audio.test/kg.mp3'; throw Error('failed') },
    officialResponse: async info => info.source === 'wy' ? { status: 'available', url: 'https://audio.test/wy.mp3', quality: '128k' } : null,
  })
  assert.equal((await h.alternate()).musicInfo.source, 'wy')
  assert.deepEqual(h.routes, ['wy:user_api_primary:128k'])
})

test('优先音质把精确档位参数传入官方接口', async() => {
  const requested = []
  const h = harness({ quality: '320k', allowToggleSource: true, backups: [],
    settings: { 'player.fallbackOrder': 'quality', 'player.autoQualityFallback': false },
    requestUrl: async() => { throw Error('failed') },
    officialResponse: async(info, quality, refresh, downgrade) => { requested.push({ quality, downgrade }); return null },
  })
  await assert.rejects(h.run())
  assert.deepEqual(requested, [{ quality: '320k', downgrade: false }])
})
