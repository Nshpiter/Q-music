import { parseKugouSession, type KugouSession } from '@/core/musicAccount/kugouApi'

// 仅接受用户主动粘贴的凭证，不执行脚本或记录原文。
export const parseKugouLoginInput = (text: string, deviceMid: string): KugouSession => {
  if (!text.trim() || text.length > 16384) throw new Error('invalid_credentials')
  let fields: Record<string, unknown>
  if (text.trim().startsWith('{')) {
    try { fields = JSON.parse(text) } catch { throw new Error('invalid_credentials') }
    if (!fields || typeof fields != 'object' || Array.isArray(fields)) throw new Error('invalid_credentials')
  } else {
    fields = Object.fromEntries(text.split(';').map(part => {
      const index = part.indexOf('=')
      return index < 0 ? ['', ''] : [part.slice(0, index).trim(), part.slice(index + 1).trim()]
    }))
  }
  const session = parseKugouSession({ userId: fields.userId ?? fields.userid, token: fields.token, mid: fields.mid ?? fields.kg_mid ?? deviceMid, nickname: '', avatar: '' })
  if (!session) throw new Error('invalid_credentials')
  return session
}
