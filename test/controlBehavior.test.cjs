const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { parse } = require('@vue/compiler-sfc')

function load(name) {
  const source = fs.readFileSync(path.join(__dirname, '../src/renderer/components/base', name + '.vue'), 'utf8')
  const { descriptor } = parse(source)
  const context = { exports: {} }
  vm.runInNewContext(ts.transpileModule(descriptor.script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context)
  return context.exports.default
}

test('禁用复选框拒绝键盘切换，单选重复确认不产生变更', () => {
  const component = load('Checkbox')
  const events = []
  const state = { disabled: true, need: false, $refs: { dom_input: { checked: false } }, handleInput: value => events.push(value) }
  component.methods.handleToggle.call(state, {})
  assert.equal(state.$refs.dom_input.checked, false)
  assert.equal(events.length, 0)
  state.disabled = false
  component.methods.handleToggle.call(state, {})
  assert.equal(state.$refs.dom_input.checked, true)
  assert.deepEqual(events, [true])
  state.need = true
  component.methods.handleToggle.call(state, {})
  assert.deepEqual(events, [true])
})

test('下拉名称兼容纯文本、数字及带键值的对象，重复选择不触发变更', () => {
  const component = load('Selection')
  for (const modelValue of ['默认', 0]) {
    assert.equal(component.computed.label.call({ modelValue, itemName: '' }), modelValue)
  }
  assert.equal(component.computed.label.call({ modelValue: 'green', itemName: 'label', list: [{ id: 'green', label: '绿色' }], activeIndex: 0 }), '绿色')
  const events = []
  let hidden = 0
  const state = { itemKey: 'id', modelValue: 'green', $emit: (...args) => events.push(args), handleHide: () => hidden++ }
  component.methods.handleClick.call(state, { id: 'green' })
  assert.equal(events.length, 0)
  assert.equal(hidden, 1)
  component.methods.handleClick.call(state, { id: 'blue' })
  assert.equal(events.length, 2)
})
