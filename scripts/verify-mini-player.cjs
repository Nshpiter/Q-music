const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function renderPlayer() {
  let compact = false
  const element = (type, props) => ({ type, props })
  const deps = {
    react: { memo: fn => fn, useMemo: fn => fn(), useState: () => [compact, value => { compact = value }] },
    'react/jsx-runtime': { jsx: element, jsxs: element },
    'react-native': { Image: 'Image', View: 'View', StyleSheet: { create: value => value } },
    '@/utils/hooks': { useKeyboard: () => ({ keyboardShown: false }) },
    './components/Pic': 'Pic', './components/Title': 'Title', './components/PlayInfo': 'PlayInfo', './components/ControlBtn': 'ControlBtn',
    '@/store/setting/hook': { useSettingValue: () => false },
    '@/theme/ui': { Q_UI: { radius: { miniPlayer: 22 } } },
    '@/store/player/hook': { usePlayerMusicInfo: () => ({ id: 'test', pic: 'cover.jpg' }) },
    '@/components/common/GlassSurface': 'GlassSurface',
    '@/components/common/Image': { defaultHeaders: {} },
    '@/utils/hooks/useAdaptiveLayout': () => ({ isCar: false, wide: false }),
  }
  const context = { exports: {}, require: id => { if (!(id in deps)) throw Error(id); return deps[id] } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/components/player/PlayerBar/index.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, context)
  return context.exports.default
}

test('标准显示、小显示和折叠窄屏始终保留封面，按钮与曲目信息不重叠', () => {
  const render = renderPlayer()
  for (const width of [316, 344, 280, 252, 316]) {
    render({}).props.onLayout({ nativeEvent: { layout: { width } } })
    const surface = render({})
    const row = surface.props.children.find(child => child?.props?.style?.flexDirection === 'row')
    assert.equal(row.props.children[0].type, 'Pic', `封面在 ${width}dp 不应被隐藏`)
    const [cover, info, controls] = row.props.children
    assert.equal(cover.type, 'Pic')
    assert.equal(info.props.style.minWidth, 0)
    const controlsWidth = controls.props.style[1].width
    assert.ok(width - 16 - 34 - 12 - controlsWidth >= 64, `${width}dp 应保留至少 64dp 的歌曲文字空间`)
    assert.equal(controls.props.children.props.compact, width < 288)
  }
})
