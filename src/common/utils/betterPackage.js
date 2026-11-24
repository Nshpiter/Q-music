import { unzipSync, strFromU8 } from 'fflate'

// ZIP 和清单必须引用同一个规范路径，避免相同名字覆盖前一个条目。
function relativePath(value) {
  if (typeof value !== 'string' || /[\\:]/.test(value) || Array.from(value).some(char => char.charCodeAt(0) < 32)) throw Error('plugin_format')
  const parts = value.split('/')
  if (parts.some(part => !part || part === '..')) throw Error('plugin_format')
  const clean = parts.filter(part => part !== '.').join('/')
  if (!clean || ['__proto__', 'constructor', 'prototype'].includes(clean)) throw Error('plugin_format')
  return clean
}

export const builtinDependencies = ['LibSongInfo', 'LibLyric', 'LibEAPIRequest', 'StylesheetLoader', 'PluginMarket', 'InfLinkrs', 'RefinedNowPlaying', 'RefinedNowPlaying-Enhanced', 'RefinedNowPlayingNext']

export function pluginOrder(root, packages, builtins = builtinDependencies) {
  const byId = new Map(packages.map(item => [item.id.toLowerCase(), item]))
  const native = new Set(builtins.map(id => id.toLowerCase()))
  const sorted = []
  const visited = new Set()
  const visiting = new Set()
  const visit = item => {
    const id = item.id.toLowerCase()
    if (visited.has(id)) return
    if (visiting.has(id)) throw Error('plugin_cycle: ' + item.id)
    visiting.add(id)
    for (const key of item.requirements ?? []) {
      const name = key.toLowerCase()
      if (native.has(name)) continue
      const dependency = byId.get(name)
      if (!dependency) throw Error('plugin_dependency: ' + key)
      visit(dependency)
    }
    visiting.delete(id)
    visited.add(id)
    sorted.push(item)
  }
  visit(root)
  return sorted
}

// 只在内存中读取包内文本，不把压缩包路径映射到本机文件系统。
export function readBetterPackage(bytes) {
  if (bytes.length > 16 * 1024 * 1024) throw Error('plugin_size')
  let total = 0
  const names = new Set()
  const extracted = unzipSync(bytes, {
    filter(entry) {
      if (!/\.(?:json|js|css|less|txt|html)$/i.test(entry.name)) return false
      const key = relativePath(entry.name).toLowerCase()
      if (names.has(key)) throw Error('plugin_format')
      names.add(key)
      total += entry.originalSize
      if (total > 8 * 1024 * 1024) throw Error('plugin_size')
      return true
    },
  })
  const files = Object.fromEntries(Object.entries(extracted).map(([key, value]) => [relativePath(key), value]))
  const manifests = Object.keys(files).filter(path => /^(?:[^/]+\/)?manifest\.json$/.test(path))
  if (manifests.length !== 1) throw Error('plugin_format')
  const file = manifests[0]
  const root = file.slice(0, -'manifest.json'.length)
  const manifest = JSON.parse(strFromU8(files[file]))
  if (manifest.native_plugin || Object.keys(manifest.hijacks || {}).length || manifest.injects?.Startup?.length || manifest.injects?.Preload?.length) throw Error('plugin_native')
  const id = manifest.slug || (typeof manifest.name === 'string' ? manifest.name.replace(/[^\w]/g, '') : '')
  if (typeof id !== 'string' || !/^[a-z0-9][\w .!-]{0,95}$/i.test(id) || ['constructor', 'prototype', '__proto__'].includes(id)) throw Error('plugin_format')
  const entries = manifest.injects?.Main
  if (!Array.isArray(entries) || !entries.length) throw Error('plugin_format')
  const scripts = entries.map(entry => relativePath(entry?.file))
  if (!scripts.every(file => /\.js$/i.test(file) && Object.hasOwn(files, root + file))) throw Error('plugin_format')
  const requirements = manifest.requirements ?? []
  if (!Array.isArray(requirements) || !requirements.every(value => typeof value === 'string' && value.length > 0 && value.length <= 96)) throw Error('plugin_format')
  const assets = Object.create(null)
  for (const [path, bytes] of Object.entries(files)) {
    if (path.startsWith(root)) assets[path.slice(root.length)] = strFromU8(bytes)
  }
  return { id, name: String(manifest.name || id).slice(0, 100), version: String(manifest.version || '').slice(0, 40), requirements, scripts, assets }
}
