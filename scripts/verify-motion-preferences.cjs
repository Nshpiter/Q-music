const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function fixture() {
  const states = [], effects = [], pending = [], events = {}
  let cursor = 0, performanceMode = false
  const modules = {
    react: {
      useState(initial) {
        const index = cursor++
        if (!(index in states)) states[index] = initial
        return [states[index], value => { states[index] = value }]
      },
      useEffect(effect) {
        const index = cursor++
        if (!(index in effects)) effects[index] = effect()
      },
    },
    'react-native': {
      AccessibilityInfo: {
        addEventListener: (name, callback) => { events[name] = callback },
        isReduceMotionEnabled: () => new Promise((resolve, reject) => { pending.push({ resolve, reject }) }),
      },
      AppState: { addEventListener: (name, callback) => { events[name] = callback } },
    },
    '@/store/setting/hook': { useSettingValue: () => performanceMode },
  }
  const context = { exports: {}, require: name => modules[name] }
  const source = fs.readFileSync(path.join(__dirname, '../src/utils/useMotion.ts'), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context)
  return {
    events, pending,
    render(performance = false) {
      performanceMode = performance
      cursor = 0
      return { interaction: context.exports.useInteractionMotion(), decoration: context.exports.useMotion() }
    },
  }
}

const flush = async () => { await new Promise(resolve => setImmediate(resolve)) }

test('流畅模式保留交互反馈，同时减少装饰动画；系统减少动画同时限制两者', async () => {
  const f = fixture()
  assert.deepEqual(f.render(), { interaction: false, decoration: false })
  assert.equal(f.pending.length, 1, '多个控件共享一次系统查询')
  f.pending.shift().resolve(false)
  await flush()
  assert.deepEqual(f.render(), { interaction: true, decoration: true })
  assert.deepEqual(f.render(true), { interaction: true, decoration: false })
  f.events.reduceMotionChanged(true)
  assert.deepEqual(f.render(true), { interaction: false, decoration: false })
  f.events.reduceMotionChanged(false)
  assert.deepEqual(f.render(true), { interaction: true, decoration: false })
})

test('系统查询失败后在回到前台时重试，过期查询不能覆盖新的系统事件', async () => {
  const f = fixture()
  f.render()
  f.pending.shift().reject(new Error('temporary native failure'))
  await flush()
  f.events.change('background')
  assert.equal(f.pending.length, 0)
  f.events.change('active')
  f.pending.shift().resolve(false)
  await flush()
  assert.equal(f.render().interaction, true)
  f.events.change('active')
  f.events.reduceMotionChanged(true)
  f.pending.shift().resolve(false)
  await flush()
  assert.equal(f.render().interaction, false, '查询前收到的系统事件应优先')
  f.events.change('active')
  f.pending.shift().resolve(false)
  await flush()
  assert.equal(f.render().interaction, true, '没有系统事件时仍能在恢复前台后刷新')
})
