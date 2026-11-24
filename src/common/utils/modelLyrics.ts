export const translationEndpoint = (address: string) => {
  const url = new URL(address.trim())
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if ((url.protocol != 'https:' && !(url.protocol == 'http:' && local)) || url.username || url.password || url.search || url.hash) throw Error('invalid_endpoint')
  return url.href.replace(/\/+$/, '').replace(/\/chat\/completions$/, '')
}

/** 时间标签始终从原词保留，只让服务返回译文。 */
export const translateTimedLyrics = async(lrc: string, translate: (lines: string[]) => Promise<unknown>) => {
  if (lrc.length > 100000) throw Error('lyrics_too_long')
  const rows = lrc.split(/\r?\n/).flatMap(line => {
    const match = /^\s*((?:\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\])+)(.+)$/.exec(line)
    const text = match?.[2].trim()
    return match && text ? [{ time: match[1], text }] : []
  })
  const phrases = [...new Set(rows.map(row => row.text))]
  if (!phrases.length) throw Error('missing_lyrics')
  const translated = new Map<string, string>()
  for (let i = 0; i < phrases.length; i += 32) {
    const group = phrases.slice(i, i + 32)
    const result = await translate(group)
    if (!Array.isArray(result) || group.length != result.length) throw Error('invalid_translation')
    group.forEach((phrase, index) => {
      const text: unknown = result[index]
      if (typeof text != 'string' || !text.trim() || /[\r\n]/.test(text)) throw Error('invalid_translation')
      translated.set(phrase, text.trim())
    })
  }
  const offset = lrc.match(/^\s*(\[offset:\s*[+-]?\d+\s*\])/im)?.[1]
  return [offset, ...rows.map(row => row.time + translated.get(row.text)!)].filter(Boolean).join('\n')
}
