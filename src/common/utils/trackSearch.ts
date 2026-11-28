export const trackSearchTerms = (query: string) => query.trim().toLowerCase().split(/\s+/).filter(Boolean)

export const matchesTrackSearch = (track: LX.Music.MusicInfo, terms: string[]) => {
  const label = [track.name, track.singer, track.meta?.albumName].join(' ').toLowerCase()
  return terms.every(term => label.includes(term))
}
