const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const mobile = false
const file = {
  schedule: mobile ? 'src/theme/schedule.ts' : 'src/common/theme/schedule.ts',
  match: mobile ? 'src/utils/localTrackMatch.ts' : 'src/common/utils/localTrackMatch.ts',
  selection: mobile ? 'src/core/player/selection.ts' : 'src/renderer/core/player/selection.ts',
  local: mobile ? 'src/core/music/preferLocal.ts' : 'src/renderer/core/music/preferLocal.ts',
  remove: mobile ? 'src/utils/removeLocalMusic.ts' : 'src/main/utils/trashLocalMusic.ts',
}
function load(file, dependencies = {}) {
  const context = { exports: {}, require: id => {
    if (!(id in dependencies)) throw Error(id)
    return dependencies[id]
  } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, context)
  return context.exports
}
const track = (id, extra = {}) => ({ id, source: 'tx', name: 'Same Song', singer: 'Artist', interval: '03:20', meta: { songId: id }, ...extra })
const matching = load(file.match)

test('日夜主题按本地时间在 07:00 和 19:00 切换，跨午夜仍为夜间', () => {
  const { isNightTime } = load(file.schedule)
  for (const [hour, minute, expected] of [[6, 59, true], [7, 0, false], [18, 59, false], [19, 0, true], [23, 59, true], [0, 0, true]]) {
    assert.equal(isNightTime(new Date(2026, 9, 23, hour, minute)), expected)
  }
})
test('本地匹配拒绝同名异曲、现场版和缺失元数据，平台 ID 必须同源', () => {
  const online = track('1')
  assert.equal(matching.isSamePlatformTrack(online, track('alias', { meta: { songId: '1' } })), true)
  assert.equal(matching.isSamePlatformTrack(online, track('1', { source: 'wy' })), false)
  assert.equal(matching.isSameLocalRecording(online, track('local', { source: 'local', interval: '03:21' })), true)
  for (const extra of [{ name: 'Same Song (Live)' }, { singer: 'Cover Artist' }, { interval: '04:20' }, { interval: null }, { singer: '' }]) {
    assert.equal(matching.isSameLocalRecording(online, track('local', extra)), false)
  }
})

function selectionFixture(mode, hasCurrent = true, setTempList = async() => {}) {
  const events = []
  const setting = { 'list.singlePlayMode': mode }
  const playback = { musicInfo: hasCurrent ? track('original') : null }
  const addTempPlayList = items => {
    events.push(['add', items[0].musicInfo.id, items[0].isTop])
    if (!mobile && !playback.musicInfo) { playback.musicInfo = items[0].musicInfo; events.push(['next']) }
  }
  const lists = { getListMusics: async() => [track('one'), track('two')], setTempList: async(key, list) => { events.push(['replace', key, list.length]); await setTempList(key, list) } }
  const player = { playList: (id, index) => events.push(['play', id, index]), playNext: async() => events.push(['next']) }
  const deps = mobile ? {
    '@/config/constant': { LIST_IDS: { PLAY_LATER: null, TEMP: 'temp' } },
    '@/store/setting/state': { setting }, '@/core/list': lists,
    '@/store/player/action': { addTempPlayList }, './player': player,
  } : {
    '@common/constants': { LIST_IDS: { PLAY_LATER: null, TEMP: 'temp' } },
    '@renderer/store/setting': { appSetting: setting }, '@renderer/store/list/action': lists,
    '@renderer/store/player/action': { addTempPlayList }, '@renderer/store/player/state': { playMusicInfo: playback }, './action': player,
  }
  deps[mobile ? '@/utils/musicSdk/bi' : '@renderer/utils/musicSdk/bi'] = { bilibiliClient: { videoContents: async() => { throw Error('unexpected Bilibili lookup') } } }
  deps[mobile ? '@/utils' : '@renderer/utils'] = { toNewMusicInfo: item => item }
  return { api: load(file.selection, deps), events }
}
test('插入单曲保留当前队列，只播放选中歌曲', async() => {
  const { api, events } = selectionFixture('add')
  await api.playFromPage('search', [track('one'), track('two')], 1)
  assert.deepEqual(events, [['add', 'two', true], ['next']])
})
test('空队列首次插入不会重复跳下一首', async() => {
  const { api, events } = selectionFixture('add', false)
  await api.playFromList('library', 0)
  assert.deepEqual(events, [['add', 'one', true], ['next']])
})
test('替换模式写入完整当前页，保留所选位置；无效位置不清空队列', async() => {
  const { api, events } = selectionFixture('replace')
  await api.playFromPage('search', [track('one'), track('two')], 1)
  assert.deepEqual(events, [['replace', 'search', 2], ['play', 'temp', 1]])
  await api.playFromPage('empty', [], 0)
  assert.equal(events.length, 2)
})
test('连续选择时旧请求不开始播放，最后选择决定最终队列', async() => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  const { api, events } = selectionFixture('replace', true, key => key == 'first' ? gate : Promise.resolve())
  const first = api.playFromPage('first', [track('first')], 0)
  await new Promise(setImmediate)
  const second = api.playFromPage('second', [track('second')], 0)
  release()
  await Promise.all([first, second])
  assert.deepEqual(events, [['replace', 'first', 1], ['replace', 'second', 1], ['play', 'temp', 0]])
})

