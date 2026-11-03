const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const root = path.resolve(__dirname, '..')
const file = fs.existsSync(path.join(root, 'src/core/player/session.ts')) ? 'src/utils/playbackSession.ts' : 'src/common/utils/playbackSession.ts'
const context = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file),'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
const { PlaybackSession } = context.exports
test('队列排序不改原歌单；无效移动保持队列；切换列表后清除排序', () => {
  const session = new PlaybackSession(), source = ['a', 'b', 'c']
  assert.equal(session.list(null, source), source)
  assert.equal(session.reorder('list', source, 2, 0), true)
  assert.deepEqual(source, ['a', 'b', 'c'])
  assert.deepEqual(Array.from(session.list('list', source)), ['c', 'a', 'b'])
  assert.equal(session.list('other', source), source)
  assert.equal(session.reorder('list', source, -1, 0), false)
  session.reset()
  assert.equal(session.list('list', source), source)
})
test('重复插播保留独立历史；回听后的新选择截断旧前进路线；历史有界', () => {
  const session = new PlaybackSession()
  for (const item of ['a', 'x', 'x', 'b']) session.record(item)
  assert.equal(session.back(), 'x')
  assert.equal(session.back(), 'x')
  assert.equal(session.forward(), 'x')
  session.record('new')
  assert.deepEqual(Array.from(session.history), ['a', 'x', 'x', 'new'])
  assert.equal(session.forward(), null)
  for (let i = 0; i < 600; i++) session.record(i)
  assert.equal(session.history.length, 500)
  assert.equal(session.back(), 598)
})
