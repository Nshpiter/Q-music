import { createPopularArtistsLoader } from '@/utils/popularArtists'
export const getPopularArtists = createPopularArtistsLoader(async() => {
  const controller = new AbortController()
  const timer = setTimeout(() => { controller.abort() }, 12000)
  try {
    const response = await fetch('https://music.163.com/api/artist/top?offset=0&limit=12', { credentials: 'omit', headers: { Referer: 'https://music.163.com/' }, signal: controller.signal })
    if (!response.ok) throw new Error('artists_unavailable')
    return await response.json()
  } finally { clearTimeout(timer) }
})
