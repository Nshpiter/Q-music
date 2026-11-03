import { createKugouFavoriteClient } from '@/utils/kugouFavorite'
import { assertKugouSession, kugouApi, requireKugouSession } from './kugou'
import type { KugouCaptchaPresenter } from './kugouApi'

export const createKugouFavoriteAction = (present: KugouCaptchaPresenter) => createKugouFavoriteClient(async() => {
  const session = await requireKugouSession()
  return {
    ownerId: session.userId,
    assertSession: async() => assertKugouSession(session),
    getFavorites: async() => kugouApi.getPlaylists(session),
    getHashes: async(id) => kugouApi.getPlaylistHashes(session, id),
    addSong: async(id, song) => kugouApi.addFavoriteSong(session, id, song),
    verifySession: async() => kugouApi.verifySession(session, present, async() => assertKugouSession(session)),
  }
})
