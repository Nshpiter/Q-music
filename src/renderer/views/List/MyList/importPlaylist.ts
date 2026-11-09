import { LIST_IDS } from '@common/constants'
import { filterMusicList, toNewMusicInfo } from '@renderer/utils'
import musicSdk from '@renderer/utils/musicSdk'
import { getListDetail } from '@renderer/store/songList/action'
import { addListMusics, createUserList, overwriteListMusics, getListMusics } from '@renderer/store/list/action'
import { getListUpdateInfo, setListSourceAccount, setListSourceSnapshot, setListAutoUpdate, setListUpdateTime } from '@renderer/utils/data'
import { createSourceSnapshot, mergeSourcePlaylist } from '@common/utils/playlistMerge'
import { resolveQQPlaylistTracks } from '@common/utils/qqPlaylist'
import { userLists } from '@renderer/store/list/state'
import { getMusicAccountPlaylistDetail, type MusicAccountPlaylist, type MusicAccountProvider } from '@renderer/utils/ipc'
import wyMusicDetail from '@renderer/utils/musicSdk/wy/musicDetail'
import txMusicInfo from '@renderer/utils/musicSdk/tx/musicInfo'
import { bilibiliClient } from '@renderer/utils/musicSdk/bi'

export type ExternalImportSource = 'tx' | 'wy' | 'kg' | 'bi'
export type ExternalImportTarget = 'new' | 'current' | 'love'

export type ExternalImportErrorCode = 'invalid_link' | 'no_match' | 'account_unavailable' | 'account_changed' | 'cancelled' | 'verification_required' | 'login_required' | 'playlist_incomplete'

export class ExternalImportError extends Error {
  code: ExternalImportErrorCode

  constructor(code: ExternalImportErrorCode, message?: string) {
    super(message ?? code)
    this.code = code
  }
}

export interface ExternalImportParams {
  source: ExternalImportSource
  text: string
  listName: string
  target: ExternalImportTarget
  currentListId: string
  neteaseToken?: string
}

export interface ExternalImportProgress {
  stage: 'fetch' | 'save'
  current: number
  total: number
}

export interface ExternalImportResult {
  /** 实际读取到的歌曲数 */
  total: number
  /** 来源歌单声明的歌曲总数，大于 total 时说明只读取到了一部分 */
  sourceTotal: number
  imported: number
  unmatched: number
  listName: string
}

export interface AccountPlaylistImportParams {
  provider: MusicAccountProvider
  playlist: MusicAccountPlaylist
  target: ExternalImportTarget
  currentListId: string
}

const sourceNames: Record<ExternalImportSource, string> = {
  tx: 'QQ音乐',
  wy: '网易云音乐',
  kg: '酷狗音乐',
  bi: '哔哩哔哩',
}

const getDefaultListName = (source: ExternalImportSource) => {
  return `${sourceNames[source]}导入歌单`
}

const normalizeToken = (token = '') => token.trim().replace(/^Bearer\s+/i, '')

// 国内源歌单分页上限，total/limit 来自外部响应，不可信
const NATIVE_MAX_FETCH_PAGES = 500

export type ShouldCancel = () => boolean

const assertNotCancelled = (shouldCancel?: ShouldCancel) => {
  if (shouldCancel?.()) throw new ExternalImportError('cancelled')
}

const getNeteaseInput = (text: string, token?: string) => {
  const trimmedToken = normalizeToken(token)
  if (!trimmedToken || text.includes('###')) return text
  return `${text}###${trimmedToken}`
}

const fetchNativeList = async(params: ExternalImportParams, onProgress?: (progress: ExternalImportProgress) => void, shouldCancel?: ShouldCancel) => {
  const source = params.source
  if (source == 'bi') {
    const result = await bilibiliClient.importCollection(params.text, (current, total) => onProgress?.({ stage: 'fetch', current, total }), shouldCancel).catch((error: Error) => {
      if (error.message == 'invalid_link' || error.message == 'cancelled') throw new ExternalImportError(error.message)
      if (error.message == 'incomplete') throw new ExternalImportError('playlist_incomplete')
      throw error
    })
    return { listName: result.name, list: result.list.map(item => toNewMusicInfo(item as unknown as LX.Music.MusicInfoOnline)), unmatched: 0, sourceTotal: result.total }
  }
  const text = source == 'wy' ? getNeteaseInput(params.text, params.neteaseToken) : params.text
  const readPage = async(page: number) => getListDetail(text, source, page, page == 1).catch((error: unknown) => {
    const code = error instanceof Error ? error.message : ''
    if (code == 'invalid_link' || code == 'login_required' || code == 'verification_required' || code == 'cancelled') throw new ExternalImportError(code)
    if (code == 'incomplete') throw new ExternalImportError('playlist_incomplete')
    throw error
  })
  const detail = await readPage(1)
  const list: LX.Music.MusicInfo[] = [...detail.list]

  const total = typeof detail.total == 'number' && detail.total > 0 ? detail.total : list.length
  const limit = typeof detail.limit == 'number' && detail.limit > 0 ? detail.limit : Math.max(list.length, 1)
  const maxPage = Math.min(Math.ceil(total / limit), NATIVE_MAX_FETCH_PAGES)
  onProgress?.({
    stage: 'fetch',
    current: Math.min(list.length, total),
    total,
  })

  for (let page = 2; page <= maxPage; page++) {
    assertNotCancelled(shouldCancel)
    let pageDetail
    try {
      pageDetail = await readPage(page)
    } catch (error) {
      if (error instanceof ExternalImportError && ['login_required', 'verification_required', 'cancelled'].includes(error.code)) throw error
      // 已拿到部分数据时不整单作废，用已抓取的曲目继续后续流程
      if (list.length) break
      throw error
    }
    list.push(...pageDetail.list)
    onProgress?.({
      stage: 'fetch',
      current: Math.min(list.length, total),
      total,
    })
  }

  return {
    listName: detail.info?.name ?? getDefaultListName(source),
    list,
    unmatched: 0,
    sourceTotal: Math.max(total, list.length),
  }
}

