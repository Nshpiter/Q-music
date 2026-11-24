import { reactive } from '@common/utils/vueTools'
import { isAbsolute } from 'node:path'

export function trackFiles(storage: string) {
  const paths = reactive(new Map<string, string>())
  try {
    const entries: unknown = JSON.parse(localStorage.getItem(storage) ?? '[]')
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        if (Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'string' && isAbsolute(entry[1])) paths.set(entry[0], entry[1])
      }
    }
  } catch {}
  const key = (track: LX.Music.MusicInfo) => track.source + ':' + track.id
  return {
    get: (track: LX.Music.MusicInfo) => paths.get(key(track)) ?? '',
    set: (track: LX.Music.MusicInfo, path: string) => {
      if (path && !isAbsolute(path)) throw Error('invalid_path')
      const id = key(track)
      const next = new Map(paths)
      if (path) next.set(id, path)
      else next.delete(id)
      localStorage.setItem(storage, JSON.stringify([...next]))
      if (path) paths.set(id, path)
      else paths.delete(id)
    },
  }
}
