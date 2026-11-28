export const filterTracks = <T>(rows: T[], query: string, getTrack: (row: T) => LX.Music.MusicInfo): T[] => {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return rows
  return rows.filter(row => {
    const track = getTrack(row)
    const text = `${track.name} ${track.singer} ${track.meta?.albumName ?? ''}`.toLowerCase()
    return terms.every(term => text.includes(term))
  })
}
