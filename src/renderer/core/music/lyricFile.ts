import { open } from 'node:fs/promises'
import { trackFiles } from '@renderer/store/trackFiles'
import { getLyricEdited } from '@renderer/utils/ipc'
import { buildLyricInfo } from './utils'

export const lyricFiles = trackFiles('q-music.lyric-files')

export async function readLyricFile(path: string, track: LX.Music.MusicInfo) {
  const file = await open(path)
  let text: string
  try {
    const info = await file.stat()
    if (!info.isFile() || info.size > 2 * 1024 * 1024) throw Error('lyric_file_format')
    const bytes = await file.readFile()
    const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8'
    text = new TextDecoder(encoding).decode(bytes).replace(/\r\n/g, '\n')
    if (!/^\s*\[\d+:\d{1,2}(?:[.:]\d{1,3})?\]/m.test(text)) throw Error('lyric_file_format')
  } finally { await file.close() }
  const edited = await getLyricEdited(track)
  const withoutOffset = (lyric: string) => lyric.replace(/^\s*\[offset:[^\]]+\]\s*/gim, '').trim()
  const same = edited?.lyric && withoutOffset(edited.lyric) === withoutOffset(text)
  return buildLyricInfo({ ...(same ? edited : { lyric: text }), rawlrcInfo: { lyric: text } })
}
