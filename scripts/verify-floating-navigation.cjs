const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
function load(name) {
  const context = { exports: {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/utils', name), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context)
  return context.exports
}
const { floatingPosition, snapFloatingPosition } = load('floatingNavigation.ts')
const { resolveAdaptiveLayout } = load('adaptiveLayout.ts')
test('悬浮导航可左右吸附、保存相对高度，旋转后保持可见', () => {
  const left = snapFloatingPosition(60, 180, 393, 600, 64, 44)
  assert.equal(left.side, 'left')
  assert.equal(left.x, 12)
  const right = snapFloatingPosition(1000, 1000, 393, 600, 64, 44)
  assert.equal(right.side, 'right')
  assert.equal(right.x, 317)
  assert.equal(right.y, 556)
  assert.equal(right.offset, 1)
  const rotated = floatingPosition(800, 240, 64, 220, right.side, right.offset)
  assert.equal(rotated.y, 20)
  assert.equal(rotated.x, 724)
})
test('面板变高、窄分屏和非法保存值都不会产生负坐标或 NaN', () => {
  for (const offset of [-1, 2, NaN, Infinity]) {
    const point = floatingPosition(240, 80, 64, 220, 'right', offset)
    assert.equal(point.y, 0)
    assert.ok(Number.isFinite(point.x))
  }
  const point = snapFloatingPosition(-1, -100, 240, 80, 64, 220)
  assert.equal(point.y, 0)
  assert.equal(point.offset, 0.5)
})
test('展开保持手柄位置，靠近底部只移动必要距离，收起恢复锚点', () => {
  const collapsed = floatingPosition(393, 600, 64, 44, 'left', 0.3, 44)
  const expanded = floatingPosition(393, 600, 64, 276, 'left', 0.3, 44)
  assert.equal(expanded.y, collapsed.y)
  assert.equal(floatingPosition(393, 600, 64, 276, 'left', 1, 44).y, 324)
  const moved = snapFloatingPosition(20, 200, 393, 600, 64, 276, 44)
  assert.equal(floatingPosition(393, 600, 64, 44, moved.side, moved.offset, 44).y, 200)
})
test('悬浮模式释放侧栏宽度并禁用横向翻页，关闭后恢复原导航', () => {
  for (const [w, h, mode] of [[393, 800, 'phone'], [800, 600, 'tablet'], [800, 360, 'car']]) {
    const result = resolveAdaptiveLayout(w, h, mode, w > h, false, 'right', true)
    assert.equal(result.navigationPosition, 'floating')
    assert.equal(result.railWidth, 0)
    assert.equal(result.canSwipePages, false)
    assert.equal(resolveAdaptiveLayout(w, h, mode, w > h, false, 'right', false).navigationPosition, mode === 'phone' ? 'bottom' : 'right')
  }
})