function localFixture() {
  const online = track('song')
  const lists = [track('/music/song.mp3', { source: 'local', meta: { filePath: '/music/song.mp3' } })]
  const downloaded = { id: 'download', musicInfo: online, status: 'completed', quality: 'flac', filePath: '/download/song.flac', isComplate: true, metadata: { musicInfo: online, quality: 'flac' } }
  const missing = new Set()
  const getLocalFilePath = async item => missing.has(item.meta.filePath) ? '' : item.meta.filePath
  const deps = mobile ? {
    'react-native-fs': { exists: async file => !missing.has(file) },
    '@/core/download/store': { getDownloadTasks: () => [downloaded] },
    '@/core/list': { getListMusics: async() => lists },
    '@/store/list/state': { defaultList: { id: 'default' }, loveList: { id: 'love' }, userList: [] },
    '@/utils/music': { getLocalFilePath }, '@/utils/localTrackMatch': matching,
  } : {
    '@renderer/store/download/action': { getDownloadList: async() => [downloaded] },
    '@renderer/store/list/action': { getListMusics: async() => lists },
    '@renderer/store/list/state': { defaultList: { id: 'default' }, loveList: { id: 'love' }, userLists: [] },
    '@renderer/utils/music': { getLocalFilePath, getDownloadFilePath: async() => missing.has(downloaded.filePath) ? '' : downloaded.filePath },
    '@renderer/store/download/utils': { buildSavePath: () => '/download' }, '@common/utils/localTrackMatch': matching,
  }
  return { api: load(file.local, deps), missing, online }
}
test('优先精确下载记录，丢失后匹配本地曲目，全部失效时返回在线回退信号', async() => {
  const { api, missing, online } = localFixture()
  assert.equal((await api.findLocalPlayback(online, 'flac')).url, '/download/song.flac')
  missing.add('/download/song.flac')
  assert.equal((await api.findLocalPlayback(online, 'flac')).url, '/music/song.mp3')
  missing.add('/music/song.mp3')
  assert.equal(await api.findLocalPlayback(online, 'flac'), null)
})

function removalFixture(directory = '', permitted = true) {
  const removed = []
  const exists = target => ['/music/song.mp3', '/music/song.lrc', directory].filter(Boolean).includes(target)
  const info = target => ({ isFile: () => target != directory, isSymbolicLink: () => false })
  const deps = mobile ? {
    'react-native-fs': { exists: async target => exists(target), stat: async target => info(target), unlink: async target => removed.push(target) },
    '@/utils/nativeModules/utils': { needsSharedFileAccess: async() => true },
    '@/utils/tools': { requestStoragePermission: async() => permitted },
  } : {
    electron: { shell: { trashItem: async target => removed.push(target) } },
    'node:fs/promises': { lstat: async target => { if (!exists(target)) throw Object.assign(Error(), { code: 'ENOENT' }); return info(target) } },
    'node:path': path.posix,
    '@common/utils/localMusicFiles': { localAudioExtensions: ['mp3'] },
  }
  const api = load(file.remove, deps)
  return { remove: mobile ? api.deleteLocalMusicFiles : musicInfo => api.trashLocalMusicFile(musicInfo.meta.filePath), removed }
}
test('删除仅处理所选音频和同名歌词，拒绝目录并在预检失败时不删任何文件', async() => {
  const local = track('local', { source: 'local', meta: { filePath: '/music/song.mp3' } })
  const ok = removalFixture()
  await ok.remove(local)
  assert.deepEqual(ok.removed, ['/music/song.lrc', '/music/song.mp3'])
  const bad = removalFixture('/music/song.tlrc')
  await assert.rejects(bad.remove(local))
  assert.deepEqual(bad.removed, [])
  const invalid = removalFixture()
  await assert.rejects(invalid.remove(track('invalid', { meta: { filePath: '/music/' } })))
  assert.deepEqual(invalid.removed, [])
})

test('音质面板勾选跟随实际回退来源和音质，仍允许重新请求原平台', async() => {
  const vue = require('vue')
  const compiler = require('@vue/compiler-sfc')
  const source = fs.readFileSync(path.join(__dirname, '../src/renderer/components/layout/PlayDetail/components/PlayerQualityMenu.vue'), 'utf8')
  const script = compiler.compileScript(compiler.parse(source).descriptor, { id: 'quality-test' }).content
  const route = vue.ref({ musicKey: 'tx:one', requestedSource: 'tx', resolvedSource: 'wy', quality: '320k', mode: 'api', isFallback: true })
  const deps = {
    '@common/utils/vueTools': { ...vue, onMounted() {}, onBeforeUnmount() {} },
    '@renderer/plugins/i18n': { useI18n: () => key => key },
    '@renderer/store/setting': { appSetting: { 'player.playQuality': 'flac' } },
    '@renderer/store': { apiSource: vue.ref(''), qualityList: vue.ref({}), userApi: { list: [] } },
    '@renderer/store/player/state': { playbackSourceInfo: route },
    '@renderer/components/common/SourceIcon.vue': {},
    '@renderer/core/music/utils': { getOtherSource: async() => [], isCustomApiSource: () => false },
  }
  const context = { exports: {}, require: id => { if (!(id in deps)) throw Error(id); return deps[id] } }
  vm.runInNewContext(ts.transpileModule(script, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, context)
  const scope = vue.effectScope()
  const events = []
  try {
    const state = scope.run(() => context.exports.default.setup(vue.reactive({ modelValue: true, musicInfo: track('one') }), { expose() {}, emit: (...args) => events.push(args) }))
    assert.equal(state.effectiveSource.value, 'wy')
    assert.equal(state.activeQuality.value, '320k')
    state.selectSource(track('one'))
    assert.deepEqual(events[0], ['select-source', null])
    route.value = { ...route.value, resolvedSource: 'tx', quality: 'flac' }
    assert.equal(state.effectiveSource.value, 'tx')
    assert.equal(state.activeQuality.value, 'flac')
    route.value = { ...route.value, mode: 'local', quality: null }
    assert.equal(state.activeQuality.value, null)
  } finally { scope.stop() }
})
