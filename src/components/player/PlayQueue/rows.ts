import { filterTracks } from '@/utils/filterTracks'

export interface QueueRow {
  key: string
  kind: 'list' | 'later' | 'current'
  index: number
  position: number
  music: LX.Player.PlayMusic
}

export const queueTrack = (music: LX.Player.PlayMusic) => 'progress' in music ? music.metadata.musicInfo : music

export const buildQueueRows = (list: LX.Player.PlayMusic[], upcoming: LX.Player.PlayMusicInfo[], anchor: number, insertedTrack: LX.Player.PlayMusic | null): QueueRow[] => {
  const rows: QueueRow[] = []
  const insertAt = Math.min(list.length, Math.max(0, anchor + 1))
  const insertUpcoming = () => {
    if (insertedTrack) rows.push({ key: 'current', kind: 'current', music: insertedTrack, index: 0, position: rows.length })
    upcoming.forEach((item, index) => {
      rows.push({ key: `later:${item.tempId}`, kind: 'later', music: item.musicInfo, index, position: rows.length })
    })
  }
  list.forEach((music, index) => {
    if (index == insertAt) insertUpcoming()
    rows.push({ key: `list:${music.id}:${index}`, kind: 'list', music, index, position: rows.length })
  })
  if (insertAt == list.length) insertUpcoming()
  return rows
}

export const filterQueueRows = (rows: QueueRow[], query: string) => filterTracks(rows, query, row => queueTrack(row.music))
