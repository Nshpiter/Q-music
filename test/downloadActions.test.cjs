const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

test('下载分类数量随任务流转，等待任务和下载中任务共用一个筛选', () => {
  const vue = require('vue')
  const context = { exports: {}, window: { i18n: { t: key => key } }, require: id => {
    if (id == '@common/utils/vueTools') return vue
    if (id == '@renderer/store/download/state') return { downloadStatus: { RUN: 'run', WAITING: 'waiting', PAUSE: 'pause', ERROR: 'error', COMPLETED: 'completed' } }
    throw Error(id)
  } }
  const source = fs.readFileSync(path.join(__dirname, '../src/renderer/views/Download/useTab.js'), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
  const tasks = vue.ref([{ status: 'waiting' }, { status: 'run' }, { status: 'pause' }])
  const { tabs, activeTab, list } = context.exports.default(tasks)
  const label = id => tabs.value.find(tab => tab.id == id).label
  activeTab.value = 'running'
  assert.equal(list.value.length, 2)
  assert.equal(label('running'), 'download__running (2)')
  tasks.value[1].status = 'completed'
  assert.equal(list.value.length, 1)
  assert.equal(label('finished'), 'download__finished (1)')
  activeTab.value = 'finished'
  assert.equal(list.value[0], tasks.value[1])
  tasks.value.splice(1, 1)
  assert.equal(list.value.length, 0)
  assert.equal(label('all'), 'download__all (2)')
})

function fixture(createDownloadTasks, list = [{ id: 'online', source: 'tx' }, { id: 'local', source: 'local' }]) {
  const source = require('@vue/compiler-sfc').parse(fs.readFileSync(path.join(__dirname, '../src/renderer/components/common/DownloadMultipleModal.vue'), 'utf8')).descriptor.script.content
  const context = { exports: {}, require: id => {
    if (id == '@renderer/store/download/action') return { createDownloadTasks }
    if (id == './DownloadQualityOptions.vue') return {}
    throw Error(id)
  } }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context)
  const component = context.exports.default
  const events = []
  const instance = { ...component.data(), list, listId: 'playlist', $emit: (...args) => events.push(args) }
  Object.defineProperty(instance, 'onlineList', { get: () => component.computed.onlineList.call(instance) })
  for (const [name, fn] of Object.entries(component.methods)) instance[name] = fn.bind(instance)
  return { instance, events }
}

test('批量下载在保存结束前保持弹窗并禁止重复提交，跳过本地歌曲', async() => {
  let resolve
  const requests = []
  const { instance, events } = fixture((...args) => {
    requests.push(args)
    return new Promise(done => { resolve = done })
  })
  const saving = instance.handleClick('flac')
  await instance.handleClick('320k')
  instance.handleClose()
  assert.equal(instance.working, true)
  assert.equal(events.length, 0)
  assert.equal(requests.length, 1)
  assert.deepEqual(Array.from(requests[0][0], song => song.id), ['online'])
  assert.equal(requests[0][1], 'flac')
  assert.equal(requests[0][2], 'playlist')
  resolve()
  await saving
  assert.equal(instance.working, false)
  assert.deepEqual(events, [['update:show', false], ['confirm']])
})

test('批量下载保存失败不报告成功，允许修正后再次提交', async() => {
  let failed = true
  const { instance, events } = fixture(async() => { if (failed) throw Error('disk unavailable') })
  await instance.handleClick('flac')
  assert.equal(instance.error, true)
  assert.equal(instance.working, false)
  assert.equal(events.length, 0)
  failed = false
  await instance.handleClick('128k')
  assert.equal(instance.error, false)
  assert.deepEqual(events, [['update:show', false], ['confirm']])
})

test('全为本地歌曲时不创建无意义的下载任务', async() => {
  const { instance, events } = fixture(() => { assert.fail('must not download local files') }, [{ source: 'local' }])
  await instance.handleClick('flac')
  assert.equal(events.length, 0)
  instance.handleClose()
  assert.deepEqual(events, [['update:show', false]])
})

