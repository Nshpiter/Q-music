const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function fixture() {
  const task = { id: 'download', status: 'completed', filePath: '/Music/QMusic/song.flac', fileName: 'song.flac', musicInfo: { name: 'song', singer: 'artist', interval: '03:00', meta: { albumName: 'album', picUrl: 'cover', toggleMusicInfo: { source: 'tx' } } } }
  const state = { playMusicInfo: { musicInfo: null }, isPlay: false }
  const calls = []
  const controls = { exists: true, needsAccess: false, granted: true, removed: false, onExists: () => {} }
  const deps = {
    'react-native-fs': { default: { exists: async() => { controls.onExists(); return controls.exists } } },
    '@/config/constant': { LIST_IDS: { PLAY_LATER: 'playLater' } },
    '@/core/player/player': { playNext: async() => { calls.push('next') }, togglePlay: () => { calls.push('toggle') } },
    '@/store/player/action': { default: { addTempPlayList: list => { calls.push(list) } } },
    '@/store/player/state': { default: state },
    '@/utils/nativeModules/utils': { needsSharedFileAccess: async() => controls.needsAccess },
    '@/utils/tools': { requestStoragePermission: async() => controls.granted },
    './store': { getDownloadTask: () => controls.removed ? undefined : task },
  }
  const context = { exports: {}, require: id => { if (id in deps) return deps[id]; throw Error(id) } }
  const source = fs.readFileSync(path.join(__dirname, '../src/core/download/play.ts'), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context)
  return { ...context.exports, task, state, calls, controls }
}

test('下载完成后播放本地文件，不复制在线换源信息或替换用户歌单', async() => {
  const f = fixture()
  await f.playDownloadTask('download')
  assert.equal(f.calls.length, 2)
  const selected = f.calls[0][0]
  assert.equal(selected.musicInfo.source, 'local')
  assert.equal(selected.musicInfo.meta.filePath, f.task.filePath)
  assert.equal(selected.musicInfo.meta.ext, 'flac')
  assert.equal(selected.musicInfo.meta.toggleMusicInfo, undefined)
  assert.equal(selected.isTop, true)
  assert.equal(f.calls[1], 'next')
})

test('文件丢失、尚未完成或存储权限被拒绝时保持原播放队列', async() => {
  for (const scenario of ['missing', 'unfinished', 'denied']) {
    const f = fixture()
    if (scenario == 'missing') f.controls.exists = false
    if (scenario == 'unfinished') f.task.status = 'run'
    if (scenario == 'denied') { f.controls.needsAccess = true; f.controls.granted = false }
    await assert.rejects(f.playDownloadTask('download'), scenario == 'denied' ? /storage_all_files_unconfirmed/ : /download_play_missing/)
    assert.deepEqual(f.calls, [])
  }
})

test('检查文件期间下载记录被移除时不再入队', async() => {
  const f = fixture()
  f.controls.onExists = () => { f.controls.removed = true }
  await assert.rejects(f.playDownloadTask('download'), /download_play_missing/)
  assert.deepEqual(f.calls, [])
})

test('再次点击当前本地歌曲只切换播放状态，不重复入队', async() => {
  for (const isPlay of [true, false]) {
    const f = fixture()
    f.state.playMusicInfo.musicInfo = { source: 'local', meta: { filePath: f.task.filePath } }
    f.state.isPlay = isPlay
    await f.playDownloadTask('download')
    assert.deepEqual(f.calls, ['toggle'])
  }
})

test('已有本地版本时下载另一音质仍使用在线地址，不把本地路径交给网络下载器', async() => {
  const tasks = new Map()
  const requests = []
  const downloads = []
  let finished
  const complete = new Promise(resolve => { finished = resolve })
  const deps = {
    'react-native-fs': {
      ExternalStorageDirectoryPath: '/storage',
      CachesDirectoryPath: '/cache',
      exists: async() => false,
      mkdir: async() => {},
      moveFile: async() => {},
      downloadFile: options => { downloads.push(options); return { promise: Promise.resolve({ statusCode: 200 }) } },
    },
    'react-native': { NativeModules: { UtilsModule: { scanMediaFile: async() => {} } } },
    '@/utils/tools': { requestStoragePermission: async() => true },
    '@/core/music': { getMusicPlayUrlInfo: async() => ({ url: '/existing/song.mp3', quality: '128k' }) },
    '@/core/music/online': { getMusicPlayUrlInfo: async options => { requests.push(options); return { url: 'https://audio.example/song.flac', quality: 'flac' } } },
    './location': { getDownloadDirectory: () => '/storage/Music/QMusic' },
    './store': {
      getDownloadTask: id => tasks.get(id),
      removeDownloadTask: id => tasks.delete(id),
      upsertDownloadTask: task => { tasks.set(task.id, task); if (['completed', 'error'].includes(task.status)) finished(task) },
    },
  }
  const context = { exports: {}, console, require: id => { assert.ok(id in deps, id); return deps[id] } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/core/download/worker.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, context)
  assert.equal(await context.exports.downloadMusics([{ id: 'song', source: 'tx', name: 'Song', singer: 'Artist' }], 'flac'), true)
  const task = await complete
  assert.equal(task.status, 'completed')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].quality, 'flac')
  assert.equal(downloads.length, 1)
  assert.equal(downloads[0].fromUrl, 'https://audio.example/song.flac')
})
