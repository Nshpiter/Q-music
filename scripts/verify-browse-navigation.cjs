const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, dependencies = {}) {
  const context = { exports: {}, setTimeout, clearTimeout, console, requestAnimationFrame: callback => callback(), require: id => {
    if (!(id in dependencies)) throw Error(id)
    return dependencies[id]
  } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, context)
  return context.exports
}
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const timeout = load('src/core/browseRequest.ts')
const detailPages = load('src/core/musicDetailPages.ts', { '@/utils': { toNewMusicInfo: song => song } })
const song = name => ({ list: [{ id: name }], limit: 30, total: 1, source: 'kw' })

for (const kind of ['songlist', 'leaderboard']) {
  test(`安卓 ${kind} 的上游每页 20 首时，浏览和整单读取共享分页并保留顺序`, async () => {
    const pages = []
    const ids = Array.from({ length: 65 }, (_, i) => i + 1)
    const request = async (_, page) => {
      pages.push(page)
      return { list: ids.slice((page - 1) * 20, page * 20).map(id => ({ id })), page, total: 65, limit: 20, source: 'bd' }
    }
    const core = load(`src/core/${kind}.ts`, {
      [`@/store/${kind}/state`]: {}, [`@/store/${kind}/action`]: {},
      '@/utils': { toNewMusicInfo: song => song, deduplicationList: songs => songs },
      '@/utils/musicSdk': { bd: { songList: { getListDetail: request }, leaderboard: { getList: request } } },
      './browseRequest': timeout, './musicDetailPages': detailPages,
    })
    const getPage = page => kind === 'songlist' ? core.getListDetail('123', 'bd', page) : core.getListDetail('bd__123', page)
    const getAll = () => kind === 'songlist' ? core.getListDetailAll('bd', '123') : core.getListDetailAll('bd__123')
    const first = await getPage(1)
    assert.deepEqual(Array.from(first.list, row => row.id), ids.slice(0, 30))
    assert.deepEqual(pages, [1, 2])
    const [second, all] = await Promise.all([getPage(2), getAll()])
    assert.deepEqual(Array.from(second.list, row => row.id), ids.slice(30, 60))
    assert.deepEqual(Array.from(all, row => row.id), ids)
    assert.deepEqual(Array.from((await getPage(3)).list, row => row.id), ids.slice(60))
    assert.deepEqual(pages, [1, 2, 3, 4])
  })
}

test('详情读取中途断网从失败页继续，强制刷新丢弃在途旧响应', async () => {
  const calls = []
  const getReader = detailPages.createDetailCache((source, id, page) => {
    const gate = deferred()
    calls.push({ page, ...gate })
    return gate.promise
  })
  const batch = (start, count, total = 41) => ({
    list: Array.from({ length: count }, (_, i) => ({ id: start + i })), total, limit: 20,
  })
  const reader = getReader('bd', '1', false)
  const first = reader.getPage(1)
  calls[0].resolve(batch(1, 20)); await settle()
  calls[1].reject(Error('offline'))
  await assert.rejects(first, /offline/)
  const retry = reader.getPage(1)
  calls[2].resolve(batch(21, 20))
  assert.equal((await retry).list.length, 30)
  const old = reader.getAll()
  const freshReader = getReader('bd', '1', true)
  const fresh = freshReader.getPage(1)
  calls[4].resolve(batch(100, 2, 2)); await fresh
  calls[3].resolve(batch(41, 1))
  await assert.rejects(old, /superseded/)
  assert.deepEqual(Array.from(await freshReader.getAll(), row => row.id), [100, 101])
  assert.deepEqual(calls.map(call => call.page), [1, 2, 2, 3, 1])
})

