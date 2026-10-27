const test = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

test('设置分类与页头共享状态，返回先回总览，再允许退出设置', () => {
  const state = { lx: { settingActiveId: 'overview' } }
  let subscribe, changes = 0
  const context = { exports: {}, global: state, require: () => ({ useSyncExternalStore: (listener, snapshot) => { subscribe = listener; return snapshot() } }) }
  const source = fs.readFileSync(path.join(__dirname, '../src/store/setting/navigation.ts'), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context)
  const nav = context.exports
  assert.equal(nav.useSettingSection(), 'overview')
  const unsubscribe = subscribe(() => { changes++ })
  nav.selectSettingSection('appearance')
  assert.equal(nav.useSettingSection(), 'appearance')
  nav.selectSettingSection('appearance')
  assert.equal(changes, 1, '重复选择不重绘')
  assert.equal(nav.backToSettingOverview(), true)
  assert.equal(nav.useSettingSection(), 'overview')
  assert.equal(nav.backToSettingOverview(), false)
  nav.selectSettingSection('cloud')
  assert.equal(nav.useSettingSection(), 'cloud', '云端曲库直达入口与分类页同步')
  nav.setSettingTransitioning(true)
  assert.equal(nav.backToSettingOverview(), true)
  assert.equal(nav.useSettingSection(), 'overview', '进入尚未完成时允许立即反向返回')
  assert.equal(nav.backToSettingOverview(), true, '退场期间重复返回只消费事件，不退出总览')
  nav.setSettingTransitioning(false)
  assert.equal(nav.backToSettingOverview(), false)
  unsubscribe()
  nav.selectSettingSection('overview')
  assert.equal(changes, 4, '卸载后的页头不再接收通知')
})

function gestureFixture() {
  const source = fs.readFileSync(path.join(__dirname, '../src/screens/Home/Views/Setting/Vertical/backGesture.ts'), 'utf8')
  const context = { exports: {} }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context)
  const calls = []
  const gesture = context.exports.createSettingsBackGesture({
    preview: (p, edge) => calls.push(['preview', p, edge]),
    cancel: () => calls.push(['cancel']),
    commit: () => calls.push(['commit']),
  })
  return { gesture, calls, send: (phase, progress = 0, edge = 0) => gesture.handle({ phase, progress, edge }) }
}

test('预测性返回取消保留页面，重新侧滑才提交，并忽略重复提交与迟到进度', () => {
  const { calls, send } = gestureFixture()
  send('progress', 0.6)
  assert.equal(calls.length, 0)
  send('start')
  send('progress', 0.5)
  send('cancel')
  send('progress', 0.8)
  assert.deepEqual(calls, [['preview', 0, 0], ['preview', 0.5, 0], ['cancel']])
  send('start', 0, 1)
  send('progress', 1.4, 1)
  send('commit')
  send('commit')
  send('progress', 0.9)
  assert.equal(calls.filter(call => call[0] === 'commit').length, 1)
  assert.deepEqual(calls.at(-2), ['preview', 1, 1])
})

test('失去前台或切换布局时撤销预览；无手势的返回键也只提交一次', () => {
  const { gesture, calls, send } = gestureFixture()
  send('start')
  send('progress', NaN)
  gesture.reset()
  assert.deepEqual(calls, [['preview', 0, 0], ['cancel']])
  send('commit')
  send('commit')
  assert.equal(calls.filter(call => call[0] === 'commit').length, 1)
  gesture.reset()
  send('start')
  gesture.reset(false)
  send('progress', 0.3)
  assert.equal(calls.at(-1)[0], 'preview', '卸载时不启动新的回弹动画')
})