const writeMusicList = async(params: ExternalImportParams, list: LX.Music.MusicInfo[], onProgress?: (progress: ExternalImportProgress) => void) => {
  const musicInfos = filterMusicList(list)
  if (!musicInfos.length) throw new ExternalImportError('no_match')

  onProgress?.({
    stage: 'save',
    current: 0,
    total: musicInfos.length,
  })

  switch (params.target) {
    case 'new':
      await createUserList({
        name: params.listName || getDefaultListName(params.source),
        list: musicInfos,
        ...(params.source == 'bi' ? { source: params.source, sourceListId: params.text.trim() } : {}),
      })
      break
    case 'love':
      await addListMusics(LIST_IDS.LOVE, musicInfos)
      break
    case 'current':
    default:
      await addListMusics(params.currentListId, musicInfos)
      break
  }

  onProgress?.({
    stage: 'save',
    current: musicInfos.length,
    total: musicInfos.length,
  })

  return musicInfos.length
}

export const loadAccountPlaylistMusic = async(
  provider: MusicAccountProvider,
  playlistId: string,
  onProgress?: (progress: ExternalImportProgress) => void,
  shouldCancel?: ShouldCancel,
  options: { existingMusic?: LX.Music.MusicInfo[], accountId?: string, onAccount?: (accountId: string) => void } = {},
) => {
  const result = await getMusicAccountPlaylistDetail(provider, playlistId)
  assertNotCancelled(shouldCancel)
  if (result.status != 'available') throw new ExternalImportError(result.status == 'unavailable' ? 'account_unavailable' : result.status)
  if (provider == 'tx') {
    if (!result.accountId || (options.accountId && options.accountId != result.accountId)) throw new ExternalImportError('account_changed')
    const cached = new Map<string, LX.Music.MusicInfo>()
    for (const song of options.existingMusic ?? []) {
      if (song.source == 'tx') cached.set(String(song.meta.songId), song)
    }
    // 账号歌单已经返回完整歌曲信息，优先复用，避免大歌单再逐首请求匿名接口。
    const tracks = (result.tracks ?? []).filter(track => track.mid && track.title && track.file && track.album)
    for (const item of musicSdk.tx.songList.filterListDetail(tracks)) {
      const song = toNewMusicInfo(item)
      cached.set(String(song.meta.songId), song)
    }
    const list = await resolveQQPlaylistTracks(result.ids, cached, async id => {
      const item = await txMusicInfo(id)
      if (!item) throw new ExternalImportError('playlist_incomplete')
      const song = toNewMusicInfo(item)
      if (song.source != 'tx' || String(song.meta.songId) != id) throw new ExternalImportError('playlist_incomplete')
      return song
    }, (current, total) => onProgress?.({ stage: 'fetch', current, total }), shouldCancel)
    options.onAccount?.(result.accountId)
    return list
  }
  if (!result.ids.length) return []
  if (provider == 'kg') return loadKugouHashMusic(result.ids, onProgress, shouldCancel)

  const list: LX.Music.MusicInfo[] = []
  const authenticated = result.tracks && result.privileges
    ? wyMusicDetail.filterList({ songs: result.tracks, privileges: result.privileges }).map((item: LX.Music.MusicInfoOnline) => toNewMusicInfo(item)) as LX.Music.MusicInfo[]
    : undefined
  const byId = new Map(authenticated?.map(song => [String(song.meta.songId), song]))
  const chunkSize = 200
  for (let index = 0; index < result.ids.length; index += chunkSize) {
    assertNotCancelled(shouldCancel)
    const ids = result.ids.slice(index, index + chunkSize)
    if (!authenticated) {
      const data = await wyMusicDetail.getList(ids)
      for (const item of data.list) {
        const song = toNewMusicInfo(item)
        byId.set(String(song.meta.songId), song)
      }
    }
    for (const id of ids) {
      const song = byId.get(id)
      if (!song?.name) throw new ExternalImportError('playlist_incomplete')
      list.push(song)
    }
    onProgress?.({
      stage: 'fetch',
      current: Math.min(index + ids.length, result.ids.length),
      total: result.ids.length,
    })
  }
  return filterMusicList(list)
}