test('歌单分页去除页内与跨页重复，保留顺序及平台身份，不污染缓存', () => {
  const state = { listInfo: { list: [] } }
  const actions = load('src/store/songlist/action.ts', { './state': state }).default
  const item = (id, source = 'kw') => ({ id, source })
  const first = Object.freeze([item('a'), item('a'), item('b')])
  actions.setList({ list: first, total: 12, limit: 4, source: 'kw' }, '', 'new', 1)
  assert.deepEqual(Array.from(state.listInfo.list, row => row.id), ['a', 'b'])
  const second = Object.freeze([item('b'), item('c'), item('c'), item('a', 'tx')])
  actions.setList({ list: second, total: 12, limit: 4, source: 'kw' }, '', 'new', 2)
  assert.deepEqual(Array.from(state.listInfo.list, row => `${row.source}:${row.id}`), ['kw:a', 'kw:b', 'kw:c', 'tx:a'])
  assert.equal(first.length, 3)
  assert.equal(second.length, 4)
  assert.equal(state.listInfo.list[0], first[0])
  assert.equal(state.listInfo.maxPage, 3)
  actions.setList({ list: [item('a'), item('b')], total: 99999, limit: 4, source: 'kw' }, '', 'new', 3)
  assert.equal(state.listInfo.list.length, 4)
  assert.equal(state.listInfo.total, 4)
  assert.equal(state.listInfo.maxPage, 3)
  actions.setList({ list: [item('fresh')], total: 1, limit: 4, source: 'kw' }, '', 'new', 1)
  assert.deepEqual(Array.from(state.listInfo.list, row => row.id), ['fresh'])
  actions.setList({ list: [], total: 99999, limit: 4, source: 'kw' }, '', 'new', 2)
  assert.equal(state.listInfo.total, 1)
  assert.equal(state.listInfo.maxPage, 2)
})

function songlistController() {
  let handle, rendered
  const calls = [], statuses = []
  const state = { listInfo: { source: 'kw', tagId: '', sortId: 'new', list: [{ id: 'a', source: 'kw' }], page: 1, maxPage: 3 } }
  const list = { setStatus: value => statuses.push(value), setList() {} }
  const request = (...args) => { const gate = deferred(); calls.push({ ...gate, args }); return gate.promise }
  const actions = load('src/store/songlist/action.ts', { './state': state }).default
  load('src/screens/Home/Views/SongList/List.tsx', {
    react: { forwardRef: fn => fn, useRef: value => ({ current: value === null ? list : value }), useEffect: fn => fn(), useImperativeHandle: (_, fn) => { handle = fn() } },
    'react/jsx-runtime': { jsx: (_, props) => { rendered = props; return props } },
    './components/Songlist': {}, '@/store/songlist/state': state,
    '@/core/songlist': { getList: request, setList: actions.setList, setListInfo: actions.setListInfo },
  }).default({}, {})
  return { handle, rendered, state, calls, statuses }
}
const settle = () => new Promise(resolve => setImmediate(resolve))
const pageResult = (ids, total = 90) => ({ list: ids.map(id => ({ id, source: 'kw' })), total, limit: 30, source: 'kw' })

test('连续触底只请求一次，失败后可重试，重复末页停止请求', async () => {
  const { rendered, calls, state, statuses } = songlistController()
  rendered.onLoadMore(); rendered.onLoadMore()
  assert.equal(calls.length, 1)
  assert.equal(calls[0].args[3], 2)
  calls[0].reject(Error('offline')); await settle()
  assert.equal(statuses.at(-1), 'error')
  rendered.onLoadMore()
  assert.equal(calls[1].args[3], 2)
  calls[1].resolve(pageResult(['a'])); await settle()
  assert.equal(state.listInfo.maxPage, 2)
  assert.equal(statuses.at(-1), 'end')
  rendered.onLoadMore()
  assert.equal(calls.length, 2)
})

