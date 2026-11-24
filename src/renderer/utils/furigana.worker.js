/* global importScripts, kuromoji, self */
importScripts('kuromoji.js')

let dictionary
function loadDictionary() {
  dictionary ??= new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: 'dict' }).build((error, tokenizer) => {
      if (error) reject(error)
      else resolve(tokenizer)
    })
  })
  return dictionary
}

const hiragana = word => word.replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 96))

self.onmessage = async({ data: { id, lines, overrides } }) => {
  try {
    const tokenizer = await loadDictionary()
    const readings = new Map(overrides.split(/\r?\n/).map(line => line.trim().split(/\s*=\s*/)).filter(parts => parts.length === 2 && parts.every(Boolean)))
    const result = lines.map(line => tokenizer.tokenize(line).map(token => {
      const text = token.surface_form
      const reading = readings.get(text) || token.reading
      return { text, reading: reading && /\p{Script=Han}/u.test(text) ? hiragana(reading) : '' }
    }))
    self.postMessage({ id, result })
  } catch {
    dictionary = undefined
    self.postMessage({ id, error: true })
  }
}
