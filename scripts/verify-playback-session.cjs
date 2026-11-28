const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const root = path.resolve(__dirname, '..')
const file = fs.existsSync(path.join(root, 'src/core/player/session.ts')) ? 'src/utils/playbackSession.ts' : 'src/common/utils/playbackSession.ts'
const context = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file),'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
const { PlaybackSession } = context.exports

function loadAndroid(file, modules = {}, globals = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  const context = { exports: {}, require: key => modules[key] ?? {}, ...globals }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
  return context.exports
}

test('安卓多选下一首保持选择顺序，回听中先插播，再回到原前进路线和稍后队列', async() => {
  const song = id => ({ id, source: 'tx' })
  const entry = id => ({ musicInfo: song(id), listId: 'mylist', isTempPlay: false })
  const selected = ['a', 'b', 'c'].map(song)
  for (const source of ['src/components/OnlineList/listAction.ts', 'src/screens/Home/Views/Mylist/MusicList/listAction.ts']) {
    const session = new PlaybackSession()
    session.record(entry('before'))
    session.record(entry('forward'))
    const state = { musicInfo: {}, playMusicInfo: session.back(), tempPlayList: [] }
    const noop = () => {}
    const globals = { AbortController, global: { state_event: { playTempPlayListChanged: noop }, app_event: { pause: noop }, lx: {} } }
    const store = loadAndroid('src/store/player/action.ts', {
      './state': { default: state }, '@/utils': loadAndroid('src/utils/common.ts'),
    }, globals).default
    const queue = { addTempPlayList: store.addTempPlayList, removeTempPlayList: store.removeTempPlayList }
    const player = loadAndroid('src/core/player/player.ts', {
      './session': { playbackSession: session },
      './recovery': { playbackRecovery: { resetFailures: noop, cancel: noop, begin: noop, isCancelled: () => false } },
      '@/core/player/tempPlayList': queue,
      '@/core/player/playStatus': { setIsPlayPending: noop },
      '@/core/player/playInfo': { setPlayMusicInfo(listId, musicInfo, isTempPlay) { state.playMusicInfo = { listId, musicInfo, isTempPlay } } },
      '@/store/player/state': { default: state },
      '@/store/setting/state': { default: { setting: {} } },
      '@/utils/tools': { debounceBackgroundTimer: () => noop },
      '@/plugins/player': { isInitialized: () => true, setStop: noop },
    }, globals)
    const actions = loadAndroid(source, { '@/core/player/tempPlayList': queue })
    queue.addTempPlayList([{ musicInfo: song('later'), listId: 'mylist' }])
    assert.equal((await player.getNextPlayMusicInfo()).musicInfo.id, 'forward')
    const args = source.includes('/Mylist/') ? ['mylist'] : []
    actions.handlePlayNext(...args, selected[0], selected, noop)
    assert.deepEqual(state.tempPlayList.map(item => item.musicInfo.id), ['a', 'b', 'c', 'later'])
    for (const expected of ['a', 'b', 'c', 'forward', 'later']) {
      assert.equal((await player.getNextPlayMusicInfo()).musicInfo.id, expected)
      await player.playNext()
      assert.equal(state.playMusicInfo.musicInfo.id, expected)
    }
    assert.deepEqual(Array.from(session.history, item => item.musicInfo.id), ['before', 'a', 'b', 'c', 'forward', 'later'])
    assert.deepEqual(selected.map(item => item.id), ['a', 'b', 'c'])
  }
})
test('队列排序不改原歌单；无效移动保持队列；切换列表后清除排序', () => {
  const session = new PlaybackSession(), source = ['a', 'b', 'c']
  assert.equal(session.list(null, source), source)
  assert.equal(session.reorder('list', source, 2, 0), true)
  assert.deepEqual(source, ['a', 'b', 'c'])
  assert.deepEqual(Array.from(session.list('list', source)), ['c', 'a', 'b'])
  assert.equal(session.list('other', source), source)
  assert.equal(session.reorder('list', source, -1, 0), false)
  session.reset()
  assert.equal(session.list('list', source), source)
})

test('安卓插队替换待预载曲目，旧请求迟到不会阻塞新队首或重复获取网址', async() => {
  const { EventEmitter } = require('node:events')
  const state = { tempPlayList: [], musicInfo: { id: 'current' }, progress: { nowPlayTime: 92, maxPlayTime: 100 } }
  const events = new EventEmitter()
  let next = { musicInfo: { id: 'original' } }
  let finishOriginal
  const urls = []
  const init = loadAndroid('src/core/init/player/preloadNextMusic.ts', {
    '@/core/player/player': { getNextPlayMusicInfo: async() => next },
    '@/store/player/state': { default: state },
    '@/core/music': { getMusicUrl: async({ musicInfo }) => {
      urls.push(musicInfo.id)
      if (musicInfo.id === 'original') await new Promise(resolve => { finishOriginal = resolve })
      return musicInfo.id
    } },
    '@/plugins/player/utils': { isCached: async() => true },
    '@/utils/request': { checkUrl: async() => true },
  }, { global: { state_event: events, app_event: events } }).default
  init()
  const tick = async() => {
    events.emit('playProgressChanged', state.progress)
    await new Promise(resolve => setImmediate(resolve))
  }
  await tick()
  next = { tempId: 1, musicInfo: { id: 'inserted' } }
  events.emit('playTempPlayListChanged', [next])
  await tick()
  finishOriginal()
  events.emit('playTempPlayListChanged', [next, { tempId: 2 }])
  await tick()
  assert.deepEqual(urls, ['original', 'inserted'])
})
test('重复插播保留独立历史；回听后的新选择截断旧前进路线；历史有界', () => {
  const session = new PlaybackSession()
  for (const item of ['a', 'x', 'x', 'b']) session.record(item)
  assert.equal(session.back(), 'x')
  assert.equal(session.back(), 'x')
  assert.equal(session.forward(), 'x')
  session.record('new')
  assert.deepEqual(Array.from(session.history), ['a', 'x', 'x', 'new'])
  assert.equal(session.forward(), null)
  for (let i = 0; i < 600; i++) session.record(i)
  assert.equal(session.history.length, 500)
  assert.equal(session.back(), 598)
})
