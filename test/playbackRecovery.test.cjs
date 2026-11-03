const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.join(__dirname, '..')
const mobile = fs.existsSync(path.join(root, 'src/core/player/player.ts'))
const base = mobile ? 'src/core/player/' : 'src/renderer/core/player/'
function load(file, dependencies = {}, globals = {}) {
  const context = { exports: {}, console: { log() {}, warn() {} }, AbortController, URL, ...globals,
    require: id => { if (!(id in dependencies)) throw Error('Missing test dependency: ' + id); return dependencies[id] },
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, context, { filename: file })
  return context.exports
}
const flush = async() => { for (let i = 0; i < 60; i++) await Promise.resolve() }
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }

function harness() {
  const timers = new Map()
  let timerId = 0
  const setTimeout = (fn, delay = 0) => { const id = ++timerId; timers.set(id, { fn, delay }); return id }
  const clearTimeout = id => timers.delete(id)
  const recovery = load(base + 'recovery.ts')
  const tracks = ['one', 'two', 'three', 'four'].map(id => ({ id, source: 'tx', name: id, singer: 'artist', meta: {} }))
  const state = { isPlay: false, isPlayPending: false, playMusicInfo: { musicInfo: tracks[0], listId: 'test', isTempPlay: false },
    playInfo: { playerListId: 'test', playerPlayIndex: 0 }, musicInfo: { id: 'one' }, playedList: [], tempPlayList: [], progress: { nowPlayTime: 0 },
  }
  const isPlay = { get value() { return state.isPlay }, set value(value) { state.isPlay = value } }
  const isPlayPending = { get value() { return state.isPlayPending }, set value(value) { state.isPlayPending = value } }
  let status = '', resources = [], empty = true
  let request = async() => { throw Error('source unavailable') }
  let filter = async() => ({ filteredList: tracks, playerIndex: state.playInfo.playerPlayIndex })
  const lx = { isPlayedStop: false, gettingUrlId: '', restorePlayInfo: null }
  const app_event = new Proxy({}, { get: (_, name) => () => { if (name === 'pause' || name === 'error') state.isPlay = false } })
  const globals = { setTimeout, clearTimeout, setImmediate: fn => setTimeout(fn),
    window: { lx, app_event, i18n: { t: key => key } }, global: { lx, app_event, i18n: { t: key => key } },
  }
  const noop = () => {}
  const setting = { 'player.togglePlayMethod': 'listLoop', 'player.autoSkipOnError': true, 'player.playQuality': '128k' }
  const info = {
    getList: () => tracks, getSourceList: () => tracks, setPlayListId: id => { state.playInfo.playerListId = id },
    setPlayMusicInfo: (listId, musicInfo, isTempPlay = false) => { state.playMusicInfo = { listId, musicInfo, isTempPlay }; state.musicInfo.id = musicInfo?.id; state.playInfo.playerPlayIndex = tracks.indexOf(musicInfo) },
    setMusicInfo: data => Object.assign(state.musicInfo, data),
  }
  // PC 用 shallowReactive 对象，保持对象身份。
  const pcPlayback = state.playMusicInfo
  const pcInfo = { ...info, setPlayMusicInfo: (listId, musicInfo, isTempPlay = false) => { Object.assign(pcPlayback, { listId, musicInfo, isTempPlay }); state.musicInfo.id = musicInfo?.id; state.playInfo.playerPlayIndex = tracks.indexOf(musicInfo) } }
  const plugins = { isEmpty: () => empty, setPause: () => { state.isPlay = false }, setPlay: () => { state.isPlay = true }, setStop: () => { empty = true },
    setResource: (...args) => { resources.push(mobile ? args[1] : args[0]); empty = false }, isInitialized: () => true, initial: async() => {}, initTrackInfo: noop,
  }
  const music = { getMusicUrl: (...args) => request(...args), getMusicPlayUrlInfo: async(...args) => ({ url: await request(...args), quality: '128k' }),
    getPicPath: async() => '', getLyricInfo: async() => ({ lyric: '', tlyric: 'translated', rawlrcInfo: { lyric: '' } }), isCustomApiSource: () => true,
  }
  const { PlaybackSession } = load(mobile ? 'src/utils/playbackSession.ts' : 'src/common/utils/playbackSession.ts')
  const playbackSession = new PlaybackSession()
  const common = { './session': { playbackSession }, './recovery': recovery, './utils': { filterList: (...args) => filter(...args) } }
  const dep = mobile ? {
    ...common, '@/plugins/player': plugins, '@/core/player/playStatus': { setStatusText: val => { status = val }, setIsPlayPending: val => { state.isPlayPending = val } },
    '@/store/player/state': state, '@/store/setting/state': { setting }, '@/core/player/playInfo': info,
    '@/core/player/playedList': { clearPlayedList: noop, addPlayedList: noop, removePlayedList: noop },
    '@/core/player/tempPlayList': { clearTempPlayeList: noop, removeTempPlayList: index => state.tempPlayList.splice(index, 1) },
    '@/core/music': music, '@/core/music/online': { findMatchedTranslation: async() => '' },
    '@/utils/message': { requestMsg: { tooManyRequests: 'rate limited', cancelRequest: 'cancelled' } }, '@/utils/common': { getRandom: () => 2 },
    'react-native-background-timer': { setTimeout, clearTimeout },
    '@/utils/tools': { debounceBackgroundTimer: fn => (...args) => setTimeout(() => fn(...args), 200), checkNotificationPermission: async() => {}, checkIgnoringBatteryOptimization: noop, requestStoragePermission: async() => true },
    '@/utils/nativeModules/utils': { needsSharedFileAccess: async() => false }, '@/config/constant': { LIST_IDS: { LOVE: 'love' } },
    '@/core/list': { addListMusics: noop, removeListMusics: noop }, '@/core/dislikeList': { addDislikeInfo: noop }, '@/core/common': { updateSetting: noop },
  } : {
    ...common, '@renderer/plugins/player': plugins,
    '@renderer/store/player/state': { ...state, isPlay, isPlayPending, playMusicInfo: pcPlayback, playbackSourceInfo: { value: null } },
    '@renderer/store/player/action': { ...pcInfo, clearPlayedList: noop, clearTempPlayeList: noop, addPlayedList: noop, setAllStatus: val => { status = val }, removeTempPlayList: index => state.tempPlayList.splice(index, 1), removePlayedList: noop },
    '@renderer/store/setting': { appSetting: setting }, '../music/index': music, '../music/translation': { findMatchedTranslation: async() => '' },
    '@renderer/utils/message': { requestMsg: { tooManyRequests: 'rate limited', cancelRequest: 'cancelled' } }, '@renderer/utils/index': { getRandom: () => 2 },
    '@renderer/store/list/action': { addListMusics: noop, removeListMusics: noop }, '@renderer/store/list/state': { loveList: { id: 'love' } },
    '@renderer/core/dislikeList': { addDislikeInfo: noop }, '@renderer/utils/ipc': { removeMusicUrl: noop },
  }
  const api = load(base + (mobile ? 'player.ts' : 'action.ts'), dep, globals)
  const fire = async(delay) => {
    for (const [id, timer] of [...timers]) if (timer.delay === delay) { timers.delete(id); timer.fn() }
    await flush()
  }
  return { api, state, setting, tracks, resources, timers, playbackSession, recovery: recovery.playbackRecovery, fire, status: () => status,
    request: fn => { request = fn }, filter: fn => { filter = fn },
    start: async(index = 0) => { await api.playList('test', index); await fire(200); await flush() },
  }
}

