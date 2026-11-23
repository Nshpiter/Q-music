const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, dependencies, globals = {}) {
  const context = { exports: {}, process, window: { i18n: { t: key => key } }, ...globals, require: id => {
    if (id in dependencies) return dependencies[id]
    if (id.startsWith('node:')) return require(id)
    throw Error(id)
  } }
  let source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  if (file.endsWith('.vue')) source = require('@vue/compiler-sfc').parse(source).descriptor.script.content
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
  return context.exports
}
const folderUtils = load('src/common/utils/localMusicFiles.ts', {})
const entry = (name, type) => ({ name, isFile: () => type == 'file', isDirectory: () => type == 'directory' })

test('目录扫描支持大小写扩展名、自然顺序、递归、重叠根目录去重，跳过目录链接和不可读目录', async() => {
  const root = path.resolve('fixtures/local-music')
  const tree = new Map([
    [root, [entry('10.MP3', 'file'), entry('2.flac', 'file'), entry('cover.jpg', 'file'), entry('album', 'directory'), entry('blocked', 'directory'), entry('loop', 'link')]],
    [path.join(root, 'album'), [entry('song.opus', 'file')]],
  ])
  const utils = load('src/common/utils/localMusicFiles.ts', { 'node:fs/promises': { readdir: async dir => {
    if (!tree.has(dir)) throw Error('EACCES')
    return tree.get(dir)
  } } })
  const result = await utils.scanLocalMusicFolders([root, path.join(root, 'album')])
  assert.deepEqual(Array.from(result.files, file => path.relative(root, file)), ['2.flac', '10.MP3', path.join('album', 'song.opus')])
  assert.equal(result.unreadableFolders, 1)
  assert.equal((await utils.scanLocalMusicFolders([root], false)).files.length, 2)
  assert.notEqual(folderUtils.localFolderPlaylist(path.join(root, 'a', 'same', 'song.mp3')).id, folderUtils.localFolderPlaylist(path.join(root, 'b', 'same', 'song.mp3')).id)
})

function fixture() {
  const lists = []
  const tracks = new Map()
  let parseHook = () => {}
  const worker = { createLocalMusicInfos: async paths => {
    parseHook()
    return paths.filter(p => !p.endsWith('bad.mp3')).map(p => ({ id: p, source: 'local', name: path.basename(p), meta: { filePath: p } }))
  } }
  const actions = load('src/renderer/views/List/MyList/actions.ts', {
    '@renderer/store/list/state': { defaultList: { id: 'default' }, loveList: { id: 'love' }, userLists: lists },
    '@renderer/store/list/action': {
      createUserList: async info => { lists.push(info); tracks.set(info.id, []) },
      getListMusics: async id => tracks.get(id) ?? [],
      addListMusics: async(id, songs) => { tracks.set(id, [...(tracks.get(id) ?? []), ...songs]) },
      setFetchingListStatus() {},
    },
    '@renderer/utils/ipc': {}, '@renderer/plugins/Dialog': {},
    '@common/utils/localMusicFiles': folderUtils,
  }, { window: { i18n: { t: key => key }, lx: { worker: { main: worker } } } })
  return { ...actions, lists, tracks, setParseHook: hook => { parseHook = hook } }
}

test('同名不同目录分别建歌单，重复导入只新增，坏文件不创建空歌单', async() => {
  const f = fixture()
  const files = ['a/album/1.mp3', 'b/album/2.mp3', 'broken/bad.mp3'].map(p => path.resolve(p))
  const first = await f.importLocalMusicFiles(files, { folderFiles: new Set(files) })
  assert.equal(first.added, 2)
  assert.equal(first.skipped, 1)
  assert.equal(f.lists.length, 2)
  assert.equal(f.lists[0].name, f.lists[1].name)
  const nextFiles = [...files, path.resolve('a/album/3.mp3')]
  const second = await f.importLocalMusicFiles(nextFiles, { folderFiles: new Set(nextFiles) })
  assert.equal(second.added, 1)
  assert.equal(second.duplicates, 2)
  assert.equal(f.lists.length, 2)
})

test('选择单曲使用独立本地歌单，既不覆盖平台歌单也不重复添加', async() => {
  const f = fixture()
  const file = path.resolve('music/song.mp3')
  const result = await f.importLocalMusicFiles([file, file], {})
  assert.equal(result.added, 1)
  assert.equal(result.firstListId, 'local_music')
  assert.equal((await f.importLocalMusicFiles([file], {})).duplicates, 1)
})

test('文件与文件夹一起导入时按来源归类，重叠路径只导入一次', async() => {
  const f = fixture()
  const single = path.resolve('loose.wav')
  const track = path.resolve('album/track.wav')
  const result = await f.importLocalMusicFiles([single, track, track], { folderFiles: new Set([track]) })
  assert.equal(result.added, 2)
  assert.deepEqual(Array.from(f.tracks.get('local_music'), song => song.id), [single])
  assert.deepEqual(Array.from(f.tracks.get(folderUtils.localFolderPlaylist(track).id), song => song.id), [track])
})

test('解析过程中目标列表被删除时不重建或写入该列表', async() => {
  const f = fixture()
  f.lists.push({ id: 'target' })
  f.setParseHook(() => { f.lists.splice(0) })
  await assert.rejects(f.importLocalMusicFiles([path.resolve('song.mp3')], { listId: 'target' }), /local_import_target_missing/)
  assert.equal(f.tracks.size, 0)
})

