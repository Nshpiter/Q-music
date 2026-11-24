'use strict'

// 插件协议使用毫秒时间戳及网易云逐字格式，播放器内部保存 LRC 与相对时间的 LX 逐字格式。
;(() => {
  function parsePureLyric(input) {
    const rows = []
    for (const line of String(input || '').split(/\r?\n/)) {
      const tags = /^\s*((?:\[\d+:\d{1,2}(?:[.:]\d{1,3})?\])+)(.*)$/.exec(line)
      if (!tags) continue
      for (const stamp of tags[1].matchAll(/\[(\d+):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)) {
        const time = (Number(stamp[1]) * 60 + Number(stamp[2])) * 1000 + Number((stamp[3] || '').padEnd(3, '0'))
        rows.push({ time, lyric: tags[2].trim() })
      }
    }
    return rows.sort((a, b) => a.time - b.time)
  }
  function parsePureDynamicLyric(input) {
    const rows = []
    for (const line of String(input || '').split(/\r?\n/)) {
      const info = /^\[(\d+),(\d+)\](.*)$/.exec(line)
      if (!info) continue
      const dynamicLyric = Array.from(info[3].matchAll(/\((\d+),(\d+),(\d+)\)([\s\S]*?)(?=\(\d+,\d+,\d+\)|$)/g), ([, start, length, flag, word]) => ({ time: Number(start), duration: Number(length), flag: Number(flag), word }))
      if (dynamicLyric.length) rows.push({ time: Number(info[1]), duration: Number(info[2]), originalLyric: dynamicLyric.map(item => item.word).join(''), dynamicLyric, dynamicLyricTime: Number(info[1]) })
    }
    return rows.sort((a, b) => a.time - b.time)
  }
  function convertDynamic(input) {
    return parsePureLyric(input).flatMap(row => {
      const words = Array.from(row.lyric.matchAll(/<(\d+),(\d+)>([^<]*)/g), ([, start, length, word]) => ({ start: Number(start), length: Number(length), word }))
      if (!words.length) return []
      const last = words[words.length - 1]
      return '[' + row.time + ',' + (last.start + last.length) + ']' + words.map(({ start, length, word }) => '(' + (row.time + start) + ',' + length + ',0)' + word).join('')
    }).join('\n')
  }
  function parseLyric(original, translation, roman, timed) {
    const dynamic = parsePureDynamicLyric(timed)
    const rows = dynamic.length ? dynamic : parsePureLyric(original).map(({ time, lyric }) => ({ time, originalLyric: lyric, duration: 0 }))
    const byTime = input => new Map(parsePureLyric(input).map(({ time, lyric }) => [time, lyric]))
    const translations = byTime(translation)
    const readings = byTime(roman)
    return rows.map((row, i) => ({
      ...row,
      duration: row.duration || (rows[i + 1] ? rows[i + 1].time - row.time : 0),
      translatedLyric: translations.get(row.time) || '',
      romanLyric: readings.get(row.time) || '',
    }))
  }
  // RNP 以 cyrb53 标识同一曲目的原词。仅翻译或罗马音更新时沿用相同的标识。
  function lyricHash(text) {
    let low = 0xdeadbeef
    let high = 0x41c6ce57
    for (let i = 0; i < text.length; i++) {
      low = Math.imul(low ^ text.charCodeAt(i), 2654435761)
      high = Math.imul(high ^ text.charCodeAt(i), 1597334677)
    }
    low = Math.imul(low ^ (low >>> 16), 2246822507) ^ Math.imul(high ^ (high >>> 13), 3266489909)
    high = Math.imul(high ^ (high >>> 16), 2246822507) ^ Math.imul(low ^ (low >>> 13), 3266489909)
    return (high & 0x1fffff) * 0x100000000 + (low >>> 0)
  }
  window.qPluginLyrics = { parseLyric, parsePureLyric, parsePureDynamicLyric, convertDynamic, lyricHash }
})()
