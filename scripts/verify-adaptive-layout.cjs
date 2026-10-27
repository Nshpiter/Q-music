const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const context = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/utils/adaptiveLayout.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, context)
const { resolveAdaptiveLayout: layout } = context.exports

test('手机竖屏及键盘弹出保持底栏，不误判成大屏', () => {
  for (const height of [840, 420, 260]) assert.equal(layout(393, height, 'auto', false).wide, false)
  assert.equal(layout(600, 260, 'auto', false).wide, false)
})
test('平板横竖屏均支持侧栏，小分屏自动收回单列', () => {
  for (const [width, height] of [[800, 1280], [1280, 800], [960, 600]]) {
    const result = layout(width, height, 'auto', width > height)
    assert.equal(result.wide, true)
    assert.equal(result.splitLibrary, true)
    assert.ok(width - result.railWidth >= 680)
  }
  assert.equal(layout(480, 800, 'auto', true).wide, false)
})
test('低矮车机和横屏手机保留可用内容宽度', () => {
  for (const width of [600, 640, 800, 1024]) {
    const result = layout(width, 360, 'car', true)
    assert.equal(result.wide, true)
    assert.equal(result.isCar, true)
    assert.equal(result.songRowHeight, 72)
    assert.ok(width - result.railWidth >= 496)
  }
  assert.equal(layout(640, 360, 'auto', true).wide, true)
})
test('设备识别可被显式手机或平板选择覆盖', () => {
  assert.equal(layout(1024, 600, 'auto', true, true).isCar, true)
  const phone = layout(1024, 600, 'phone', true, true)
  assert.equal(phone.wide, false)
  assert.equal(phone.isCar, false)
  const tablet = layout(1024, 600, 'tablet', true, true)
  assert.equal(tablet.wide, true)
  assert.equal(tablet.isCar, false)
  assert.equal(tablet.songRowHeight, 54)
})
test('窄窗口下手动选择大屏模式仍避免挤出屏幕', () => {
  for (const mode of ['tablet', 'car']) assert.equal(layout(393, 840, mode, false).wide, false)
})

test('侧栏布局禁止横向翻页，回到手机底栏恢复可滑动能力；车机始终不滑动切页', () => {
  assert.equal(layout(393, 840, 'auto', false).canSwipePages, true)
  assert.equal(layout(800, 1280, 'tablet', false).canSwipePages, false)
  assert.equal(layout(1280, 800, 'auto', true).canSwipePages, false)
  assert.equal(layout(480, 800, 'auto', true).canSwipePages, true)
  assert.equal(layout(1024, 600, 'phone', true).canSwipePages, true)
  assert.equal(layout(393, 840, 'car', false).canSwipePages, false)
})


test('大屏三种导航位置保留大屏布局，只有侧栏占用内容宽度', () => {
  for (const mode of ['tablet', 'car']) {
    for (const position of ['left', 'right', 'bottom']) {
      const result = layout(800, 600, mode, true, false, position)
      assert.equal(result.wide, true)
      assert.equal(result.navigationPosition, position)
      assert.equal(result.railWidth, position == 'bottom' ? 0 : mode == 'car' ? 104 : 88)
      assert.equal(result.canSwipePages, false)
      assert.equal(result.splitLibrary, true)
    }
  }
})

test('手机及窄分屏忽略保存的侧栏位置，恢复大屏时沿用偏好', () => {
  for (const position of ['left', 'right', 'bottom']) {
    assert.equal(layout(393, 840, 'auto', false, false, position).navigationPosition, 'bottom')
    assert.equal(layout(1024, 600, 'phone', true, false, position).railWidth, 0)
    assert.equal(layout(480, 600, 'tablet', false, false, position).navigationPosition, 'bottom')
    assert.equal(layout(800, 600, 'tablet', true, false, position).navigationPosition, position)
  }
})
