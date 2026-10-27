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
