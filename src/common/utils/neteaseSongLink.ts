// 只清理网易云分享地址中的用户 ID，保留歌词、附言及其他站点的原文。
export const cleanNeteaseShare = (text: string) => text.replace(/https?:\/\/(?:[\w-]+\.)*music\.163\.com\/[^\s<>"'，。！？）]+/gi, raw => {
  if (!/[?&]userid=/i.test(raw)) return raw
  return raw.replace(/([?&])userid=\d+(?=&|#|$)(&?)/gi, (_, separator, next) => next ? separator : '')
})

export const neteaseSongId = (text: string) => {
  const match = text.match(/https?:\/\/(?:y\.)?music\.163\.com\/[^\s<>"']+/i)
  if (!match) return null
  const url = new URL(match[0])
  const path = url.hash.startsWith('#/') ? new URL(url.hash.slice(1), url.origin) : url
  if (!/^\/(?:m\/)?song\/?$/.test(path.pathname)) return null
  return path.searchParams.get('id')?.match(/^\d{1,18}(?:$|(?=[。，）]))/u)?.[0] ?? null
}
