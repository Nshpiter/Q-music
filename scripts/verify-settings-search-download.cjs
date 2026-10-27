const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
function load(file, dependencies, extra = {}) {
  const context = { exports: {}, console, ...extra, require: id => {
    assert.ok(id in dependencies, `Unexpected dependency ${id}`)
    return dependencies[id]
  } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, context)
  return context.exports
}
function directoryFixture() {
  const state = { setting: { 'download.directory': '' } }, files = new Set(), updates = [], writes = []
  const controls = { granted: true, writable: true, directory: true }
  const native = {
    ExternalStorageDirectoryPath: '/storage/emulated/0', CachesDirectoryPath: '/cache',
    mkdir: async() => {}, stat: async() => ({ isDirectory: () => controls.directory }),
    exists: async file => files.has(file), unlink: async file => { files.delete(file) },
    writeFile: async file => { if (!controls.writable) throw Error('EACCES'); files.add(file); writes.push(file) },
  }
  const deps = {
    'react-native-fs': native,
    '@/store/setting/state': state,
    '@/core/common': { updateSetting: update => { updates.push(update); Object.assign(state.setting, update) } },
    '@/utils/tools': { requestStoragePermission: async() => controls.granted },
  }
  return { ...load('src/core/download/location.ts', deps), state, files, writes, controls, updates, native, deps }
}

test('保存目录经过可写检查并清理探针；恢复默认，旧文件不被移动或删除', async() => {
  const f = directoryFixture()
  f.files.add('/storage/Music/old.mp3')
  assert.equal(f.getDownloadDirectory(), '/storage/emulated/0/Music/QMusic')
  await f.saveDownloadDirectory(' /storage/Music/我的歌曲/// ')
  assert.equal(f.getDownloadDirectory(), '/storage/Music/我的歌曲')
  assert.equal(f.writes.length, 1)
  assert.deepEqual([...f.files], ['/storage/Music/old.mp3'])
  await f.saveDownloadDirectory(f.DEFAULT_DOWNLOAD_DIRECTORY)
  assert.equal(f.state.setting['download.directory'], '')
})

test('拒绝权限、只读目录、文件路径、无效路径均不覆盖原设置', async() => {
  for (const scenario of ['denied', 'read-only', 'file', 'uri', 'relative', 'traversal', 'empty']) {
    const f = directoryFixture()
    f.state.setting['download.directory'] = '/storage/old'
    if (scenario == 'denied') f.controls.granted = false
    if (scenario == 'read-only') f.controls.writable = false
    if (scenario == 'file') f.controls.directory = false
    const selected = { uri: 'content://media/folder', relative: 'Music', traversal: '/storage/Music/../private', empty: '/' }[scenario] || '/storage/new'
    await assert.rejects(f.saveDownloadDirectory(selected))
    assert.equal(f.getDownloadDirectory(), '/storage/old')
    assert.equal(f.updates.length, 0)
    assert.equal(f.files.size, 0)
  }
})

test('下载开始后切换目录不改变该任务；后续任务使用新目录，删除记录仍用原路径', async() => {
  const f = directoryFixture(), tasks = new Map(), moved = [], completed = []
  let release
  const gate = new Promise(resolve => { release = resolve })
  let requests = 0
  const deps = {
    ...f.deps,
    'react-native-fs': { ...f.native, downloadFile: () => ({ promise: Promise.resolve({ statusCode: 200 }) }), moveFile: async(from, to) => { moved.push(to); f.files.add(to) } },
    'react-native': { NativeModules: { UtilsModule: { scanMediaFile: async() => {} } } },
    '@/core/music/online': { getMusicPlayUrlInfo: async() => { if (++requests == 1) await gate; return { url: 'https://example.test/song' } } },
    './location': f,
    './store': {
      getDownloadTask: id => tasks.get(id), removeDownloadTask: id => tasks.delete(id),
      upsertDownloadTask: task => { tasks.set(task.id, task); if (['completed', 'error'].includes(task.status)) completed.push(task) },
    },
  }
  const worker = load('src/core/download/worker.ts', deps)
  await worker.downloadMusics([{ id: 'first', name: 'track/one', singer: 'artist', source: 'tx' }], 'flac')
  await f.saveDownloadDirectory('/storage/new')
  release()
  await new Promise(setImmediate)
  await worker.downloadMusics([{ id: 'second', name: 'track', singer: 'artist', source: 'wy' }], '128k')
  await new Promise(setImmediate)
  assert.equal(completed.length, 2)
  assert.ok(completed.every(task => task.status == 'completed'))
  assert.equal(moved[0], `${f.DEFAULT_DOWNLOAD_DIRECTORY}/artist - track_one.flac`)
  assert.equal(moved[1], '/storage/new/artist - track.mp3')
  await worker.deleteDownloadTask('first_flac', true)
  assert.equal(f.files.has(moved[0]), false)
  assert.equal(f.files.has(moved[1]), true)
})

test('设置搜索命中实际控件：目录、双语、后台、音源及多词匹配；三种语言标签齐全', () => {
  const file = 'src/screens/Home/Views/Setting/searchItems.ts'
  const imports = [...fs.readFileSync(path.join(root, file), 'utf8').matchAll(/^import \w+ from '([^']+)'/gm)]
  const deps = Object.fromEntries(imports.map(match => [match[1], () => null]))
  const { SETTINGS_SEARCH_ITEMS: items } = load(file, deps)
  const { matchSettings } = load('src/screens/Home/Views/Setting/searchMatch.ts', {})
  for (const language of ['zh-cn', 'zh-tw', 'en-us']) {
    const labels = JSON.parse(fs.readFileSync(path.join(root, 'src/lang', language + '.json'), 'utf8'))
    for (const item of items) {
      assert.ok(labels[item.title], `${language}: ${item.title}`)
      assert.ok(labels['setting_' + item.section], `${language}: ${item.section}`)
      assert.equal(typeof item.component, 'function')
    }
    const t = key => labels[key]
    for (const [query, expected] of [['预测性返回', 'Basic/PredictiveBack'], ['gesture', 'Basic/PredictiveBack'], ['保存位置', 'Download'], ['下载位置', 'Download'], ['雙語', 'Player/IsShowLyricTranslation'], ['后台', 'Player/BackgroundPlayback'], ['备用 音源', 'Basic/Source'], ['  ＦＬＡＣ  ', 'Player/PlayHighQuality']]) {
      assert.ok(matchSettings(query, items, t).some(item => item.id == expected), `${language}: ${query}`)
    }
    assert.equal(matchSettings('   ', items, t).length, 0)
    assert.equal(matchSettings('does-not-exist', items, t).length, 0)
    assert.equal(items.some(item => /LyricDesktop/.test(item.id)), false)
  }
})

test('搜索打开具体设置后返回保留关键词，再选分类不会遗留原搜索控件', () => {
  const state = { lx: { settingActiveId: 'overview' } }
  const nav = load('src/store/setting/navigation.ts', { react: { useSyncExternalStore: (_, snapshot) => snapshot() } }, { global: state })
  nav.setSettingSearchQuery('翻译')
  nav.selectSettingSection('lyrics', 'Player/IsShowLyricTranslation')
  assert.equal(nav.useSettingTarget(), 'Player/IsShowLyricTranslation')
  assert.equal(nav.backToSettingOverview(), true)
  assert.equal(nav.getSettingSearchQuery(), '翻译')
  assert.equal(nav.useSettingTarget(), '')
  nav.selectSettingSection('download', 'Download')
  nav.selectSettingSection('download')
  assert.equal(nav.useSettingSection(), 'download')
  assert.equal(nav.useSettingTarget(), '')
})