test('刷新和切换期间旧分页不能覆盖数据或解除新请求锁', async () => {
  const { rendered, calls, state, handle } = songlistController()
  rendered.onLoadMore()
  rendered.onRefresh()
  calls[0].resolve(pageResult(['stale'])); await settle()
  rendered.onLoadMore()
  assert.equal(calls.length, 2)
  calls[1].resolve(pageResult(['fresh'])); await settle()
  assert.deepEqual(Array.from(state.listInfo.list, row => row.id), ['fresh'])
  rendered.onLoadMore()
  const switching = handle.loadList('wy', 'hot', 'rock')
  calls[2].resolve(pageResult(['old-page'])); await settle()
  rendered.onLoadMore()
  assert.equal(calls.length, 4)
  calls[3].resolve({ ...pageResult(['new-platform']), source: 'wy' }); await switching
  assert.deepEqual(Array.from(state.listInfo.list, row => row.id), ['new-platform'])
})

test('安卓歌单旧响应不会覆盖强制刷新缓存', async () => {
  const calls = []
  const core = load('src/core/songlist.ts', {
    '@/store/songlist/state': {}, '@/store/songlist/action': {}, '@/utils': {}, './browseRequest': timeout, './musicDetailPages': detailPages,
    '@/utils/musicSdk': { kw: { songList: { getList: () => { const gate = deferred(); calls.push(gate); return gate.promise } } } },
  })
  const old = core.getList('kw', '', 'hot', 1)
  const fresh = core.getList('kw', '', 'hot', 1, true)
  calls[1].resolve(song('fresh')); await fresh
  calls[0].resolve(song('old')); await old
  assert.equal((await core.getList('kw', '', 'hot', 1)).list[0].id, 'fresh')
})

for (const kind of ['songlist', 'leaderboard', 'detail']) {
  test(`安卓 ${kind} 刷新失败后仍能重试原列表，离开页面后不回写`, async () => {
    let handle, cleanup, rendered, writes = 0
    const calls = []
    const state = { listInfo: { source: 'kw', tagId: 'rock', sortId: 'hot', list: [{ id: 'original' }], page: 1 }, listDetailInfo: { source: 'wy', id: 'wy__123', list: [{ id: 'original' }], page: 1 } }
    const request = (...args) => { const gate = deferred(); calls.push({ ...gate, args }); return gate.promise }
    const core = { getList: request, getListDetail: request, clearList: () => { throw Error('must preserve target') }, clearListDetail: () => { throw Error('must preserve target') }, setList: data => { writes++; return data }, setListDetail: data => { writes++; return data } }
    const list = { setStatus() {}, setList() {} }
    const dependencies = {
      react: { forwardRef: fn => fn, useRef: value => ({ current: value === null ? list : value }), useEffect: fn => { cleanup = fn() }, useImperativeHandle: (_, fn) => { handle = fn() }, useMemo: fn => fn() },
      'react/jsx-runtime': { jsx: (component, props) => { rendered = props; return props } },
      './components/Songlist': {}, '@/components/OnlineList': {}, './Header': {}, './state': { useListInfo: () => ({ source: 'wy', id: 'wy__123' }) },
      '@/store/songlist/state': state, '@/store/leaderboard/state': state,
      '@/core/songlist': core, '@/core/leaderboard': core, './listAction': {},
    }
    const file = kind == 'songlist' ? 'Home/Views/SongList/List' : kind == 'leaderboard' ? 'Home/Views/Leaderboard/MusicList' : 'SonglistDetail/MusicList'
    load(`src/screens/${file}.tsx`, dependencies).default({}, {})
    assert.ok(handle)
    rendered.onRefresh()
    calls[0].reject(Error('offline'))
    await new Promise(resolve => setImmediate(resolve))
    rendered.onRefresh()
    assert.deepEqual(calls[1].args, calls[0].args)
    calls[1].resolve(song('recovered'))
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(writes, 1)
    rendered.onRefresh()
    cleanup()
    calls[2].resolve(song('late'))
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(writes, 1)
  })
}

