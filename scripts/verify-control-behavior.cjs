const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function fixture() {
  const events = []
  const input = { clear: () => events.push('clear'), focus: () => events.push('focus') }
  const element = (type, props) => ({ type, props })
  const deps = {
    react: { forwardRef: fn => fn, useRef: () => ({ current: input }), useState: value => [value, () => {}], useCallback: fn => fn, useImperativeHandle: () => {} },
    'react/jsx-runtime': { jsx: element, jsxs: element },
    'react-native': { TextInput: 'Input', View: 'View', StyleSheet: { compose: (a, b) => [a, b] } },
    '@/components/common/Icon': { Icon: 'Icon' }, '@/components/common/Button': 'Button',
    '@/utils/tools': { createStyle: value => value }, '@/store/theme/hook': { useTheme: () => ({}) },
    '@/utils/pixelRatio': { setSpText: value => value }, '@/theme/ui': { Q_UI: { touchSize: 48 } },
  }
  const context = { exports: {}, global: { i18n: { t: value => value } }, require: id => { if (!(id in deps)) throw Error(id); return deps[id] } }
  const source = fs.readFileSync(path.join(__dirname, '../src/components/common/Input.tsx'), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, context)
  return {
    events,
    render: editable => context.exports.default({ editable, clearBtn: true, value: 'query', onChangeText: value => events.push(['change', value]), onClearText: () => events.push('cleared') }),
  }
}
const find = (node, type) => {
  if (!node || typeof node != 'object') return
  if (node?.type == type) return node
  for (const child of [node?.props?.children].flat()) {
    const result = find(child, type)
    if (result) return result
  }
}

test('手机输入框清空后恢复焦点并通知调用方，只读字段不允许清空', () => {
  const f = fixture()
  const editable = find(f.render(true), 'Button')
  assert.equal(editable.props.disabled, false)
  editable.props.onPress()
  assert.deepEqual(f.events, ['clear', 'focus', ['change', ''], 'cleared'])
  f.events.length = 0
  const readonly = find(f.render(false), 'Button')
  assert.equal(readonly.props.disabled, true)
  readonly.props.onPress()
  assert.deepEqual(f.events, [])
})
