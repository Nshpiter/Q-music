// if (targetSong.key) { // 如果是已下载的歌曲
//   const filePath = path.join(appSetting['download.savePath'], targetSong.metadata.fileName)
//   // console.log(filePath)

import {
  getMusicUrl as getOnlineMusicUrl,
  getPicUrl as getOnlinePicUrl,
  getLyricInfo as getOnlineLyricInfo,
} from './online'
import {
  getMusicUrl as getDownloadMusicUrl,
  getPicUrl as getDownloadPicUrl,
  getLyricInfo as getDownloadLyricInfo,
} from './download'
import {
  getMusicUrl as getLocalMusicUrl,
  getPicUrl as getLocalPicUrl,
  getLyricInfo as getLocalLyricInfo,
} from './local'

import { findLocalPlayback } from './preferLocal'
import { appSetting } from '@renderer/store/setting'
import { requestMsg } from '@renderer/utils/message'
import { coverOverride } from '@renderer/store/coverOverrides'
import { lyricFiles, readLyricFile } from './lyricFile'
import type { UserApiProviderScope } from '@common/utils/userApiFallback'
export { isCustomApiSource } from './utils'

export interface MusicUrlResolvedInfo {
  requestedSource: LX.Source
  resolvedSource: LX.Source
  quality: LX.Quality | null
  mode: 'official' | 'api' | 'fallback' | 'cache' | 'local' | 'download'
  isFallback?: boolean
  routeKey?: string
  resolvedMusicInfo?: LX.Music.MusicInfo
  officialReportSongId?: string
  cacheProviderId?: string
}

export interface MusicUrlRequestOptions {
  allowQualityFallback?: boolean
  userApiScope?: UserApiProviderScope
  /** all 会遵循设置中的自定义 API 优先策略；显式值用于单次线路尝试。 */
  routeStrategy?: 'all' | 'official' | 'api'
  excludedUrls?: ReadonlySet<string>
  excludedRouteKeys?: ReadonlySet<string>
  refreshRouteKeys?: ReadonlySet<string>
  onRouteFailed?: (routeKey: string, url?: string) => void
  onRouteRateLimited?: (routeKey: string) => void
  blockedApiProviders?: Map<string, Error>
  signal?: AbortSignal
  directOnly?: boolean
  exact?: boolean
}


export const getMusicUrl = async({
  musicInfo,
  quality,
  isRefresh = false,
  onToggleSource,
  onResolved,
  allowToggleSource,
  requestOptions,
}: {
  musicInfo: LX.Music.MusicInfo | LX.Download.ListItem
  isRefresh?: boolean
  quality?: LX.Quality
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
  onResolved?: (info: MusicUrlResolvedInfo) => void
  allowToggleSource?: boolean
  requestOptions?: MusicUrlRequestOptions
}): Promise<string> => {
  if ('progress' in musicInfo) {
    return getDownloadMusicUrl({ musicInfo, isRefresh, onToggleSource, onResolved, allowToggleSource, requestOptions })
  } else if (musicInfo.source == 'local') {
    return getLocalMusicUrl({ musicInfo, isRefresh, onToggleSource, onResolved, allowToggleSource, requestOptions })
  } else {
    if (appSetting['player.preferLocal'] && !isRefresh) {
      const local = await findLocalPlayback(musicInfo, quality ?? appSetting['player.playQuality'], requestOptions).catch(() => null)
      if (requestOptions?.signal?.aborted) throw new Error(requestMsg.cancelRequest)
      if (local) { onResolved?.(local.info); return local.url }
    }
    return getOnlineMusicUrl({ musicInfo, isRefresh, quality, onToggleSource, onResolved, allowToggleSource, requestOptions })
  }
}

export const getPicPath = async({
  musicInfo,
  isRefresh = false,
  listId,
  onToggleSource,
}: {
  musicInfo: LX.Music.MusicInfo | LX.Download.ListItem
  listId?: string | null
  isRefresh?: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<string> => {
  const track = 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
  const custom = coverOverride(track)
  if (custom) return custom
  const resolved = 'progress' in musicInfo
    ? await getDownloadPicUrl({ musicInfo, isRefresh, listId, onToggleSource })
    : musicInfo.source == 'local'
      ? await getLocalPicUrl({ musicInfo, isRefresh, listId, onToggleSource })
      : await getOnlinePicUrl({ musicInfo, isRefresh, listId, onToggleSource })
  return coverOverride(track) || resolved
}

export const getLyricInfo = async({
  musicInfo,
  isRefresh = false,
  onToggleSource,
}: {
  musicInfo: LX.Music.MusicInfo | LX.Download.ListItem
  isRefresh?: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<LX.Player.LyricInfo> => {
  const track = 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
  const selected = lyricFiles.get(track)
  if (selected) {
    const custom = await readLyricFile(selected, track).catch(() => null)
    if (custom && lyricFiles.get(track) === selected) return custom
  }
  const result = 'progress' in musicInfo
    ? await getDownloadLyricInfo({ musicInfo, isRefresh, onToggleSource })
    : musicInfo.source === 'local'
      ? await getLocalLyricInfo({ musicInfo, isRefresh, onToggleSource })
      : await getOnlineLyricInfo({ musicInfo, isRefresh, onToggleSource })
  const latest = lyricFiles.get(track)
  return latest && latest !== selected ? readLyricFile(latest, track).catch(() => result) : result
}
