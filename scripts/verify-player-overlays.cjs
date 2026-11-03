const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function harness(file, more = {}) {
  const slots = [], effects = [], listeners = new Map()
  let cursor = 0
  const ref = { current: null }
  const element = (type, props, key) => ({ type, props, key })
  const react = {
    forwardRef: fn => fn,
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial == 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value == 'function' ? value(slots[i]) : value }] },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial } },
    useMemo: fn => fn(), useCallback: fn => fn,
    useImperativeHandle: (target, fn) => { target.current = fn() },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((d, j) => d !== slots[i].deps[j])) effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() } }) },
  }
  const deps = {
    react, 'react/jsx-runtime': { jsx: element, jsxs: element },
    'react-native': {
      Platform: { OS: 'android' }, View: 'View', ScrollView: 'ScrollView', Pressable: 'Pressable', Modal: 'NativeModal',
      StyleSheet: { create: value => value },
      AppState: { addEventListener: (_, fn) => { listeners.set('app', fn); return { remove: () => listeners.delete('app') } } },
      Animated: { View: 'AnimatedView', Value: class { stopAnimation() {} setValue() {} interpolate() {} }, spring: () => ({ start() {} }) },
    },
    'react-native-navigation': { Navigation: { events: () => ({ registerComponentDidDisappearListener: fn => { listeners.set('page', fn); return { remove: () => listeners.delete('page') } } }) } },
    '@/store/common/hook': { useStatusbarHeight: () => 24 },
    '@/utils/useMotion': { useMotion: () => true },
    '@/theme/ui': { Q_UI: { motion: { settle: {}, press: {} } } },
    './DockInset': { DockInsetContext: { Provider: 'Provider' } },
    ...more,
  }
  const context = { exports: {}, require: id => { if (!(id in deps)) throw Error(id); return deps[id] } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, context)
  return { ref, listeners, render(props = {}) { cursor = 0; const result = context.exports.default(props, ref); while (effects.length) effects.shift()(); return result } }
}

test('Android 隐藏弹窗卸载原生 Dialog，反复开关不保留可恢复的宿主', () => {
  const h = harness('src/components/common/Modal.tsx')
  let hides = 0
  const props = { onHide: () => hides++ }
  assert.equal(h.render(props), null)
  for (let i = 0; i < 5; i++) {
    h.ref.current.setVisible(true)
    assert.equal(h.render(props).type, 'NativeModal')
    h.ref.current.setVisible(false)
    assert.equal(h.render(props), null)
    h.ref.current.setVisible(false)
  }
  assert.equal(hides, 5)
})

test('临时面板进入后台或离开页面后关闭，回前台不重开；一般弹窗不强制清空', () => {
  const h = harness('src/components/common/Modal.tsx')
  const props = { transient: true }
  h.render(props); h.ref.current.setVisible(true); h.render(props)
  h.listeners.get('app')('background')
  assert.equal(h.render(props), null)
  h.listeners.get('app')('active')
  assert.equal(h.render(props), null)
  h.ref.current.setVisible(true); h.render(props)
  h.listeners.get('page')({ componentId: 'detail' })
  assert.equal(h.render(props), null)
  h.render({ transient: false })
  assert.equal(h.listeners.size, 0)
})

test('播放设置关闭后清理子面板，不留下下一帧回调重开；再次打开仍正常', () => {
  const noop = () => null
  const h = harness('src/screens/PlayDetail/components/SettingPopup/index.tsx', {
    '@/components/common/Popup': 'Popup', '@/lang': { useI18n: () => key => key },
    './settings/SettingLyricProgress': noop, './settings/SettingVolume': noop, './settings/SettingPlaybackRate': noop,
    './settings/SettingLrcFontSize': noop, './settings/SettingLrcAlign': noop, './settings/SettingPlayQuality': noop,
    '@/components/player/PlayerStyleSelector': noop, '@/components/player/LyricFontSelector': noop,
  })
  assert.equal(h.render({}), null)
  h.ref.current.show()
  const open = h.render({})
  assert.equal(open.type, 'Popup')
  assert.equal(open.props.transient, true)
  open.props.onHide()
  assert.equal(h.render({}), null)
  h.ref.current.show()
  assert.equal(h.render({}).type, 'Popup')
})

test('播放按钮仅纵向扩张热区，横向不进入相邻按钮；切换图标保持回调', () => {
  const h = harness('src/components/player/TransportButton.tsx', {
    '@/components/common/Button': 'Button', '@/components/common/Icon': { Icon: 'Icon' },
    '@/store/theme/hook': { useTheme: () => ({ 'q-text-primary': '#fff', 'c-content-background': '#000' }) },
  })
  let presses = 0
  for (const size of [40, 44, 48, 56]) {
    for (const icon of ['prevMusic', 'play', 'pause', 'nextMusic']) {
      const button = h.render({ size, icon, label: icon, onPress: () => presses++ })
      assert.equal(button.props.hitSlop.left, 0)
      assert.equal(button.props.hitSlop.right, 0)
      assert.equal(button.props.pressRetentionOffset.left, 0)
      assert.equal(button.props.pressRetentionOffset.right, 0)
      button.props.onPress()
    }
  }
  assert.equal(presses, 16)
})
