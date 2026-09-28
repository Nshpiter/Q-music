const normalize = (value: string) => value.toLowerCase().replace(/[\s.,!?，。！？、・「」()（）·'"—…：:；;~～-]/g, '')

export const sameTitle = (left: string, right: string) => {
  const base = (value: string) => normalize(value.replace(/\s*[（(][\u3400-\u9fff\s]+[）)]\s*$/, ''))
  return base(left) == base(right)
}

export const closeDuration = (left?: string | null, right?: string | null) => {
  const seconds = (value?: string | null) => value ? value.split(':').reduce((time, part) => time * 60 + Number(part), 0) : 0
  const a = seconds(left)
  const b = seconds(right)
  return !a || !b || Math.abs(a - b) <= 8
}

const rows = (value: string) => value.split(/\r?\n/).flatMap(line => {
  const match = /^\[(\d+):(\d+)(?:\.(\d+))?\](.+)$/.exec(line.trim())
  if (!match) return []
  const text = normalize(match[4])
  return text ? [{
    stamp: match[0].slice(0, match[0].length - match[4].length),
    time: Number(match[1]) * 60 + Number(match[2]) + Number(`0.${match[3] ?? 0}`),
    text,
    value: match[4].trim(),
  }] : []
})

const similarity = (left: string, right: string) => {
  if (left == right) return 1
  if (left.includes(right) || right.includes(left)) {
    return Math.min(left.length, right.length) / Math.max(left.length, right.length) >= 0.45 ? 1 : 0
  }
  const pairs = new Set(Array.from({ length: Math.max(left.length - 1, 0) }, (_, index) => left.slice(index, index + 2)))
  const otherPairs = new Set(Array.from({ length: Math.max(right.length - 1, 0) }, (_, index) => right.slice(index, index + 2)))
  let shared = 0
  for (const pair of pairs) if (otherPairs.has(pair)) shared++
  return shared / Math.max(1, Math.min(pairs.size, otherPairs.size))
}

export const matchTranslation = (lyric: string, otherLyric: string, translation: string) => {
  const originals = rows(lyric)
  const candidates = rows(otherLyric)
  const translated = rows(translation)
  if (originals.length < 4 || candidates.length < 4 || translated.length < 4) return ''

  const assigned = new Set<number>()
  const matches = originals.flatMap(row => {
    const options = candidates.filter(other => row.text.length >= 4 && other.text.length >= 4 &&
      similarity(other.text, row.text) >= 0.78 && Math.abs(other.time - row.time) <= 12,
    ).sort((a, b) => Math.abs(a.time - row.time) - Math.abs(b.time - row.time))
    const original = options.find(other => !assigned.has(other.time)) ?? options[0]
    if (original) assigned.add(original.time)
    return original ? [{ row, original }] : []
  })
  const covered = matches.reduce((total, match) => total + match.row.text.length, 0)
  const total = originals.reduce((sum, row) => sum + row.text.length, 0)
  if (matches.length < 4 || covered / total < 0.6) return ''

  const used = new Set<number>()
  const aligned = matches.flatMap(({ row, original }) => {
    if (used.has(original.time)) return []
    const translatedRow = translated.find(other => Math.abs(other.time - original.time) <= 2.5)
    if (!translatedRow) return []
    used.add(original.time)
    return [`${row.stamp}${translatedRow.value}`]
  })
  return aligned.length >= 4 ? aligned.join('\n') : ''
}
