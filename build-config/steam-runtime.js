// Steam 的协议描述和压缩字典按相对路径加载，发布包保留其 npm 依赖结构。
const path = require('node:path')
const { packages } = require('../package-lock.json')
const all = new Set()
function collect(name, from = '') {
  let parent = from
  let key
  while (true) {
    key = path.posix.join(parent, 'node_modules', name)
    if (packages[key]) break
    if (!parent) throw new Error('Missing Steam runtime dependency ' + name)
    parent = parent.replace(/(?:^|\/)node_modules\/(?:@[^/]+\/)?[^/]+$/, '')
  }
  if (all.has(key)) return
  all.add(key)
  for (const dependency of Object.keys(packages[key].dependencies || {})) collect(dependency, key)
}
collect('steam-session')
collect('steam-user')
module.exports = [...all]
