// 授权会话回归：原 WebView 保持轮询，QQ 回来后续接，失败/超时不遗留定时器。
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const exportsContext = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/core/musicAccount/qqAuthorization.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, exportsContext)
const { QQ_AUTH_BRIDGE, QQ_START_AUTH, QQ_RESUME_AUTH, QQ_STOP_AUTH, isQQLoginPage } = exportsContext.exports

function browser(hostname = 'ssl.ptlogin2.qq.com') {
  const messages = [], polls = [], requests = [], events = {}, timers = new Map(), intervals = new Set()
  let clock = 0
  const qr = {
    done: false,
    get(type) { requests.push(type) },
    polling(ticket) {
      polls.push(ticket)
      intervals.delete(this.clock)
      this.clock = ++clock
      intervals.add(this.clock)
    },
  }
  const context = vm.createContext({
    location: { protocol: 'https:', hostname },
    window: {
      pt: { qrcode: qr },
      ReactNativeWebView: { postMessage: value => messages.push(JSON.parse(value)) },
      addEventListener: (name, fn) => { events[name] = fn },
    },
    document: { addEventListener: (name, fn) => { events[name] = fn } },
    setTimeout: fn => { timers.set(++clock, fn); return clock },
    clearTimeout: id => timers.delete(id),
    clearInterval: id => intervals.delete(id),
  })
  return { context, messages, polls, requests, events, timers, intervals, qr, run: script => vm.runInContext(script, context) }
}

const page = browser()
page.run(QQ_AUTH_BRIDGE)
const bridge = page.context.window.__qmusicQQ
page.run(QQ_AUTH_BRIDGE)
assert.equal(page.context.window.__qmusicQQ, bridge, '重复加载不能叠加处理器')
page.events.click({ target: { closest: () => true }, preventDefault() {}, stopImmediatePropagation() {} })
page.run(QQ_START_AUTH)
assert.deepEqual(page.requests, [1], '一次授权仅创建一个官方二维码会话')
page.qr.polling('https://ssl.ptlogin2.qq.com/ptqr?test=a+b&k=fixture')
assert.deepEqual(page.polls, [undefined], '官方轮询保留，打开浏览器的分支不执行')
assert.equal(page.messages[0].type, 'qq-pending')
const launch = new URL(page.messages[1].url)
assert.equal(launch.searchParams.get('qrcode'), 'https://ssl.ptlogin2.qq.com/ptqr?test=a+b&k=fixture')
page.run(QQ_RESUME_AUTH)
assert.equal(page.polls.length, 2, '前台恢复原会话')
assert.equal(page.intervals.size, 1, '恢复不能堆积轮询')
page.qr.done = true
page.run(QQ_RESUME_AUTH)
assert.equal(page.polls.length, 2, '授权完成不再重新开始轮询')
page.events.pagehide()
assert.equal(page.intervals.size, 0)
assert.equal(page.timers.size, 0)

const expiry = browser()
expiry.run(QQ_START_AUTH)
expiry.qr.polling('fixture')
Array.from(expiry.timers.values())[0]()
assert.equal(expiry.messages.at(-1).type, 'qq-expired')
assert.equal(expiry.intervals.size, 0)
const messagesAfterExpiry = expiry.messages.length
expiry.qr.polling('late-ticket')
assert.equal(expiry.messages.length, messagesAfterExpiry, '超时后的旧响应不能再次打开客户端')
assert.equal(expiry.intervals.size, 0)
expiry.run(QQ_START_AUTH)
assert.equal(expiry.requests.length, 2, '超时后允许重新授权')
expiry.run(QQ_STOP_AUTH)
assert.equal(expiry.timers.size, 0)

const failure = browser()
failure.qr.get = () => { throw Error('unavailable') }
failure.run(QQ_START_AUTH)
assert.equal(failure.messages.at(-1).type, 'qq-unavailable')
assert.equal(failure.timers.size, 0)
const absent = browser()
delete absent.context.window.pt
absent.run(QQ_START_AUTH)
assert.equal(absent.messages.at(-1).type, 'qq-unavailable')
const foreign = browser('example.com')
foreign.run(QQ_AUTH_BRIDGE)
assert.equal(foreign.context.window.__qmusicQQ, undefined)
for (const url of ['http://ssl.ptlogin2.qq.com/', 'https://ssl.ptlogin2.qq.com.evil.test/', 'https://ssl.ptlogin2.qq.com@evil.test/']) assert.equal(isQQLoginPage(url), false)
assert.equal(isQQLoginPage('https://ssl.ptlogin2.qq.com/login'), true)
assert.equal(isQQLoginPage('https://xui.ptlogin2.qq.com/cgi-bin/xlogin'), true)
assert.equal(isQQLoginPage('https://xui.ptlogin2.qq.com'), true, '新版 WebView 的 origin 没有路径')
assert.equal(isQQLoginPage('https://ssl.ptlogin2.qq.com:443'), true)
const currentOfficialPage = browser('xui.ptlogin2.qq.com')
currentOfficialPage.context.window.pt.clickEvent = 'touchstart'
currentOfficialPage.run(QQ_AUTH_BRIDGE)
currentOfficialPage.events.touchstart({ target: { closest: () => true }, preventDefault() {}, stopImmediatePropagation() {} })
currentOfficialPage.events.click({ target: { closest: () => true }, preventDefault() {}, stopImmediatePropagation() {} })
assert.deepEqual(currentOfficialPage.requests, [1])
console.log('PASS: official QR session, preserved polling, foreground resume, duplicate tap, expiry, retry, cleanup and trusted origin')