if (!mobile) test('实际播放器先尝试主源与官方，勾选备用不抢占 QQ 原有兜底', async() => {
  const h = harness()
  h.setting['common.apiBackupSources'] = ['user_api_backup']
  const attempts = []
  h.request(async({ requestOptions }) => {
    attempts.push([requestOptions.routeStrategy, requestOptions.userApiScope])
    if (requestOptions.userApiScope === 'primary') throw Error('primary unavailable')
    return requestOptions.routeStrategy === 'official' ? 'https://example.test/official.mp3' : 'https://example.test/expired-backup.mp3'
  })
  await h.start()
  assert.deepEqual(attempts, [['api', 'primary'], ['official', undefined]])
  assert.deepEqual(h.resources, ['https://example.test/official.mp3'])
})

test('取址时按播放键实际取消；迟到的成功结果不会再次播放', async() => {
  const h = harness(), result = deferred()
  h.request(() => result.promise)
  await h.start()
  assert.equal(h.state.isPlayPending, true)
  h.api.togglePlay()
  assert.equal(h.state.isPlayPending, false)
  result.resolve('https://example.test/music.mp3')
  await flush()
  assert.equal(h.resources.length, 0)
  await h.fire(5000)
  assert.equal(h.state.playMusicInfo.musicInfo.id, 'one')
})