function menuFixture() {
  const vue = require('vue')
  const scope = vue.effectScope()
  const items = vue.ref([
    { id: 'first', status: 'run', metadata: { musicInfo: { source: 'tx' } } },
    { id: 'second', status: 'run', metadata: { musicInfo: { source: 'tx' } } },
  ])
  const list = vue.computed(() => [...items.value])
  const activeTab = vue.ref('runing')
  const calls = []
  const context = { exports: {}, require: id => {
    if (id == '@common/utils/vueTools') return vue
    if (id == '@renderer/utils/musicSdk') return { default: { tx: {} } }
    if (id == '@renderer/plugins/i18n') return { useI18n: () => key => key }
    if (id == '@common/constants') return { DOWNLOAD_STATUS: { ERROR: 'error', PAUSE: 'pause' } }
    throw Error(id)
  } }
  const source = fs.readFileSync(path.join(__dirname, '../src/renderer/views/Download/useMenu.js'), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context)
  const menu = scope.run(() => context.exports.default({ list, activeTab, isSelectionMode: vue.ref(false), selectedList: vue.ref([]), selectFromMenu: index => calls.push('select:' + list.value[index]?.id), handleRemoveTask: index => calls.push(list.value[index]?.id) }))
  return { menu, list: items, activeTab, calls, tick: vue.nextTick, stop: () => scope.stop() }
}

test('右键菜单操作当前任务，列表重排后旧菜单不能操作另一首歌', async() => {
  const f = menuFixture()
  try {
    f.menu.showMenu({ pageX: 0, pageY: 0 }, f.list.value[0])
    await f.tick()
    assert.equal(f.menu.isShowItemMenu.value, true)
    const select = f.menu.menus.value.find(item => item.action === 'select' && !item.hide && !item.disabled)
    assert.ok(select)
    f.menu.menuClick(select)
    assert.deepEqual(f.calls, ['select:first'])
    f.menu.showMenu({ pageX: 0, pageY: 0 }, f.list.value[0])
    await f.tick()
    f.menu.menuClick({ action: 'remove' })
    assert.deepEqual(f.calls, ['select:first', 'first'])
    f.menu.showMenu({ pageX: 0, pageY: 0 }, f.list.value[0])
    await f.tick()
    f.list.value.reverse()
    assert.equal(f.menu.isShowItemMenu.value, false)
    assert.equal(f.menu.rightClickSelectedIndex.value, -1)
    f.menu.menuClick({ action: 'remove' })
    assert.deepEqual(f.calls, ['select:first', 'first'])
  } finally { f.stop() }
})

test('下载状态变化或切换分类会取消尚未显示的菜单', async() => {
  const f = menuFixture()
  try {
    f.menu.showMenu({ pageX: 0, pageY: 0 }, f.list.value[0])
    f.list.value[0].status = 'completed'
    await f.tick()
    assert.equal(f.menu.isShowItemMenu.value, false)
    f.menu.menuClick({ action: 'remove' })
    f.menu.showMenu({ pageX: 0, pageY: 0 }, f.list.value[1])
    f.activeTab.value = 'all'
    await f.tick()
    assert.equal(f.menu.isShowItemMenu.value, false)
    assert.equal(f.menu.rightClickSelectedIndex.value, -1)
    f.menu.menuClick({ action: 'remove' })
    assert.deepEqual(f.calls, [])
  } finally { f.stop() }
})

test('移除全部下载时，同步菜单监听不读取删除中的数组空位', async() => {
  const f = menuFixture()
  try {
    f.menu.showMenu({ pageX: 0, pageY: 0 }, f.list.value[0])
    await f.tick()
    assert.doesNotThrow(() => f.list.value.splice(0, f.list.value.length))
    assert.equal(f.menu.isShowItemMenu.value, false)
    assert.equal(f.menu.rightClickSelectedIndex.value, -1)
  } finally { f.stop() }
})
