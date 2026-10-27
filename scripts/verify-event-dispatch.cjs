const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const context = { exports: {}, setImmediate }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/event/Event.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, context)
const Event = context.exports.default
const flush = () => new Promise(resolve => setImmediate(resolve))

test('布局回调退订和新订阅不跳过本轮其他控件，也不重复通知新控件', async() => {
  const event = new Event()
  const calls = []
  const late = () => calls.push('late')
  const layout = () => {
    calls.push('layout')
    event.off('config', layout)
    event.on('config', late)
  }
  event.on('config', layout)
  event.on('config', value => calls.push(value))
  event.emit('config', 'control')
  await flush()
  assert.deepEqual(calls, ['layout', 'control'])
  event.emit('config', 'next')
  await flush()
  assert.deepEqual(calls, ['layout', 'control', 'next', 'late'])
})
