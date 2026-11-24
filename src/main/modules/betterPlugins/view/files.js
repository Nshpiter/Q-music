'use strict'

// 每个根插件使用独立的 Chromium 存储分区。包内资源只读，缓存使用该分区的私有文件系统。
window.createPluginFiles = owners => {
  const assets = new Map()
  const dirs = new Set(['/plugin', '/deps'])
  for (const { path, pkg } of owners) {
    for (const [name, text] of Object.entries(pkg.assets)) {
      const full = path + '/' + name
      assets.set(full, text)
      for (let slash = full.lastIndexOf('/'); slash > 0; slash = full.lastIndexOf('/', slash - 1)) dirs.add(full.slice(0, slash))
    }
  }
  const normalize = name => {
    if (typeof name !== 'string' || name.length > 2048 || /[\\:\u0000]/.test(name)) throw Error('plugin_file_path') // eslint-disable-line no-control-regex
    const parts = name.split('/').filter(s => s && s !== '.')
    if (parts.includes('..')) throw Error('plugin_file_path')
    return '/' + parts.join('/')
  }
  const bundled = path => /^\/(?:plugin|deps)(?:\/|$)/.test(path)
  const writable = path => {
    if (path === '/' || bundled(path)) throw Error('plugin_file_readonly')
  }
  const directory = async(path, create = false) => {
    let dir = await window.navigator.storage.getDirectory()
    for (const part of path.split('/').filter(Boolean)) dir = await dir.getDirectoryHandle(part, { create })
    return dir
  }
  const parent = async path => {
    const slash = path.lastIndexOf('/')
    return [await directory(path.slice(0, slash)), path.slice(slash + 1)]
  }
  const readFile = async name => {
    const path = normalize(name)
    if (assets.has(path)) return new window.Blob([assets.get(path)])
    if (!name.startsWith('/') && assets.has('/plugin' + path)) return new window.Blob([assets.get('/plugin' + path)])
    const [dir, file] = await parent(path)
    return (await dir.getFileHandle(file)).getFile()
  }
  const writeFile = async(name, content) => {
    const path = normalize(name)
    writable(path)
    const [dir, file] = await parent(path)
    const stream = await (await dir.getFileHandle(file, { create: true })).createWritable()
    try { await stream.write(content); await stream.close() } catch (error) { await stream.abort().catch(() => {}); throw error }
  }
  return {
    readFile,
    writeFile,
    readFileText: async name => (await readFile(name)).text(),
    writeFileText: (name, text) => writeFile(name, String(text)),
    async mkdir(name) { const path = normalize(name); writable(path); await directory(path, true) },
    async exists(name) {
      const path = normalize(name)
      if (path === '/' || dirs.has(path) || assets.has(path)) return true
      try {
        const [dir, file] = await parent(path)
        try { await dir.getFileHandle(file) } catch (error) {
          if (error.name !== 'TypeMismatchError') throw error
          await dir.getDirectoryHandle(file)
        }
        return true
      } catch (error) { if (error.name === 'NotFoundError') return false; throw error }
    },
    async readDir(name) {
      const path = normalize(name)
      const prefix = path === '/' ? '/' : path + '/'
      if (bundled(path)) {
        if (!dirs.has(path)) throw Error('plugin_file_directory')
        return [...dirs, ...assets.keys()].filter(p => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
      }
      const entries = []
      for await (const key of (await directory(path)).keys()) entries.push(prefix + key)
      return entries
    },
    async remove(name) {
      const path = normalize(name)
      writable(path)
      const [dir, file] = await parent(path)
      await dir.removeEntry(file, { recursive: true })
    },
  }
}
