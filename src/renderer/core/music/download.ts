import { getDownloadFilePath } from '@renderer/utils/music'

import {
  getMusicUrl as getOnlineMusicUrl,
  getPicUrl as getOnlinePicUrl,
  getLyricInfo as getOnlineLyricInfo,
} from './online'
import { buildLyricInfo, getCachedLyricInfo } from './utils'
import { buildSavePath } from '@renderer/store/download/utils'
import type { MusicUrlRequestOptions, MusicUrlResolvedInfo } from './index'

export const getMusicUrl = async({ musicInfo, isRefresh, allowToggleSource = true, onToggleSource = () => {}, onResolved, requestOptions }: {
  musicInfo: LX.Download.ListItem
  isRefresh: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
  onResolved?: (info: MusicUrlResolvedInfo) => void
  allowToggleSource?: boolean
  requestOptions?: MusicUrlRequestOptions
}): Promise<string> => {
  const onlineMusicInfo = musicInfo.metadata.musicInfo
  const routeKey = `download:${onlineMusicInfo.source}:${musicInfo.id}`
  if (!isRefresh) {
    const path = await getDownloadFilePath(musicInfo, buildSavePath(musicInfo))
    if (path && !requestOptions?.excludedRouteKeys?.has(routeKey)) {
      if (!requestOptions?.excludedUrls?.has(path)) {
        onResolved?.({
          requestedSource: onlineMusicInfo.source,
          resolvedSource: onlineMusicInfo.source,
          quality: musicInfo.metadata.quality,
          mode: 'download',
          routeKey,
          resolvedMusicInfo: onlineMusicInfo,
        })
        return path
      }
      requestOptions?.onRouteFailed?.(routeKey, path)
    }
  }

  if (requestOptions?.directOnly) {
    requestOptions.onRouteFailed?.(routeKey)
    throw new Error('downloaded music file unavailable')
  }

  return getOnlineMusicUrl({ musicInfo: onlineMusicInfo, isRefresh, onToggleSource, onResolved, allowToggleSource, requestOptions })
}

export const getPicUrl = async({ musicInfo, isRefresh, listId, onToggleSource = () => {} }: {
  musicInfo: LX.Download.ListItem
  isRefresh: boolean
  listId?: string | null
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<string> => {
  if (!isRefresh) {
    const path = await getDownloadFilePath(musicInfo, buildSavePath(musicInfo))
    if (path) {
      const pic = await window.lx.worker.main.getMusicFilePic(path)
      if (pic) return pic
    }

    const onlineMusicInfo = musicInfo.metadata.musicInfo
    if (onlineMusicInfo.meta.picUrl) return onlineMusicInfo.meta.picUrl
  }

  return getOnlinePicUrl({ musicInfo: musicInfo.metadata.musicInfo, isRefresh, onToggleSource }).then((url) => {
    // TODO: when listId required save url (update downloadInfo)

    return url
  })
}

export const getLyricInfo = async({ musicInfo, isRefresh, onToggleSource = () => {} }: {
  musicInfo: LX.Download.ListItem
  isRefresh: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<LX.Player.LyricInfo> => {
  if (!isRefresh) {
    const lyricInfo = await getCachedLyricInfo(musicInfo.metadata.musicInfo)
    if (lyricInfo) return buildLyricInfo(lyricInfo)
  }

  return getOnlineLyricInfo({
    musicInfo: musicInfo.metadata.musicInfo,
    isRefresh,
    onToggleSource,
  }).catch(async() => {
    // 尝试读取文件内歌词
    const path = await getDownloadFilePath(musicInfo, buildSavePath(musicInfo))
    if (path) {
      const rawlrcInfo = await window.lx.worker.main.getMusicFileLyric(path)
      if (rawlrcInfo) return buildLyricInfo(rawlrcInfo)
    }

    throw new Error('failed')
  })
}
