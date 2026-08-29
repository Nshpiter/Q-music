import { encodePath } from '@common/utils/common'
import { updateListMusics } from '@renderer/store/list/action'
import { saveLyric, saveMusicUrl } from '@renderer/utils/ipc'
import { getLocalFilePath } from '@renderer/utils/music'
import { requestMsg } from '@renderer/utils/message'

import {
  buildLyricInfo,
  getCachedLyricInfo,
  getOnlineOtherSourceLyricByLocal,
  getOnlineOtherSourceLyricInfo,
  getOnlineOtherSourceMusicUrl,
  getOnlineOtherSourceMusicUrlByLocal,
  getOnlineOtherSourcePicByLocal,
  getOnlineOtherSourcePicUrl,
  getOtherSource,
} from './utils'
import type { MusicUrlRequestOptions, MusicUrlResolvedInfo } from './index'


const getOtherSourceByLocal = async<T>(
  musicInfo: LX.Music.MusicInfoLocal,
  handler: (infos: LX.Music.MusicInfoOnline[]) => Promise<T>,
  signal?: AbortSignal,
) => {
  const candidates: Array<{ musicInfo: LX.Music.MusicInfoLocal, isRefresh: boolean }> = [{ musicInfo, isRefresh: false }]
  const candidateKeys = new Set([`${musicInfo.name}\n${musicInfo.singer}`])
  const addCandidate = (name: string, singer: string) => {
    const key = `${name}\n${singer}`
    if (candidateKeys.has(key)) return
    candidateKeys.add(key)
    candidates.push({ musicInfo: { ...musicInfo, name, singer }, isRefresh: true })
  }

  if (musicInfo.name.includes('-')) {
    const [name, singer] = musicInfo.name.split('-').map(val => val.trim())
    addCandidate(name, singer)
    addCandidate(singer, name)
  }
  let fileName = musicInfo.meta.filePath.split(/\/|\\/).at(-1)
  if (fileName) {
    fileName = fileName.substring(0, fileName.lastIndexOf('.'))
    if (fileName != musicInfo.name) {
      if (fileName.includes('-')) {
        const [name, singer] = fileName.split('-').map(val => val.trim())
        addCandidate(name, singer)
        addCandidate(singer, name)
      } else {
        addCandidate(fileName, '')
      }
    }
  }

  let lastError: Error | null = null
  let rateLimitError: Error | null = null
  for (const candidate of candidates) {
    if (signal?.aborted) throw new Error(requestMsg.cancelRequest)
    let result: LX.Music.MusicInfoOnline[]
    try {
      result = await getOtherSource(candidate.musicInfo, candidate.isRefresh, signal)
    } catch (error: any) {
      if (error.message == requestMsg.cancelRequest) throw error
      lastError = error instanceof Error ? error : new Error('source search failed')
      continue
    }
    if (!result.length) continue
    try {
      return await handler(result)
    } catch (error: any) {
      if (error.message == requestMsg.cancelRequest) throw error
      lastError = error instanceof Error ? error : new Error('source route failed')
      if (error.message == requestMsg.tooManyRequests) rateLimitError = lastError
    }
  }

  throw rateLimitError ?? lastError ?? new Error('source not found')
}

