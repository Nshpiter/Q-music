// 测试加载真实纯函数模块，不替换业务判断。
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
module.exports = file => {
  const context = { exports: {}, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, Buffer }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, context)
  return context.exports
}