test('当前歌曲下载固定点击时的歌曲；未开启下载先确认，本地文件和下载列表不重复下载', async() => {
  const vue = require('vue')
  const playback = vue.reactive({ musicInfo: { id: 'first', source: 'tx', meta: { qualitys: [{ type: '128k' }] } } })
  const setting = vue.reactive({ 'download.enable': false })
  let approve
  const scope = vue.effectScope()
  const component = load('src/renderer/components/layout/PlayDetail/components/ControlBtns.vue', {
    '@common/utils/vueTools': { ...vue, onMounted() {}, onBeforeUnmount() {} },
    '@renderer/plugins/i18n': { useI18n: () => key => key },
    '@renderer/store/player/state': { playMusicInfo: playback },
    '@renderer/store/player/action': {},
    '@renderer/utils/compositions/useNextTogglePlay': { default: () => ({}) },
    '@renderer/utils/compositions/useToggleDesktopLyric': { default: () => ({}) },
    '@renderer/plugins/Dialog': { dialog: { confirm: () => new Promise(resolve => { approve = resolve }) } },
    '@renderer/plugins/player': {}, '@renderer/core/player/action': {},
    '@renderer/store/setting': { appSetting: setting, updateSetting: values => Object.assign(setting, values) },
    '@renderer/store/list/action': { checkListExistMusic: async() => false },
    '@renderer/store/list/state': { loveList: { id: 'love' } },
    './PlayerAppearanceMenu.vue': {}, './PlayerQualityMenu.vue': {}, './PlayerFavoriteMenu.vue': {},
  }).default
  try {
    const state = scope.run(() => component.setup())
    const pending = state.showCurrentDownload()
    playback.musicInfo = { id: 'second', source: 'wy' }
    approve(true)
    await pending
    assert.equal(setting['download.enable'], true)
    assert.equal(state.downloadMusicInfo.value.id, 'first')
    assert.equal(state.downloadVisible.value, true)
    playback.musicInfo = { id: 'local', source: 'local' }
    assert.equal(state.isDownloadDisabled.value, true)
    playback.musicInfo = { progress: 1, metadata: { musicInfo: { id: 'downloaded', source: 'tx' } } }
    assert.equal(state.isDownloadDisabled.value, true)
    playback.musicInfo = null
    assert.equal(state.isDownloadDisabled.value, true)
  } finally { scope.stop() }
})

test('音频解析器没有抛错但未识别到音频时，不把损坏文件加入列表', async() => {
  let metadata = { common: {}, format: { tagTypes: [], hasAudio: true } }
  const music = load('src/renderer/utils/music.ts', {
    '@common/utils/nodejs': { checkPath: async() => true, extname: path.extname, basename: path.basename },
    '@common/utils/common': { formatPlayTime: seconds => `${seconds}` },
    '@common/utils/lyricUtils/kg': {},
    'music-metadata': { parseFile: async() => metadata },
  })
  assert.equal(await music.createLocalMusicInfo('bad.mp3'), null)
  metadata = { common: { title: 'Tagged title', artists: ['Artist'], album: 'Album' }, format: { codec: 'PCM', sampleRate: 44100, duration: 5 } }
  const valid = await music.createLocalMusicInfo('valid.wav')
  assert.equal(valid.name, 'Tagged title')
  assert.equal(valid.singer, 'Artist')
  assert.equal(valid.meta.albumName, 'Album')
})

test('下载入口的响应式歌曲及嵌套元数据可跨线程传递，任务保存后才更新列表', async() => {
  const vue = require('vue')
  const song = vue.reactive({ id: 'tx_123', name: '歌曲', singer: '歌手', source: 'tx', meta: vue.reactive({ qualitys: [{ type: '128k' }], _qualitys: { '128k': {} } }) })
  const list = vue.reactive([])
  let saved
  let received
  let rejectSave = false
  const actions = load('src/renderer/store/download/action.ts', {
    '@renderer/utils/ipc': { downloadTasksCreate: async tasks => { if (rejectSave) throw Error('disk unavailable'); saved = structuredClone(tasks) } },
    './state': { downloadList: list },
    '@common/utils/vueTools': vue,
    '@renderer/core/music/online': {},
    '../setting': { appSetting: { 'download.maxDownloadNum': 0, 'download.fileName': 'name - singer', 'list.addMusicLocationType': 'bottom' } },
    '..': { qualityList: vue.ref({ tx: ['128k'] }) },
    '@renderer/worker/utils': {},
    '@renderer/utils': { arrPush: (target, items) => target.push(...items) },
    '@common/constants': { DOWNLOAD_STATUS: {} },
    '../index': {}, './utils': {},
  }, { window: { app_event: { downloadListUpdate() {} }, lx: { worker: { download: {
    createDownloadTasks: async(...args) => {
      received = structuredClone(args)
      return received[0].map(musicInfo => ({ id: musicInfo.id, metadata: { musicInfo, quality: received[1], listId: received[4] } }))
    },
  } } } } })
  assert.throws(() => structuredClone([song]), { name: 'DataCloneError' })
  await actions.createDownloadTasks([song], '128k', 'source-list')
  assert.equal(list.length, 1)
  assert.equal(saved[0].metadata.musicInfo.name, '歌曲')
  assert.equal(received[4], 'source-list')
  song.meta.qualitys[0].type = 'flac'
  assert.equal(saved[0].metadata.musicInfo.meta.qualitys[0].type, '128k')
  await actions.createDownloadTasks([song], '128k')
  assert.equal(list.length, 1)
  song.id = 'tx_456'
  rejectSave = true
  await assert.rejects(actions.createDownloadTasks([song], '128k'), /disk unavailable/)
  assert.equal(list.length, 1)
})
