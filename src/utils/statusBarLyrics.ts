import Lyric from 'lrc-file-parser'

const parse = (text: string) => new Lyric({ lyric: text, onPlay() {}, onSetLyric() {}, isRemoveBlankLine: false })
const lineText = (line: Lyric['lines'][number]) => [line.text, ...line.extendedLyrics].filter(Boolean).join(' / ')

export const buildStatusBarLyrics = (lyric: string, translation: string, roma: string, duration: number) => {
  const parser = parse(lyric)
  const lines = parser.lines
  // 与应用歌词解析器一致：先按原始时间戳匹配译文，再统一应用主歌词偏移。
  const time = (value: number) => Math.max(0, value - (parser.tags.offset || 0))
  const translations = new Map(parse(translation).lines.map(line => [line.time, lineText(line)]))
  const romas = new Map(parse(roma).lines.map(line => [line.time, lineText(line)]))
  return lines.map((line, index) => ({
    begin: time(line.time),
    end: Math.max(time(line.time), lines[index + 1] ? time(lines[index + 1].time) : (duration > time(line.time) ? duration : time(line.time) + 10_000)),
    text: lineText(line),
    translation: translations.get(line.time) ?? '',
    roma: romas.get(line.time) ?? '',
  }))
}
