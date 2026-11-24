import { builtinDependencies, pluginOrder, readBetterPackage } from '../../../common/utils/betterPackage.js'

export const officialSource = 'https://cdn.jsdelivr.net/gh/BetterNCM/BetterNCM-Packed-Plugins@master/'
export const githubSource = 'https://raw.githubusercontent.com/BetterNCM/BetterNCM-Packed-Plugins/master/'
// 官方索引没有列出这些版本清单里的 hijacks，它们依赖网易云自己的播放页。
const hostOnlyReleases = new Map([
  ['refinednowplaying', '2.19.5'],
  ['refinednowplaying-enhanced', '0.1.0'],
  ['refinednowplayingnext', '3.0.2'],
])
export function sourceRoot(value) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw Error('plugin_source_error')
  if (!url.pathname.endsWith('/')) url.pathname += '/'
  return url.href
}

async function readBytes(fetch, url, maximum) {
  const response = await fetch(url, { credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(30000) })
  if (response.status !== 200 || !response.body) throw Error('plugin_download')
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    if (Number(response.headers.get('content-length')) > maximum) throw Error('plugin_size')
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > maximum) throw Error('plugin_size')
      chunks.push(value)
    }
  } finally { await reader.cancel().catch(() => {}) }
  return Buffer.concat(chunks, size)
}

async function readSource(fetch, url, maximum, decode) {
  const mirrors = [officialSource, githubSource]
  const root = mirrors.find(base => url.startsWith(base))
  const addresses = root ? [url, mirrors.find(base => base !== root) + url.slice(root.length)] : [url]
  let failure
  for (const address of addresses) {
    try { return decode(await readBytes(fetch, address, maximum)) } catch (err) {
      failure = err
      if (['plugin_size', 'plugin_native'].includes(err.message)) throw err
    }
  }
  throw failure
}

export async function loadCatalog(fetch, source) {
  const base = sourceRoot(source || officialSource)
  const rows = await readSource(fetch, base + 'plugins.json', 1024 * 1024, bytes => JSON.parse(bytes.toString('utf8')))
  if (!Array.isArray(rows) || rows.length > 4096) throw Error('plugin_format')
  const result = new Map()
  for (const row of rows) {
    if (!row || typeof row.slug !== 'string' || typeof row['file-url'] !== 'string') continue
    const url = new URL(row['file-url'], base)
    if (!url.href.startsWith(base) || !url.pathname.endsWith('.plugin') || url.hash) continue
    const key = row.slug.toLowerCase()
    if (result.has(key)) throw Error('plugin_format')
    const version = String(row.version || '')
    const native = !!row.native || ([officialSource, githubSource].includes(base) && hostOnlyReleases.get(key) === version)
    result.set(key, { id: row.slug, name: String(row.name || row.slug), version, description: String(row.description || ''), requirements: Array.isArray(row.requirements) ? row.requirements.map(String) : [], native, url: url.href })
  }
  return result
}

export async function downloadPluginTree(fetch, catalog, id, installed) {
  const key = id.toLowerCase()
  const root = catalog.get(key)
  if (!root) throw Error('plugin_missing')
  const present = new Set(installed.map(item => item.id.toLowerCase()))
  present.delete(key)
  const order = pluginOrder(root, [...catalog.values()], [...builtinDependencies, ...present])
  const downloads = []
  let bytesRead = 0
  for (const item of order) {
    if (item.native) throw Error('plugin_native')
    const parsed = await readSource(fetch, item.url, 16 * 1024 * 1024, bytes => {
      const data = readBetterPackage(bytes)
      bytesRead += bytes.length
      return data
    })
    if (bytesRead > 32 * 1024 * 1024) throw Error('plugin_size')
    if (parsed.id.toLowerCase() !== item.id.toLowerCase()) throw Error('plugin_format')
    downloads.push(parsed)
  }
  pluginOrder(downloads[downloads.length - 1], [...installed, ...downloads])
  return downloads
}