test('暂停后重播同一首，旧请求失败不能污染新请求或安排跳歌', async() => {
  const h = harness(), old = deferred(), fresh = deferred()
  let count = 0
  h.request(() => ++count === 1 ? old.promise : fresh.promise)
  await h.start()
  await h.api.pause()
  h.api.play()
  old.reject(Error('old request failed'))
  fresh.resolve('https://example.test/new.mp3')
  await flush()
  assert.deepEqual(h.resources, ['https://example.test/new.mp3'])
  assert.equal([...h.timers.values()].some(t => t.delay === 5000), false)
})

test('等待换歌时取消会清除计时器，失败状态不会继续滚动歌单', async() => {
  const h = harness()
  await h.start()
  assert.equal([...h.timers.values()].some(t => t.delay === 5000), true)
  h.api.togglePlay()
  await h.fire(5000)
  assert.equal(h.state.playMusicInfo.musicInfo.id, 'one')
  assert.equal(h.state.isPlayPending, false)
})

test('连续三首失败自动停止，保留当前歌曲供用户修复音源后重试', async() => {
  const h = harness()
  await h.start()
  for (let i = 0; i < 2; i++) { await h.fire(5000); await h.fire(200) }
  assert.equal(h.state.playMusicInfo.musicInfo.id, 'three')
  assert.equal(h.status(), 'player__errors_stopped')
  assert.equal(h.state.isPlayPending, false)
  await h.fire(5000)
  assert.equal(h.state.playMusicInfo.musicInfo.id, 'three')
  h.request(async() => 'https://example.test/recovered.mp3')
  h.api.play()
  await flush()
  assert.equal(h.resources.at(-1), 'https://example.test/recovered.mp3')
})

test('下一首异步筛选过程中暂停，不会在筛选返回后重新启动', async() => {
  const h = harness(), list = deferred()
  h.filter(() => list.promise)
  const next = h.api.playNext()
  await h.api.pause()
  list.resolve({ filteredList: h.tracks, playerIndex: 0 })
  await next
  await h.fire(200)
  assert.equal(h.state.playMusicInfo.musicInfo.id, 'one')
  assert.equal(h.resources.length, 0)
})

test('重复失败的单曲不无限循环；成功播放或主动选歌可重置失败计数', () => {
  const recovery = load(base + 'recovery.ts').createPlaybackRecovery()
  assert.equal(recovery.canSkip('one'), true)
  assert.equal(recovery.canSkip('one'), false)
  recovery.resetFailures()
  assert.equal(recovery.canSkip('one'), true)
  const token = recovery.begin()
  recovery.cancel()
  recovery.begin()
  assert.equal(recovery.isCurrent(token), false)
})

if (mobile) test('安卓限流只延迟重试一次，不无限重试同一首', async() => {
  const h = harness()
  let requests = 0
  h.request(async() => { requests++; throw Error('rate limited') })
  await h.start()
  await h.fire(2000)
  assert.equal(requests, 2)
  assert.equal([...h.timers.values()].some(t => t.delay === 2000), false)
  assert.equal([...h.timers.values()].some(t => t.delay === 5000), true)
})

test('插播消费后仍可上一首/下一首回听，历史选择不吞掉待播项', async() => {
  const h = harness()
  h.request(async() => 'https://example.test/audio.mp3')
  await h.start()
  const inserted = { musicInfo: { ...h.tracks[1], id: 'inserted' }, listId: null, isTempPlay: true }
  h.state.tempPlayList.push(inserted)
  await h.api.playNext()
  assert.equal(h.state.playMusicInfo.musicInfo.id, 'inserted')
  assert.equal(h.state.tempPlayList.length, 0)
  await h.api.playPrev()
  assert.equal(h.state.playMusicInfo.musicInfo.id, 'one')
  await h.api.playNext()
  assert.equal(h.state.playMusicInfo.musicInfo.id, 'inserted')
  h.state.tempPlayList.push({ ...inserted, musicInfo: { ...h.tracks[2], id: 'waiting' } })
  await h.api.playHistoryIndex(0)
  assert.equal(h.state.tempPlayList.length, 1)
  await h.api.playNext()
  assert.equal(h.state.playMusicInfo.musicInfo.id, 'inserted')
  await h.api.playNext()
  assert.equal(h.state.playMusicInfo.musicInfo.id, 'waiting')
})

test('无效的列表播放请求不清空播放会话或修改当前列表', async() => {
  const h = harness()
  await h.start()
  const before = h.playbackSession.history.length
  await h.api.playList('missing', 999)
  await h.api.playListById('missing', 'not-found')
  assert.equal(h.playbackSession.history.length, before)
  assert.equal(h.state.playInfo.playerListId, 'test')
})
