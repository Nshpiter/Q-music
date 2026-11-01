import { createNeteaseFavoriteClient } from '@/utils/neteaseFavorite'
import { assertAccountSession, openAccountSession, request } from './requests'
import { weapi } from '@/utils/musicSdk/wy/utils/crypto'

export const addNeteaseFavoriteSong = createNeteaseFavoriteClient(async() => {
  const session = await openAccountSession('wy')
  return {
    assertSession: async() => assertAccountSession(session),
    request: async(path, data) => {
      const csrf = session.cookies.__csrf ?? ''
      return request(`https://music.163.com/weapi/${path}?csrf_token=${encodeURIComponent(csrf)}`, session.cookies, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://music.163.com', Referer: 'https://music.163.com/' },
        body: new URLSearchParams(weapi({ ...data, csrf_token: csrf })).toString(),
      })
    },
  }
})
