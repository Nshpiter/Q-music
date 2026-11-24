import { reactive } from '@common/utils/vueTools'

export interface Line {
  text: string
  time: number
  extendedLyrics: string[]
  dom_line: HTMLDivElement
  words?: LX.Player.TimedWord[]
}

export const lyric = reactive<{
  lines: Line[]
  text: string
  line: number
  offset: number // 歌词延迟
  tempOffset: number // 歌词临时延迟
}>({
  lines: [],
  text: '',
  line: 0,
  offset: 0, // 歌词延迟
  tempOffset: 0, // 歌词临时延迟
})

export const setLines = (lines: Line[]) => {
  if (!lines.length && !lyric.lines.length) return
  lyric.lines = lines
}
export const setText = (text: string, line: number) => {
  lyric.text = text
  lyric.line = line
}
export const setOffset = (offset: number) => {
  lyric.offset = offset
}
export const setTempOffset = (offset: number) => {
  lyric.tempOffset = offset
}

export const getLineAtTime = (seconds: number) => {
  const time = seconds * 1000 + lyric.offset + lyric.tempOffset
  const lines = lyric.lines
  let start = 0
  let end = lines.length
  while (start < end) {
    const mid = Math.floor((start + end) / 2)
    if (lines[mid].time <= time) start = mid + 1
    else end = mid
  }
  return lines[start - 1]
}
export const getLyricAtTime = (seconds: number) => getLineAtTime(seconds)?.text ?? ''
