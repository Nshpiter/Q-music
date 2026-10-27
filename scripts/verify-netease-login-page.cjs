// 驱动实际 LoginPage 的 WebView/前后台事件；不需要设备，也不使用真实账号。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const vm = require('node:vm')
const root = path.join(__dirname, '..')
function load(file, dependencies = {}, extra = {}) {
  const context = { exports: {}, ...extra, require: name => {
    if (name in dependencies) return dependencies[name]
    throw Error(name)
  } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText, context)
  return context.exports
}
const login = load('src/core/musicAccount/login.ts')
const bridge = load('src/core/musicAccount/qqAuthorization.ts')
function mount(provider) {
  const effects = [], state = [], scripts = [], links = [], timers = new Map(), events = {}
  let timer = 0, refreshed = 0
  const jsx = (type, props) => ({ type, props })
  const native = { View: 'View', ActivityIndicator: 'Spinner', Platform: { OS: 'android', Version: 35 },
    StyleSheet: { create: value => value },
    AppState: { currentState: 'active', addEventListener: (_, fn) => { events.resume = fn; return { remove() {} } } },
    Linking: { addEventListener: (_, fn) => { events.link = fn; return { remove() {} } }, openURL: async url => { links.push(url) } },
  }
  const deps = {
    react: {
      useCallback: fn => fn,
      useEffect: fn => effects.push(fn),
      useRef: value => ({ current: value }),
      useState: value => { const index = state.push(value) - 1; return [value, next => { state[index] = typeof next == 'function' ? next(state[index]) : next }] },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': native,
    'react-native-webview': { WebView: 'WebView' },
    '@/components/common/Text': { default: 'Text' },
    '@/components/common/Button': { default: 'Button' },
    '@/components/common/Icon': { Icon: 'Icon' },
    '@/lang': { useI18n: () => key => key },
    '@/store/theme/hook': { useTheme: () => ({}) },
    '@/core/musicAccount/login': login,
    '@/core/musicAccount/qqAuthorization': bridge,
    '@/core/musicAccount/dailyAuthorization': {},
    '@/core/musicAccount/wechatAuthorization': { isWechatLoginPage: () => false },
  }
  const Page = load('src/screens/MusicAccount/LoginPage.tsx', deps, {
    setTimeout: fn => { timers.set(++timer, fn); return timer }, clearTimeout: id => timers.delete(id),
    setInterval: () => ++timer, clearInterval() {},
  }).default
  const tree = Page({ provider, connected: false, onConnected: () => { refreshed++ } })
  function find(node) {
    if (!node) return
    if (node.type == 'WebView') return node.props
    for (const child of [node.props?.children].flat()) { const found = find(child); if (found) return found }
  }
  const web = find(tree)
  web.ref.current = { injectJavaScript: script => scripts.push(script) }
  const cleanup = effects.map(fn => fn()).filter(Boolean)
  return { web, scripts, links, state, events, timers, cleanup, get refreshed() { return refreshed } }
}

for (const provider of ['wy', 'tx']) test(`${provider} 的 QQ 一键登录保留官方轮询并在回前台后续接`, () => {
  const page = mount(provider)
  page.web.onLoadEnd()
  assert.ok(page.scripts.includes(bridge.QQ_AUTH_BRIDGE))
  assert.equal(page.web.onShouldStartLoadWithRequest({ url: 'wtloginmqq://ptlogin/qlogin?p=fixture' }), false)
  assert.equal(page.scripts.at(-1), bridge.QQ_START_AUTH)
  assert.equal(page.links.length, 0, '不能跳进旧的浏览器授权分支')
  const message = (type, url, origin = 'https://xui.ptlogin2.qq.com') => page.web.onMessage({ nativeEvent: { url: origin, data: JSON.stringify({ type, url }) } })
  message('qq-pending')
  message('qq-open', 'wtloginmqq://ptlogin/qlogin?qrcode=fixture')
  assert.equal(page.links.length, 1)
  assert.equal(new URL(page.links[0]).searchParams.get('schemacallback'), login.QQ_RETURN)
  page.events.resume('active')
  assert.equal(page.scripts.at(-1), bridge.QQ_RESUME_AUTH)
  page.events.link({ url: login.QQ_RETURN })
  assert.equal(page.scripts.at(-1), bridge.QQ_RESUME_AUTH)
  message('qq-open', 'wtloginmqq://ptlogin/qlogin?qrcode=foreign', 'https://example.com')
  assert.equal(page.links.length, 1)
  for (const fn of page.timers.values()) fn()
  assert.ok(page.refreshed > 0, '回前台后检查 WebView Cookie，推动账号状态更新')
  page.cleanup.forEach(fn => fn())
})

test('网易第三方授权 HTTP 回调在原 WebView 升级 HTTPS，参数原样保留', () => {
  const page = mount('wy')
  const callback = 'http://music.163.com/back/qq?code=fixture%2Bcode&state=unchanged'
  assert.equal(page.web.onShouldStartLoadWithRequest({ url: callback }), false)
  assert.ok(page.state.includes(callback.replace('http:', 'https:')))
  page.web.onOpenWindow({ nativeEvent: { targetUrl: callback } })
  assert.equal(page.links.length, 0)
  page.cleanup.forEach(fn => fn())
})
