import { getQQPlaylistTargets } from '@/utils/qqPlaylistTarget'
import { getQQCredentials } from './qqCredentials'
import { openAccountSession, assertAccountSession, qqRequest } from './requests'
import { openPlaylistSession, assertPlaylistSession, getAccountPlaylists, type AccountPlaylist } from './playlists'
import type { MusicAccountProvider } from './types'

export const getWritablePlaylists = async(provider: MusicAccountProvider, signal?: AbortSignal): Promise<AccountPlaylist[]> => {
  if (provider == 'tx') {
    const session = await openAccountSession(provider)
    const lists = await getQQPlaylistTargets(getQQCredentials(session.cookies).uin, async(name, module, method, param) => {
      return (await qqRequest(session, { [name]: { module, method, param } }, signal))[name].data
    })
    await assertAccountSession(session)
    return lists
  }
  const session = await openPlaylistSession(provider, signal)
  const lists = await getAccountPlaylists(session, signal)
  await assertPlaylistSession(session)
  return lists.filter(list => list.kind == 'created' && (provider != 'kg' || list.writable === true)).map(list => provider == 'kg' ? { ...list, id: `account:${session.owner}:${list.id}` } : list)
}