const wechat = load('src/core/musicAccount/wechatAuthorization.ts')
test('横屏榜单连续切平台只采用最后选择，长按其他榜单播放使用目标曲目', async () => {
  const calls = [], changes = [], plays = []
  let source, boards, handle, cleanup
  const element = (component, props) => {
    if (component === 'source') source = props
    if (component === 'boards') boards = props
    return props
  }
  const bar = load('src/screens/Home/Views/Leaderboard/Horizontal/LeftBar.tsx', {
    react: { forwardRef: fn => fn, useRef: value => ({ current: value }),
      useImperativeHandle: (_, fn) => { handle = fn() }, useEffect: fn => { cleanup = fn() } },
    'react/jsx-runtime': { jsx: element, jsxs: element }, 'react-native': { View: 'view' },
    '@/components/SourceSelector': 'source', '../BoardsList': 'boards',
    '@/theme': { BorderWidths: { normal: 1 } }, '@/utils/tools': { createStyle: value => value },
    '../listAction': { handlePlay: (...args) => plays.push(args) }, '@/store/theme/hook': { useTheme: () => ({}) },
    '@/store/leaderboard/state': { sources: ['kw', 'tx', 'bd'], listDetailInfo: { id: 'tx__1', list: [{ id: 'current' }] } },
    '@/core/leaderboard': { getBoardsList: source => { const gate = deferred(); calls.push({ source, ...gate }); return gate.promise } },
  }).default
  bar({ onChangeList: (...args) => changes.push(args), onLoadError: () => assert.fail('unexpected error') }, {})
  source.ref.current = { setSourceList() {} }
  boards.ref.current = { setList() {} }
  handle.setBound('kw', 'kw__removed')
  calls[0].resolve([{ id: 'kw__1' }]); await settle()
  source.onSourceChange('bd')
  source.onSourceChange('tx')
  calls[2].resolve([{ id: 'tx__1' }]); await settle()
  calls[1].resolve([{ id: 'bd__1' }]); await settle()
  assert.deepEqual(changes, [['kw', 'kw__1'], ['tx', 'tx__1']])
  boards.onPlay('tx__2')
  boards.onPlay('tx__1')
  assert.deepEqual(plays, [['tx__2', undefined], ['tx__1', [{ id: 'current' }]]])
  source.onSourceChange('kw')
  cleanup()
  calls[3].resolve([{ id: 'kw__1' }]); await settle()
  assert.equal(changes.length, 2)
})
test('微信跳转仅接受官方登录页提供的授权地址', () => {
  const official = 'https://open.weixin.qq.com/connect/qrconnect?appid=test'
  assert.ok(wechat.isWechatLoginPage(official))
  assert.equal(wechat.isWechatLoginPage('https://open.weixin.qq.com.evil.example/connect/qrconnect'), false)
  assert.equal(wechat.getWechatAppUrl('weixin://dl/business/?t=test', official), 'weixin://dl/business/?t=test')
  assert.equal(wechat.getWechatAppUrl('weixin://dl/business/?t=test', 'https://example.com'), null)
  assert.equal(wechat.getWechatAppUrl('weixin://dl/login/test', official), null)
})
test('二维码导出只读取官方会话图片，携带请求序号，不改变网页位置', () => {
  const messages = []
  const location = { protocol: 'https:', hostname: 'open.weixin.qq.com', pathname: '/connect/qrconnect' }
  const image = { src: 'https://open.weixin.qq.com/connect/qrcode/test', complete: true, naturalWidth: 280 }
  const context = { location, window: { ReactNativeWebView: { postMessage: message => messages.push(JSON.parse(message)) } }, document: {
    querySelectorAll: () => [image],
    createElement: () => ({ getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: () => 'data:image/png;base64,AAAA' }),
  } }
  vm.runInNewContext(wechat.getWechatQrScript(7), context)
  assert.deepEqual(messages[0], { type: 'wechat-qr-image', image: 'data:image/png;base64,AAAA', requestId: 7 })
  image.complete = false
  vm.runInNewContext(wechat.getWechatQrScript(8), context)
  assert.equal(messages[1].type, 'wechat-qr-unavailable')
  location.hostname = 'example.com'
  vm.runInNewContext(wechat.getWechatQrScript(9), context)
  assert.equal(messages.length, 2)
})
