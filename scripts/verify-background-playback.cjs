// 权限往返、播放器并发初始化、词幕时间轴的离线回归。加载真实源码，只替换系统边界。
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.join(__dirname, '..')
let checks = 0
const equal = (actual, expected, label) => { assert.equal(actual, expected, label); checks++ }
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve() }
function load(file, dependencies, globals = {}) {
  const context = { exports: {}, console, setTimeout, clearTimeout, ...globals,
    require: id => { if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`); return dependencies[id] },
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, context)
  return context.exports
}
function permissions(check, open) {
  const listeners = new Set()
  const timers = new Map()
  let now = 0
  let counter = 0
  let opens = 0
  const api = load('utils/nativeModules/permissionSettings.ts', {
    'react-native': { AppState: { addEventListener: (_, listener) => {
      listeners.add(listener)
      return { remove: () => listeners.delete(listener) }
    } } },
  }, {
    setTimeout: (callback, delay) => { const id = ++counter; timers.set(id, { callback, time: now + delay }); return id },
    clearTimeout: id => timers.delete(id),
  })
  return {
    request: api.createSettingsRequest(check, async () => { opens++; return open() }),
    emit: state => { for (const listener of listeners) listener(state) },
    async advance(ms) {
      const end = now + ms
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.time <= end).sort((a, b) => a[1].time - b[1].time)[0]
        if (!next) break
        now = next[1].time
        timers.delete(next[0])
        next[1].callback()
        await flush()
      }
      now = end
      await flush()
    },
    verifyClean() { equal(listeners.size, 0, '清理生命周期监听'); equal(timers.size, 0, '清理所有计时器') },
    opens: () => opens,
  }
}

async function permissionCases() {
  let granted = true
  let p = permissions(async () => granted, () => true)
  equal(await p.request(), 'enabled', '已授权立即返回，不依赖页面切换')
  equal(p.opens(), 0, '已授权不打开设置')
  p.verifyClean()

  granted = false
  p = permissions(async () => granted, () => true)
  const first = p.request()
  const second = p.request()
  await flush()
  equal(p.opens(), 1, '并发只打开一次设置')
  p.emit('active')
  p.emit('background')
  await p.advance(4000)
  let finished = false
  void first.then(() => { finished = true })
  await flush()
  equal(finished, false, '留在设置页不提前误判')
  p.emit('active')
  await p.advance(500)
  granted = true
  await p.advance(700)
  equal(await first, 'enabled', '延迟生效的权限也能识别')
  equal(await second, 'enabled', '并发请求得到相同结果')
  p.verifyClean()

  p = permissions(async () => false, () => true)
  const unconfirmed = p.request()
  await flush()
  p.emit('inactive'); p.emit('active')
  await p.advance(3000)
  equal(await unconfirmed, 'unconfirmed', '厂商设置不可检测时不声称用户拒绝')
  p.verifyClean()

  for (const open of [() => false, () => { throw new Error('activity missing') }]) {
    p = permissions(async () => false, open)
    equal(await p.request(), 'unavailable', '系统页面调用失败可完成')
    p.verifyClean()
  }
  p = permissions(async () => { throw new Error('check failed') }, () => true)
  equal(await p.request(), 'unavailable', '权限读取异常可完成')
  p.verifyClean()

  let calls = 0
  p = permissions(async () => { if (++calls > 1) throw new Error('read failed'); return false }, () => true)
  const failedRead = p.request()
  await flush(); p.emit('background'); p.emit('active'); await p.advance(400)
  equal(await failedRead, 'unavailable', '返回后的查询异常可恢复')
  p.verifyClean()

  p = permissions(async () => false, () => true)
  const noEvent = p.request()
  await flush(); await p.advance(5000)
  equal(await noEvent, 'unconfirmed', '系统无生命周期事件也不会无限挂起')
  p.verifyClean()

  p = permissions(async () => false, () => true)
  const timeout = p.request()
  await flush(); p.emit('background'); await p.advance(120000)
  equal(await timeout, 'unconfirmed', '长时间离开可释放请求')
  p.verifyClean()
}

async function initializationCases() {
  const options = { volume: 0.8, playRate: 1, cacheSize: 100, isHandleAudioFocus: true, isEnableAudioOffload: false }
  for (const failure of ['none', 'setup', 'options', 'volume', 'rate']) {
    const state = { isIniting: false, isInitialized: false }
    let setupCount = 0
    let fail = failure != 'none'
    let release
    const gate = new Promise(resolve => { release = resolve })
    const maybeFail = name => { if (name == failure && fail) { fail = false; throw new Error(name) } }
    const api = load('plugins/player/index.ts', {
      'react-native-track-player': { default: { setupPlayer: async () => { setupCount++; await gate; maybeFail('setup') } } },
      './utils': {
        migratePlayerCache: async () => {}, updateOptions: async () => maybeFail('options'),
        setVolume: async () => maybeFail('volume'), setPlaybackRate: async () => maybeFail('rate'),
      },
    }, { global: { lx: { playerStatus: state } } })
    const a = api.initial(options)
    const b = api.initial(options)
    let finished = false
    void b.then(() => { finished = true }, () => { finished = true })
    await flush()
    equal(setupCount, 1, '并发初始化只创建一个原生播放器')
    equal(finished, false, '后续调用等待初始化完成')
    release()
    const result = await Promise.allSettled([a, b])
    equal(state.isIniting, false, '成功或失败都释放初始化锁')
    equal(result[0].status, failure == 'none' ? 'fulfilled' : 'rejected', `${failure} 传播结果`)
    if (failure != 'none') {
      equal(state.isInitialized, false, '初始化配置失败不可假称完成')
      await api.initial(options)
      equal(setupCount, 2, '失败后能够重试')
    }
    equal(state.isInitialized, true, '全部选项成功才标记就绪')
    await api.initial(options)
    equal(setupCount, failure == 'none' ? 1 : 2, '已初始化不重复 setup')
  }
}

function lyricCases() {
  const parserContext = { module: { exports: {} }, performance, setTimeout, clearTimeout }
  vm.runInNewContext(fs.readFileSync(require.resolve('lrc-file-parser'), 'utf8'), parserContext)
  const api = load('utils/statusBarLyrics.ts', { 'lrc-file-parser': { default: parserContext.module.exports } })
  let lines = api.buildStatusBarLyrics('[00:01.00]Hello\n[00:03.00]World', '[00:01.00]你好', '[00:03.00]world', 5000)
  equal(lines[0].begin, 1000, '秒转为毫秒')
  equal(lines[0].end, 3000, '下一句开始是当前句结束')
  equal(lines[0].translation, '你好', '译文单独保留')
  equal(lines[1].translation, '', '缺少译文不能错用其他行')
  equal(lines[1].roma, 'world', '罗马音单独保留')
  equal(lines[1].end, 5000, '末句以歌曲时长结束')
  equal(api.buildStatusBarLyrics('', '', '', 0).length, 0, '无歌词清空')
  lines = api.buildStatusBarLyrics('[offset:200]\n[00:01.00]A\n[00:02.00]\n[00:03.00]B', '[00:01.00]甲', '', 0)
  equal(lines[0].begin, 800, 'LRC 偏移量对齐')
  equal(lines[0].translation, '甲', '译文偏移量对齐')
  equal(lines[1].text, '', '保留间奏空行，避免上一句一直显示')
  equal(lines[2].end, 12800, '未知时长有界结束')
}

async function bridgeCases() {
  const calls = []
  const setting = { setting: { 'player.statusBarLyric': false, 'player.playbackRate': 1.25, 'player.isShowLyricTranslation': true, 'player.isShowLyricRoma': false } }
  const state = { musicInfo: { id: 'tx_1', name: 'Song', singer: 'Singer', lrc: '[00:01.00]A' }, progress: { maxPlayTime: 100 }, isPlay: true }
  let result = 'waiting'
  const api = load('core/statusBarLyric.ts', {
    'react-native': { NativeModules: { StatusBarLyricModule: {
      setEnabled: async value => { calls.push(['enabled', value]); return result },
      getStatus: async () => result,
      setSong: async song => calls.push(['song', song]),
      setOptions: async (...args) => calls.push(['options', ...args]),
      setPlayback: async (...args) => calls.push(['playback', ...args]),
    } } },
    '@/store/player/state': { default: state }, '@/store/setting/state': { default: setting },
    '@/plugins/player': { isInitialized: () => true, getPosition: async () => 12.5 },
    '@/utils/statusBarLyrics': { buildStatusBarLyrics: () => [] },
  })
  equal(await api.enableStatusBarLyric(true), 'waiting', '注册请求不冒充已连接')
  equal(calls.some(call => call[0] == 'song'), true, '旧预览版保存的关闭值不能阻止自动同步')
  equal(calls.find(call => call[0] == 'song')[1].duration, 100000, '歌曲时长传毫秒')
  equal(calls.find(call => call[0] == 'options')[1], 1.25, '启动同步播放速度')
  equal(calls.find(call => call[0] == 'options')[2], true, '启动同步翻译开关')
  equal(calls.at(-1)[2], 12500, '开启时同步当前真实进度')
  api.pauseStatusBarLyric()
  equal(calls.at(-1)[1], false, '暂停同步状态')
  equal(calls.at(-1)[2], -1, '暂停由原生时钟冻结进度')
  state.isPlay = false
  api.seekStatusBarLyric(45000)
  equal(calls.at(-1)[1], false, '暂停中拖动不恢复播放')
  equal(calls.at(-1)[2], 45000, '暂停中也同步定位')
  api.setStatusBarLyric('')
  equal(calls.at(-1)[1], null, '切歌或停止清空旧歌')
  await api.enableStatusBarLyric(false)
  equal(calls.at(-1)[1], false, '关闭释放原生提供端')
  const count = calls.length
  api.playStatusBarLyric(0); api.pauseStatusBarLyric(); api.setStatusBarLyric('A'); api.setStatusBarLyricOptions()
  equal(calls.length, count, '退出释放后不继续发送歌词')
  result = 'not_installed'
  await api.enableStatusBarLyric(true)
  equal(calls.at(-1)[0], 'playback', '未安装词幕时仍缓存当前进度，安装后能同步')
  equal(await api.getStatusBarLyricStatus(), 'not_installed', '未安装状态不能误报接口错误')
  result = 'unavailable'
  equal(await api.enableStatusBarLyric(true), 'unavailable', '服务缺失时不阻塞播放器')
}

async function notificationCases() {
  const capability = { Play: 1, Pause: 2, Stop: 3, SeekTo: 4, SkipToNext: 5, SkipToPrevious: 6 }
  let options
  const api = load('plugins/player/utils.ts', {
    'react-native-track-player': { default: { updateOptions: async value => { options = value } }, Capability: capability },
    'react-native-background-timer': {}, './playList': {}, '@/utils/fs': {}, '@/utils/tools': {}, './hook': {},
  })
  await api.updateOptions()
  equal(options.stopWithApp, false, '后台继续播放')
  for (const key of ['capabilities', 'notificationCapabilities', 'compactCapabilities']) {
    equal(options[key].includes(capability.Stop), false, `${key} 没有方块停止按钮`)
    equal(options[key].includes(capability.SkipToPrevious), true, `${key} 有上一首`)
    equal(options[key].includes(capability.SkipToNext), true, `${key} 有下一首`)
  }
  const events = new Map()
  let paused = 0
  let exited = 0
  let factory
  const eventNames = new Proxy({}, { get: (_, key) => key })
  const service = load('plugins/player/service.ts', {
    'react-native-track-player': { default: {
      registerPlaybackService: callback => { factory = callback }, addEventListener: (key, callback) => events.set(key, callback),
    }, Event: eventNames, State: eventNames },
    './utils': {}, './playList': {}, '@/core/common': { exitApp: () => { exited++ } },
    '@/core/player/player': { pause: async () => { paused++ } },
  }, { global: { lx: { playerStatus: {} } }, console: { log() {} } })
  service.default()
  await factory()()
  events.get('RemoteStop')()
  await flush()
  equal(paused, 1, '远程 Stop 安全暂停')
  equal(exited, 0, '远程 Stop 不退出软件')
}

async function storageCases() {
  for (const version of [29, 30, 33]) {
    let legacyChecks = 0
    let modernChecks = 0
    const api = load('utils/tools.ts', {
      'react-native': {
        Platform: { OS: 'android', Version: version, constants: { Release: String(version) } },
        PermissionsAndroid: { PERMISSIONS: { WRITE_EXTERNAL_STORAGE: 'write' }, check: async () => { legacyChecks++; return true } },
      },
      '@react-native-clipboard/clipboard': {}, '@/config/constant': {}, '@/utils/fs': {},
      '@/utils/nativeModules/utils': { isExternalStorageManager: async () => { modernChecks++; return true } },
      '@/utils/musicSdk': {}, '@/plugins/storage': {}, 'react-native-background-timer': {}, './pixelRatio': {}, './index': {}, 'react-native-quick-md5': {},
    })
    equal(await api.checkStoragePermissions(), true, `API ${version} 读取实际文件访问权限`)
    equal(await api.requestStoragePermission(), true, `API ${version} 已授权不重复申请`)
    equal(legacyChecks, version < 30 ? 2 : 0, '新系统不再读取已失效的 WRITE_EXTERNAL_STORAGE')
    equal(modernChecks, version >= 30 ? 2 : 0, '按系统版本选择存储权限检查')
  }
}

async function permissionPromptCases() {
  for (const result of ['enabled', 'unconfirmed', 'unavailable', 'cancel']) {
    const messages = []
    let alertCount = 0
    let buttons
    const api = load('utils/tools.ts', {
      'react-native': {
        Platform: { OS: 'android', constants: { Release: '16' } },
        ToastAndroid: { showWithGravityAndOffset: text => messages.push(text) },
        Alert: { alert: (_title, _message, value) => { buttons = value; alertCount++ } },
      },
      '@react-native-clipboard/clipboard': {},
      '@/config/constant': { storageDataPrefix: { notificationTipEnable: 'notification', ignoringBatteryOptimizationTipEnable: 'battery' } },
      '@/utils/fs': {}, '@/utils/musicSdk': {}, 'react-native-background-timer': {}, './pixelRatio': {}, './index': {}, 'react-native-quick-md5': {},
      '@/plugins/storage': { getData: async () => null },
      '@/utils/nativeModules/utils': { isIgnoringBatteryOptimization: async () => false, requestIgnoreBatteryOptimization: async () => result },
    }, { global: { i18n: { t: key => key } } })
    const a = api.checkIgnoringBatteryOptimization()
    const b = api.checkIgnoringBatteryOptimization()
    await flush()
    equal(alertCount, 1, '并发首次播放不重复弹权限提示')
    equal(buttons[1].text, 'disagree', '保留原不同意按钮文案')
    buttons[result == 'cancel' ? 1 : 2].onPress()
    await Promise.all([a, b])
    equal(messages.includes('disagree_tip'), result == 'cancel', '仅明确取消时沿用那算了，不误报已授权或未知')
    equal(messages.length, result == 'enabled' ? 0 : 1, '授权成功无拒绝提示')
  }
}

async function main() {
  await permissionCases()
  await initializationCases()
  lyricCases()
  await bridgeCases()
  await notificationCases()
  await permissionPromptCases()
  await storageCases()
  console.log(`PASS: ${checks} background playback / permission / lyric assertions`)
}
main().catch(error => { console.error(error); process.exitCode = 1 })
