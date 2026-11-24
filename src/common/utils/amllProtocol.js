// AMLL Player 的二进制 V1 与 JSON V2 共用同一份歌曲和歌词快照。
import { Buffer } from 'node:buffer'

const milliseconds = n => Math.max(0, Math.round(Number.isFinite(n) ? n : 0))
export const parseTimed = lrc => {
  const rows = new Map()
  for (const line of (lrc || '').split(/\r?\n/)) {
    const tags = /^\s*((?:\[\d+:\d{2}(?:[.:]\d{1,3})?\])+)(.*)$/.exec(line)
    if (!tags) continue
    for (const time of tags[1].matchAll(/\[(\d+):(\d{2})(?:[.:](\d{1,3}))?\]/g)) {
      const ms = (Number(time[1]) * 60 + Number(time[2])) * 1000 + Number((time[3] || '').padEnd(3, '0'))
      rows.set(ms, tags[2])
    }
  }
  return rows
}

export const amllLines = (music, duration, offset) => {
  const timed = parseTimed(music.lxlrc)
  const text = timed.size ? timed : parseTimed(music.lrc)
  const translation = parseTimed(music.tlrc)
  const roman = parseTimed(music.rlrc)
  const rows = [...text.entries()].sort(([a], [b]) => a - b)
  return rows.map(([time, line], index) => {
    const startTime = milliseconds(time - offset)
    const words = Array.from(line.matchAll(/<(\d+),(\d+)>([^<]*)/g), ([, delay, length, word]) => ({
      startTime: milliseconds(time + Number(delay) - offset),
      endTime: milliseconds(time + Number(delay) + Number(length) - offset),
      word,
    }))
    const next = rows[index + 1]
    const endTime = Math.max(startTime, words.at(-1)?.endTime ?? (next ? milliseconds(next[0] - offset) : duration || startTime + 3000))
    return { startTime, endTime, words: words.length ? words : [{ startTime, endTime, word: line }], translatedLyric: translation.get(time) || '', romanLyric: roman.get(time) || '', isBG: false, isDuet: false }
  })
}

const scalar = (size, method, value) => {
  const bytes = Buffer.alloc(size)
  bytes[method](value)
  return bytes
}
const u16 = value => scalar(2, 'writeUInt16LE', value)
const u32 = value => scalar(4, 'writeUInt32LE', value)
const u64 = value => scalar(8, 'writeBigUInt64LE', BigInt(milliseconds(value)))
const string = value => Buffer.from(String(value).replaceAll('\0', '') + '\0')
const vector = (list, encode) => Buffer.concat([u32(list.length), ...list.map(encode)])
const word = item => Buffer.concat([u64(item.startTime), u64(item.endTime), string(item.word)])
const line = item => Buffer.concat([u64(item.startTime), u64(item.endTime), vector(item.words, word), string(item.translatedLyric), string(item.romanLyric), Buffer.from([0])])

export function amllState(version, state) {
  if (version === 'v2') return JSON.stringify({ type: 'state', value: state })
  switch (state.update) {
    case 'setMusic': return Buffer.concat([u16(2), string(state.musicId), string(state.musicName), string(state.albumId), string(state.albumName), vector(state.artists, a => Buffer.concat([string(a.id), string(a.name)])), u64(state.duration)])
    case 'setCover': return Buffer.concat([u16(3), string(state.url)])
    case 'progress': return Buffer.concat([u16(5), u64(state.progress)])
    case 'volume': return Buffer.concat([u16(6), scalar(8, 'writeDoubleLE', state.volume)])
    case 'paused': return u16(7)
    case 'resumed': return u16(8)
    case 'setLyric': return Buffer.concat([u16(10), vector(state.lines, line)])
    default: return null
  }
}

export function amllCommand(data, version) {
  if (version === 'v2') {
    if (typeof data !== 'string' || data.length > 4096) return null
    try {
      const packet = JSON.parse(data)
      if (packet?.type === 'command') return packet.value
      if (packet?.type === 'ping' || packet?.type === 'initialize') return { command: packet.type }
    } catch {}
    return null
  }
  if (!(data instanceof ArrayBuffer) || (data.byteLength !== 2 && data.byteLength !== 10)) return null
  const view = new DataView(data)
  const code = view.getUint16(0, true)
  if (view.byteLength === 10) {
    if (code === 16) return { command: 'setVolume', volume: view.getFloat64(2, true) }
    if (code === 17) return { command: 'seekPlayProgress', progress: Number(view.getBigUint64(2, true)) }
    return null
  }
  const command = { 0: 'ping', 12: 'pause', 13: 'resume', 14: 'forwardSong', 15: 'backwardSong' }[code]
  return command ? { command } : null
}
