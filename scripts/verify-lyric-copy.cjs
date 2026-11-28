const test = require('node:test')
const assert = require('node:assert/strict')
const ts = require('typescript')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const api = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/screens/PlayDetail/components/lyricCopyText.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: api })
test('复制保留原文与当前译文的对应顺序，空行不产生空白副本', () => {
  assert.equal(api.lyricCopyText([{ text: ' Hello ', extendedLyrics: [' 你好 ', ''] }, { text: '', extendedLyrics: [] }, { text: 'Goodbye', extendedLyrics: ['再见'] }]), 'Hello\n你好\n\nGoodbye\n再见')
  assert.equal(api.lyricCopyText([{ text: 'Hello', extendedLyrics: [] }]), 'Hello')
  assert.equal(api.lyricCopyText([]), '')
})

test('歌词浏览定位支持不等高歌词，未测量的虚拟列表行不会选错时间', () => {
  const seek = {}
  const source = fs.readFileSync(path.join(__dirname, '../src/screens/PlayDetail/components/lyricSeek.ts'), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: seek })
  assert.equal(seek.lyricIndexAtOffset([38, 82, 40], 3, 75), 1)
  assert.equal(seek.lyricIndexAtOffset([38, 82, 40], 3, 180), 2)
  assert.equal(seek.lyricIndexAtOffset([38], 3, 100), null)
  assert.equal(seek.lyricIndexAtOffset([], 0, 0), null)
})

test('搜索原文和译文时按原始时间逐句返回，保留重复副歌和零秒开头', () => {
  const lines = [
    { time: 0, text: 'Hello again', extendedLyrics: ['再次问好'] },
    { time: 13000, text: 'World', extendedLyrics: ['世界'] },
    { time: 34000, text: 'Hello again', extendedLyrics: ['再次问好'] },
  ]
  assert.deepEqual(Array.from(api.findLyricLines(lines, '  AGAIN   问好  '), line => line.time), [0, 34000])
  assert.deepEqual(Array.from(api.findLyricLines(lines, '世界')), [lines[1]])
  assert.equal(api.findLyricLines(lines, '   ').length, 0)
  assert.equal(api.findLyricLines(lines, 'world hello').length, 0)
})
