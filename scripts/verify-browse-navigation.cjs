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
const song = name => ({ list: [{ id: name }], limit: 30, total: 1, source: 'kw' })

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
    '@/store/songlist/state': {}, '@/store/songlist/action': {}, '@/utils': {}, './browseRequest': timeout,
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
