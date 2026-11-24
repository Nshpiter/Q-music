import { safeStorage } from 'electron'
import getStore from '@main/utils/store'
import { translateTimedLyrics, translationEndpoint } from '@common/utils/modelLyrics'

interface Provider {
  endpoint: string
  model: string
  target: string
  secret: string
}
const defaults: Provider = { endpoint: 'https://api.deepseek.com', model: 'deepseek-chat', target: '简体中文', secret: '' }
const read = () => getStore('lyricTranslation').get<Provider>('provider') || defaults
export const getProvider = () => {
  const { secret, ...provider } = read()
  return { ...provider, hasKey: !!secret }
}
export const saveProvider = (input: Omit<Provider, 'secret'> & { key?: string }) => {
  const old = read()
  const endpoint = translationEndpoint(input.endpoint)
  const model = input.model.trim()
  const target = input.target.trim()
  if (!model || !target || model.length > 200 || target.length > 80) throw Error('invalid_provider')
  let secret = old.endpoint === endpoint ? old.secret : ''
  if (input.key !== undefined) {
    if (input.key && (!safeStorage.isEncryptionAvailable() || (process.platform == 'linux' && safeStorage.getSelectedStorageBackend() == 'basic_text'))) throw Error('secure_storage')
    secret = input.key ? safeStorage.encryptString(input.key.trim()).toString('base64') : ''
  }
  getStore('lyricTranslation').set('provider', { endpoint, model, target, secret })
  return getProvider()
}
export const translateSong = async(lyric: string) => {
  const { endpoint, model, target, secret } = read()
  const url = translationEndpoint(endpoint) + '/chat/completions'
  const key = secret && safeStorage.decryptString(Buffer.from(secret, 'base64'))
  return translateTimedLyrics(lyric, async lines => {
    const response = await fetch(url, {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: 'Bearer ' + key } : {}) },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'Translate the array of lyric lines into ' + target + '. Preserve order. Return only a JSON array containing one translated string per input line.' },
          { role: 'user', content: JSON.stringify(lines) },
        ],
      }),
      signal: AbortSignal.timeout(60000),
    })
    if (!response.ok) throw Error('HTTP ' + response.status)
    const content: unknown = (await response.json()).choices?.[0]?.message?.content
    if (typeof content != 'string') throw Error('invalid_translation')
    return JSON.parse(content.trim().replace(/^```(?:json)?\s*|\s*```$/gi, '')) as unknown
  })
}
