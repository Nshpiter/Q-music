/* global importScripts, fflate, kuromoji, indexedDB, IDBKeyRange, self */
// 词库解压、JSON 解析及索引均留在 Worker，导入中断时 IndexedDB 回滚整个事务。
importScripts('zip.js')
let database
const openDb = () => {
  if (!database) {
    database = new Promise((resolve, reject) => {
      const open = indexedDB.open('q-music-lyric-dictionary', 2)
      open.onupgradeneeded = () => {
        const db = open.result
        if (!db.objectStoreNames.contains('words')) {
          db.createObjectStore('dictionaries', { keyPath: 'title' })
          const words = db.createObjectStore('words', { keyPath: ['dict', 'n'] })
          words.createIndex('term', 'term')
          words.createIndex('reading', 'reading')
        }
        db.createObjectStore('media', { keyPath: ['dict', 'path'] })
      }
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => { database = null; reject(open.error) }
    })
  }
  return database
}
const result = request => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})
const commit = tx => new Promise((resolve, reject) => {
  tx.oncomplete = resolve
  tx.onabort = () => reject(tx.error || Error('dictionary_aborted'))
})
const flatten = value => {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(flatten).join('')
  if (!value || typeof value !== 'object') return ''
  if (value.tag === 'br') return '\n'
  if (value.type === 'image' || value.tag === 'img') return value.description || value.title || ''
  return flatten(value.content) + (['li', 'div', 'tr'].includes(value.tag) ? '\n' : '')
}
async function importTerms(db, bytes) {
  let size = 0
  const files = fflate.unzipSync(new Uint8Array(bytes), {
    filter(file) {
      const image = /\.(?:png|jpe?g|webp|gif)$/i.test(file.name) && file.originalSize <= 8 * 1024 * 1024
      if (!image && !/^(?:index\.json|term_bank_\d+\.json)$/.test(file.name)) return false
      size += file.originalSize
      if (size > 384 * 1024 * 1024) throw Error('dictionary_too_large')
      return true
    },
  })
  const parse = file => JSON.parse(fflate.strFromU8(file))
  const info = parse(files['index.json'])
  const title = String(info.title || '').trim()
  if (!title || ![2, 3].includes(info.format ?? info.version)) throw Error('dictionary_format')
  const tx = db.transaction(['words', 'dictionaries', 'media'], 'readwrite')
  const done = commit(tx)
  const words = tx.objectStore('words')
  let n = 0
  try {
    words.delete(IDBKeyRange.bound([title, 0], [title, Infinity]))
    const media = tx.objectStore('media')
    media.delete(IDBKeyRange.bound([title], [title, []]))
    for (const [path, bytes] of Object.entries(files)) {
      if (!/\.(?:png|jpe?g|webp|gif)$/i.test(path)) continue
      const type = 'image/' + path.split('.').pop().toLowerCase().replace(/^jpg$/, 'jpeg')
      media.put({ dict: title, path, blob: new self.Blob([bytes], { type }) })
    }
    for (const key of Object.keys(files).filter(key => key.startsWith('term_bank_'))) {
      for (const row of parse(files[key])) {
        if (!Array.isArray(row) || typeof row[0] !== 'string' || !Array.isArray(row[5])) throw Error('dictionary_format')
        const meaning = row[5].map(flatten).map(s => s.trim()).filter(Boolean).join('\n')
        const structured = row[5].some(part => part && typeof part === 'object') ? row[5] : null
        if (meaning || structured) words.add({ dict: title, n: ++n, term: row[0], reading: row[1] || '', meaning, structured })
      }
    }
    if (!n) throw Error('dictionary_empty')
    tx.objectStore('dictionaries').put({ title, count: n })
  } catch (err) {
    tx.abort()
    await done.catch(() => {})
    throw err
  }
  await done
  return n
}
let tokenizer
async function inflectedForms(text) {
  if (!/[ぁ-んァ-ン]/.test(text)) return []
  try {
    if (!tokenizer) {
      importScripts('../furigana/kuromoji.js')
      tokenizer = new Promise((resolve, reject) => {
        kuromoji.builder({ dicPath: '../furigana/dict' }).build((error, result) => error ? reject(error) : resolve(result))
      })
    }
    const tokens = (await tokenizer).tokenize(text)
    const candidates = []
    const first = tokens[0]
    if (first?.basic_form && first.basic_form !== '*' && first.basic_form !== first.surface_form) {
      candidates.push({ key: first.basic_form, length: first.surface_form.length })
    }
    const second = tokens[1]
    if (first?.pos === '名詞' && second?.basic_form === 'する') {
      candidates.push({ key: first.surface_form + 'する', length: first.surface_form.length + second.surface_form.length })
    }
    return candidates
  } catch { tokenizer = undefined; return [] }
}
async function lookup(db, text) {
  const input = Array.from(text.trim()).slice(0, 32)
  if (!input.length) return []
  const variants = await inflectedForms(input.join(''))
  const tx = db.transaction('words')
  const store = tx.objectStore('words')
  const keys = input.map((_, i) => ({ key: input.slice(0, i + 1).join(''), length: i + 1 }))
  keys.push(...variants)
  keys.sort((a, b) => b.length - a.length)
  const candidates = await Promise.all(keys.map(async({ key }) => {
    const rows = await Promise.all(['term', 'reading'].map(index => result(store.index(index).getAll(key, 12))))
    return rows.flat()
  }))
  const matches = candidates.find(rows => rows.length) || []
  const seen = new Set()
  return matches.filter(row => {
    const key = JSON.stringify([row.dict, row.n])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 12)
}
self.onmessage = async({ data: { id, action, value } }) => {
  try {
    const db = await openDb()
    let data
    if (action === 'import') data = await importTerms(db, value)
    else if (action === 'lookup') data = await lookup(db, value)
    else if (action === 'media') data = (await result(db.transaction('media').objectStore('media').get(value)))?.blob
    else if (action === 'list') data = await result(db.transaction('dictionaries').objectStore('dictionaries').getAll())
    else if (action === 'remove') {
      const tx = db.transaction(['words', 'dictionaries', 'media'], 'readwrite')
      tx.objectStore('media').delete(IDBKeyRange.bound([value], [value, []]))
      tx.objectStore('words').delete(IDBKeyRange.bound([value, 0], [value, Infinity]))
      tx.objectStore('dictionaries').delete(value)
      await commit(tx)
    } else throw Error('dictionary_action')
    self.postMessage({ id, data })
  } catch (err) { self.postMessage({ id, error: err.message }) }
}
