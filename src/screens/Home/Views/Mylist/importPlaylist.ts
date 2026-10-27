import { LIST_IDS } from '@/config/constant'
import { addListMusics, createList } from '@/core/list'
import { getListDetail } from '@/core/songlist'
import settingState from '@/store/setting/state'
import { filterMusicList } from '@/utils'

export type ExternalImportSource = 'tx' | 'wy' | 'kg'
export type ExternalImportTarget = 'new' | 'current' | 'love'

export type ExternalImportErrorCode = 'invalid_link' | 'no_match' | 'cancelled'

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
  total: number
  sourceTotal: number
  imported: number
  unmatched: number
  listName: string
}

export type ShouldCancel = () => boolean

const SOURCE_NAMES: Record<ExternalImportSource, string> = {
  tx: 'QQ音乐',
  wy: '网易云音乐',
  kg: '酷狗音乐',
}

const NATIVE_MAX_FETCH_PAGES = 500

export const getDefaultImportListName = (source: ExternalImportSource) => {
  return `${SOURCE_NAMES[source]}导入歌单`
}

const normalizeToken = (token = '') => token.trim().replace(/^Bearer\s+/i, '')

const assertNotCancelled = (shouldCancel?: ShouldCancel) => {
  if (shouldCancel?.()) throw new ExternalImportError('cancelled')
}

const getNeteaseInput = (text: string, token?: string) => {
  const trimmedToken = normalizeToken(token)
  if (!trimmedToken || text.includes('###')) return text
  return `${text}###${trimmedToken}`
}

const fetchNativeList = async(
  params: ExternalImportParams,
  onProgress?: (progress: ExternalImportProgress) => void,
  shouldCancel?: ShouldCancel,
) => {
  const source = params.source
  const text = source == 'wy' ? getNeteaseInput(params.text, params.neteaseToken) : params.text
  const detail = await getListDetail(text, source, 1, true)
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
    try {
      const pageDetail = await getListDetail(text, source, page)
      list.push(...pageDetail.list)
    } catch (error) {
      if (list.length) break
      throw error
    }
    onProgress?.({
      stage: 'fetch',
      current: Math.min(list.length, total),
      total,
    })
  }

  return {
    listName: detail.info?.name ?? getDefaultImportListName(source),
    list: filterMusicList(list),
    unmatched: 0,
    sourceTotal: Math.max(total, list.length),
  }
}

const writeMusicList = async(
  params: ExternalImportParams,
  list: LX.Music.MusicInfo[],
  onProgress?: (progress: ExternalImportProgress) => void,
) => {
  const musicInfos = filterMusicList(list)
  if (!musicInfos.length) throw new ExternalImportError('no_match')

  onProgress?.({
    stage: 'save',
    current: 0,
    total: musicInfos.length,
  })

  switch (params.target) {
    case 'new':
      await createList({
        name: params.listName || getDefaultImportListName(params.source),
        list: musicInfos,
      })
      break
    case 'love':
      await addListMusics(
        LIST_IDS.LOVE,
        musicInfos,
        settingState.setting['list.addMusicLocationType'],
      )
      break
    case 'current':
    default:
      await addListMusics(
        params.currentListId,
        musicInfos,
        settingState.setting['list.addMusicLocationType'],
      )
      break
  }

  onProgress?.({
    stage: 'save',
    current: musicInfos.length,
    total: musicInfos.length,
  })
  return musicInfos.length
}

export const importExternalPlaylist = async(
  params: ExternalImportParams,
  onProgress?: (progress: ExternalImportProgress) => void,
  shouldCancel?: ShouldCancel,
): Promise<ExternalImportResult> => {
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
