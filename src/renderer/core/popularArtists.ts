import { httpFetch } from '@renderer/utils/request'
import { createPopularArtistsLoader } from '@common/utils/popularArtists'
export const getPopularArtists = createPopularArtistsLoader(async() => {
  const request = httpFetch('https://music.163.com/api/artist/top?offset=0&limit=12', { timeout: 12000, headers: { Referer: 'https://music.163.com/' } }) as unknown as { promise: Promise<{ statusCode: number, body: unknown }> }
  const response = await request.promise
  if (response.statusCode != 200) throw new Error('artists_unavailable')
  return typeof response.body == 'string' ? JSON.parse(response.body) : response.body
})