export const loadKugouHashMusic = async(ids: string[], onProgress?: (progress: ExternalImportProgress) => void, shouldCancel?: ShouldCancel) => {
  const list: LX.Music.MusicInfo[] = []
  for (let index = 0; index < ids.length; index += 100) {
    assertNotCancelled(shouldCancel)
    const group = ids.slice(index, index + 100)
    const songs = await musicSdk.kg.songList.getMusicInfos(group.map(hash => ({ hash })), { requireComplete: true, shouldCancel }).catch((error: Error) => {
      throw new ExternalImportError(error.message == 'cancelled' || error.message == 'verification_required' || error.message == 'login_required' ? error.message : 'playlist_incomplete')
    })
    list.push(...songs.map((item: LX.Music.MusicInfoOnline) => toNewMusicInfo(item)))
    onProgress?.({ stage: 'fetch', current: Math.min(index + group.length, ids.length), total: ids.length })
  }
  return filterMusicList(list)
}

export const importAccountPlaylist = async(
  params: AccountPlaylistImportParams,
  onProgress?: (progress: ExternalImportProgress) => void,
  shouldCancel?: ShouldCancel,
): Promise<ExternalImportResult> => {
  const existing = params.target == 'new' ? userLists.find(item => item.source == params.provider && item.sourceListId == params.playlist.id) : undefined
  const updateInfo = existing ? (await getListUpdateInfo())[existing.id] : undefined
  let accountId: string | undefined
  const list = await loadAccountPlaylistMusic(params.provider, params.playlist.id, onProgress, shouldCancel, {
    existingMusic: existing ? await getListMusics(existing.id) : [],
    accountId: updateInfo?.sourceAccountId ?? params.playlist.accountId,
    onAccount: value => { accountId = value },
  })
  if (!list.length && params.provider != 'tx') throw new ExternalImportError('no_match')
  assertNotCancelled(shouldCancel)
  onProgress?.({ stage: 'save', current: 0, total: list.length })

  if (params.target == 'new') {
    const listId = existing?.id ?? `userlist_${Date.now()}`
    const sourceKey = `${params.provider}:${params.playlist.id}`
    if (existing) {
      const current = await getListMusics(existing.id)
      assertNotCancelled(shouldCancel)
      if (!userLists.some(item => item.id == existing.id && item.source == params.provider && item.sourceListId == params.playlist.id)) throw new ExternalImportError('cancelled')
      await overwriteListMusics({ listId: existing.id, musicInfos: mergeSourcePlaylist(current, list, sourceKey, updateInfo?.sourceSnapshot) })
    } else {
      await createUserList({
        id: listId,
        name: params.playlist.name,
        list,
        source: params.provider,
        sourceListId: params.playlist.id,
      })
    }
    await setListSourceSnapshot(listId, createSourceSnapshot(sourceKey, list))
    if (params.provider == 'tx' && accountId) {
      await setListSourceAccount(listId, accountId)
      if (!existing || updateInfo == null) await setListAutoUpdate(listId, true)
      await setListUpdateTime(listId, Date.now())
    }
  } else {
    await addListMusics(params.target == 'love' ? LIST_IDS.LOVE : params.currentListId, list)
  }

  onProgress?.({ stage: 'save', current: list.length, total: list.length })
  const sourceTotal = params.playlist.trackCount > 0 ? params.playlist.trackCount : list.length
  return {
    total: list.length,
    sourceTotal,
    imported: list.length,
    unmatched: Math.max(0, sourceTotal - list.length),
    listName: params.playlist.name,
  }
}

export const importExternalPlaylist = async(params: ExternalImportParams, onProgress?: (progress: ExternalImportProgress) => void, shouldCancel?: ShouldCancel): Promise<ExternalImportResult> => {
  assertNotCancelled(shouldCancel)
  const result = await fetchNativeList(params, onProgress, shouldCancel)
  const listName = params.listName || result.listName
  const { list, sourceTotal, unmatched } = result
  const total = list.length

  assertNotCancelled(shouldCancel)
  const imported = await writeMusicList({
    ...params,
    listName,
  }, list, onProgress)

  return {
    total,
    sourceTotal,
    imported,
    unmatched,
    listName,
  }
}
