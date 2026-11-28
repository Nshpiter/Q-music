import { toNewMusicInfo } from '@/utils'

const PAGE_SIZE = 30

interface Detail {
  list: LX.Music.MusicInfoOnline[]
  page: number
  limit: number
  total: number
  incomplete?: boolean
}

interface Reader<T> {
  getPage: (page: number) => Promise<T>
  getAll: () => Promise<LX.Music.MusicInfoOnline[]>
}

export const createDetailCache = <T extends Detail>(fetchPage: (source: LX.OnlineSource, id: string, page: number) => Promise<T>) => {
  const readers = new Map<string, Reader<T>>()
  return (source: LX.OnlineSource, id: string, refresh: boolean): Reader<T> => {
    const key = `${source}__${id}`
    const cached = readers.get(key)
    if (cached && !refresh) return cached

    const songs: LX.Music.MusicInfoOnline[] = []
    const songIds = new Set<string>()
    let metadata: T
    let sourcePage = 0
    let done = false
    let incomplete = false
    let pending: Promise<void> | undefined

    const loadPage = async(nextPage: number) => {
      const result = await fetchPage(source, id, nextPage)
      if (readers.get(key) !== reader) throw new Error('Browse request superseded')
      const total = Number(result?.total)
      const limit = Number(result?.limit)
      if (!Array.isArray(result?.list) || !Number.isSafeInteger(total) || total < 0 ||
          !Number.isSafeInteger(limit) || limit < 0 || (!limit && total)) throw new Error('Invalid detail response')

      const batch = result.list.map(song => toNewMusicInfo(song) as LX.Music.MusicInfoOnline)
      for (const song of batch) {
        if (songIds.has(song.id)) continue
        songIds.add(song.id)
        songs.push(song)
      }
      incomplete ||= Boolean(result.incomplete) || (!batch.length && (nextPage - 1) * limit < total)
      metadata = { ...result, total, list: [] }
      sourcePage = nextPage
      done = sourcePage * limit >= total
    }

    const fill = async(count: number) => {
      while (songs.length < count) {
        if (done) return
        if (!pending) pending = loadPage(sourcePage + 1).finally(() => { pending = undefined })
        await pending
      }
    }

    const reader: Reader<T> = {
      async getPage(page) {
        if (!Number.isSafeInteger(page) || page < 1) throw new Error('Invalid page')
        await fill(page * PAGE_SIZE)
        return {
          ...metadata,
          ...(incomplete ? { incomplete: true } : {}),
          list: songs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
          page,
          limit: PAGE_SIZE,
          maxPage: Math.ceil((done ? songs.length : Math.max(songs.length, metadata.total)) / PAGE_SIZE),
        }
      },
      async getAll() {
        await fill(Infinity)
        if (incomplete) throw new Error('incomplete')
        return songs.slice()
      },
    }
    readers.set(key, reader)
    return reader
  }
}
