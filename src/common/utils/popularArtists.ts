export interface PopularArtist { id: string, name: string, picture: string }
export const createPopularArtistsLoader = (request: () => Promise<unknown>) => {
  let cache: { artists: PopularArtist[], expires: number } | undefined
  let pending: Promise<PopularArtist[]> | undefined
  return async() => {
    if (cache && cache.expires > Date.now()) return cache.artists
    pending ??= request().then(value => {
      const body = value as { code?: number, artists?: Array<{ id?: unknown, name?: unknown, picUrl?: unknown }> }
      if (body?.code != 200 || !Array.isArray(body.artists)) throw new Error('artists_unavailable')
      const artists = body.artists.filter(item => /^\d+$/.test(String(item.id)) && typeof item.name == 'string' && item.name.trim()).slice(0, 12).map(item => {
        const picture = String(item.picUrl ?? '').replace(/^http:/, 'https:')
        return { id: String(item.id), name: String(item.name), picture: /^https:\/\/[\w.-]+\.music\.126\.net\//i.test(picture) ? picture : '' }
      })
      if (!artists.length) throw new Error('artists_unavailable')
      cache = { artists, expires: Date.now() + 600_000 }
      return artists
    }).finally(() => { pending = undefined })
    return pending
  }
}
