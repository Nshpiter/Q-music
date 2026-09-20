// 无设备的授权路由回归检查：node scripts/verify-music-login.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const source = fs.readFileSync(path.join(__dirname, '../src/core/musicAccount/login.ts'), 'utf8')
const context = { exports: {} }
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context)
const { LOGIN_URLS, QQ_CALLBACK, QQ_RETURN, isQQCallback, getQQCallbackUrl, getLoginAppUrl } = context.exports

const entry = new URL(LOGIN_URLS.tx)
assert.equal(entry.hostname, 'graph.qq.com')
assert.equal(entry.searchParams.get('response_type'), 'code')
const redirect = new URL(entry.searchParams.get('redirect_uri'))
assert.equal(redirect.origin, 'https://y.qq.com')
assert.equal(redirect.pathname, '/portal/wx_redirect.html')
assert.equal(redirect.searchParams.get('login_type'), '1')

const target = 'https://ssl.ptlogin2.qq.com/jump?ticket=a%2Bb%3D&u1=https%3A%2F%2Fy.qq.com%2F'
assert.equal(getQQCallbackUrl(QQ_CALLBACK + target), target)
assert.equal(getQQCallbackUrl(QQ_CALLBACK + encodeURIComponent(target)), target)
for (const rejected of [
  'http://y.qq.com/', 'https://qq.com.evil.example/', 'https://evil.example/?qq.com',
  'https://qq.com@evil.example/', 'https://y.qq.com:444/', 'javascript:alert(1)',
  'file:///sdcard/private', 'intent://ptlogin/', '%E0%A4%A',
  'https://qq.com\\@evil.example/', 'https://qq.com\n.evil.example/',
]) assert.equal(getQQCallbackUrl(QQ_CALLBACK + rejected), null, rejected)
assert.equal(getQQCallbackUrl('qmusic://music/play?url=' + target), null)

const login = 'wtloginmqq://ptlogin/qlogin?p=appid%3D716027609%26nonce%3Da%253Db&schemacallback=googlechrome%3A%2F%2F'
const routed = new URL(getLoginAppUrl(login, 'tx'))
assert.equal(routed.searchParams.get('p'), new URL(login).searchParams.get('p'))
assert.equal(routed.searchParams.get('schemacallback'), QQ_CALLBACK)
assert.equal(routed.searchParams.getAll('schemacallback').length, 1)
const qr = new URL(getLoginAppUrl('wtloginmqq://ptlogin/qlogin?qrcode=test%2Bticket&schemacallback=weixin%3A%2F%2F&schemacallback=googlechrome%3A%2F%2F', 'tx'))
assert.equal(qr.searchParams.get('qrcode'), 'test+ticket')
assert.equal(qr.searchParams.get('schemacallback'), QQ_RETURN)
assert.equal(qr.searchParams.getAll('schemacallback').length, 1)
assert.equal(isQQCallback(QQ_RETURN), true)
assert.equal(isQQCallback(QQ_RETURN + '-other'), false)
// 网易云官方页也提供 QQ 登录，应继续走同一套客户端回跳逻辑。
assert.equal(getLoginAppUrl(login, 'wy'), getLoginAppUrl(login, 'tx'))
assert.equal(getLoginAppUrl('orpheus://login', 'tx'), null)
assert.equal(getLoginAppUrl('intent://arbitrary#Intent;end', 'tx'), null)
assert.equal(getLoginAppUrl('wtloginmqq://other/action?p=1', 'tx'), null)
assert.equal(getLoginAppUrl('orpheus://login', 'wy'), 'orpheus://login')
console.log('PASS: official OAuth entry, callback encoding, origin restrictions, app routing and session preservation')