export const getMusicUrl = async({ musicInfo, isRefresh, allowToggleSource = true, onToggleSource = () => {}, onResolved, requestOptions }: {
  musicInfo: LX.Music.MusicInfoLocal
  isRefresh: boolean
  allowToggleSource?: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
  onResolved?: (info: MusicUrlResolvedInfo) => void
  requestOptions?: MusicUrlRequestOptions
}): Promise<string> => {
  const localRouteKey = `local:${musicInfo.id}`
  if (!isRefresh) {
    const path = await getLocalFilePath(musicInfo)
    if (path && !requestOptions?.excludedRouteKeys?.has(localRouteKey)) {
      const url = encodePath(path)
      if (!requestOptions?.excludedUrls?.has(url)) {
        onResolved?.({
          requestedSource: musicInfo.source,
          resolvedSource: musicInfo.source,
          quality: null,
          mode: 'local',
          routeKey: localRouteKey,
          resolvedMusicInfo: musicInfo,
        })
        return url
      }
      requestOptions?.onRouteFailed?.(localRouteKey, url)
    }
  }

  if (requestOptions?.directOnly) {
    requestOptions.onRouteFailed?.(localRouteKey)
    throw new Error('local music file unavailable')
  }

  let initialError: Error | null = null
  try {
    return await getOnlineOtherSourceMusicUrlByLocal(musicInfo, isRefresh, requestOptions).then(({ url, quality, isFromCache, routeKey, transportMode, cacheProviderId }) => {
      onResolved?.({
        requestedSource: musicInfo.source,
        resolvedSource: musicInfo.source,
        quality,
        mode: transportMode,
        routeKey,
        resolvedMusicInfo: musicInfo,
        cacheProviderId,
      })
      if (!isFromCache) void saveMusicUrl(musicInfo, quality, url, cacheProviderId)
      return url
    })
  } catch (err: any) {
    if (err.message == requestMsg.cancelRequest) throw err
    initialError = err instanceof Error ? err : new Error('local source route failed')
  }

  if (!allowToggleSource) throw initialError ?? new Error('failed')

  onToggleSource()
  try {
    return await getOtherSourceByLocal(musicInfo, async(otherSource) => {
      return getOnlineOtherSourceMusicUrl({ musicInfos: [...otherSource], onToggleSource, isRefresh, requestOptions }).then(({ url, quality: targetQuality, musicInfo: targetMusicInfo, isFromCache, routeKey, transportMode, cacheProviderId }) => {
        // saveLyric(musicInfo, data.lyricInfo)
        onResolved?.({
          requestedSource: musicInfo.source,
          resolvedSource: targetMusicInfo.source,
          quality: targetQuality,
          mode: transportMode,
          routeKey,
          resolvedMusicInfo: targetMusicInfo,
          cacheProviderId,
        })
        if (!isFromCache) void saveMusicUrl(targetMusicInfo, targetQuality, url, cacheProviderId)

        // TODO: save url ?
        return url
      })
    }, requestOptions?.signal)
  } catch (error: any) {
    if (error.message == requestMsg.cancelRequest) throw error
    if (initialError?.message == requestMsg.tooManyRequests && error.message != requestMsg.tooManyRequests) throw initialError
    throw error
  }
}

export const getPicUrl = async({ musicInfo, listId, isRefresh, onToggleSource = () => {} }: {
  musicInfo: LX.Music.MusicInfoLocal
  listId?: string | null
  isRefresh: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<string> => {
  if (!isRefresh) {
    const pic = await window.lx.worker.main.getMusicFilePic(musicInfo.meta.filePath)
    if (pic) return pic

    if (musicInfo.meta.picUrl) return musicInfo.meta.picUrl
  }

  try {
    return await getOnlineOtherSourcePicByLocal(musicInfo).then(({ url }) => {
      return url
    })
  } catch {}

  onToggleSource()
  return getOtherSourceByLocal(musicInfo, async(otherSource) => {
    return getOnlineOtherSourcePicUrl({ musicInfos: [...otherSource], onToggleSource, isRefresh }).then(({ url, musicInfo: targetMusicInfo, isFromCache }) => {
      if (listId) {
        musicInfo.meta.picUrl = url
        void updateListMusics([{ id: listId, musicInfo }])
      }

      return url
    })
  })
}

export const getLyricInfo = async({ musicInfo, isRefresh, onToggleSource = () => {} }: {
  musicInfo: LX.Music.MusicInfoLocal
  isRefresh: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<LX.Player.LyricInfo> => {
  if (!isRefresh) {
    const [lyricInfo, fileLyricInfo] = await Promise.all([getCachedLyricInfo(musicInfo), window.lx.worker.main.getMusicFileLyric(musicInfo.meta.filePath)])
    // console.log(lyricInfo, fileLyricInfo)
    if (lyricInfo?.lyric && lyricInfo.lyric != fileLyricInfo?.lyric) {
      // 存在已编辑歌词
      return buildLyricInfo({ ...lyricInfo, rawlrcInfo: fileLyricInfo ?? lyricInfo.rawlrcInfo })
    }

    if (fileLyricInfo) return buildLyricInfo(fileLyricInfo)
    if (lyricInfo?.lyric) return buildLyricInfo(lyricInfo)
  }

  try {
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    return await getOnlineOtherSourceLyricByLocal(musicInfo, isRefresh).then(({ lyricInfo, isFromCache }) => {
      if (!isFromCache) void saveLyric(musicInfo, lyricInfo)
      return buildLyricInfo(lyricInfo)
    })
  } catch {}

  onToggleSource()
  return getOtherSourceByLocal(musicInfo, async(otherSource) => {
    return getOnlineOtherSourceLyricInfo({ musicInfos: [...otherSource], onToggleSource, isRefresh }).then(async({ lyricInfo, musicInfo: targetMusicInfo, isFromCache }) => {
      void saveLyric(musicInfo, lyricInfo)

      if (isFromCache) return buildLyricInfo(lyricInfo)
      void saveLyric(targetMusicInfo, lyricInfo)

      return buildLyricInfo(lyricInfo)
    })
  })
}
