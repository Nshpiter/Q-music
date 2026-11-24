let worker
let nextId = 0
const pending = new Map()
export function dictionaryRequest(action, value) {
  if (!worker) {
    worker = new window.Worker(new URL('dictionary/worker.js', document.baseURI))
    worker.onmessage = ({ data }) => {
      const job = pending.get(data.id)
      if (!job) return
      pending.delete(data.id)
      if (data.error) job.reject(Error(data.error))
      else job.resolve(data.data)
    }
    worker.onerror = () => {
      for (const job of pending.values()) job.reject(Error('dictionary_worker'))
      pending.clear()
      worker.terminate()
      worker = null
    }
  }
  return new Promise((resolve, reject) => {
    const id = ++nextId
    pending.set(id, { resolve, reject })
    worker.postMessage({ id, action, value }, action === 'import' ? [value] : [])
  })
}

const escapeHtml = text => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]).replaceAll('\n', '<br>')
export async function addAnkiCard(word) {
  const request = async(action, params = {}) => {
    const res = await fetch('http://127.0.0.1:8765', {
      method: 'POST',
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(6000),
      body: JSON.stringify({ action, version: 6, params }),
    })
    if (!res.ok) throw Error('anki_error')
    const body = await res.json()
    if (body.error) throw Error(String(body.error))
    return body.result
  }
  const modelName = 'Q-music Lyrics'
  const deckName = 'Q-music'
  await request('createDeck', { deck: deckName })
  if (!(await request('modelNames')).includes(modelName)) {
    await request('createModel', {
      modelName,
      inOrderFields: ['Word', 'Reading', 'Meaning'],
      css: '.card { font: 22px system-ui; text-align: center; }',
      cardTemplates: [{ Name: 'Lyrics', Front: '{{Word}}', Back: '{{FrontSide}}<hr>{{Reading}}<p>{{Meaning}}</p>' }],
    })
  }
  return request('addNote', { note: { deckName, modelName, fields: { Word: escapeHtml(word.term), Reading: escapeHtml(word.reading), Meaning: escapeHtml(word.meaning) }, options: { allowDuplicate: false }, tags: ['Q-music'] } })
}
