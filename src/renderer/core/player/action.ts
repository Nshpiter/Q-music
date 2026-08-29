import { isEmpty, setPause, setPlay, setResource, setStop } from '@renderer/plugins/player'
import { isPlay, playedList, playInfo, playMusicInfo, playbackSourceInfo, tempPlayList, musicInfo as _musicInfo } from '@renderer/store/player/state'
import {
  getList,
  clearPlayedList,
  clearTempPlayeList,
  setPlayMusicInfo,
  addPlayedList,
  setMusicInfo,
  setAllStatus,
  removeTempPlayList,
  setPlayListId,
  removePlayedList,
} from '@renderer/store/player/action'
import { appSetting } from '@renderer/store/setting'
import { getMusicUrl, getPicPath, getLyricInfo } from '../music/index'
import type { MusicUrlRequestOptions, MusicUrlResolvedInfo } from '../music/index'
import { filterList } from './utils'
import { requestMsg } from '@renderer/utils/message'
import { getRandom } from '@renderer/utils/index'
import { addListMusics, removeListMusics } from '@renderer/store/list/action'
import { loveList } from '@renderer/store/list/state'
import { addDislikeInfo } from '@renderer/core/dislikeList'
import { removeMusicUrl as removeStoreMusicUrl } from '@renderer/utils/ipc'
// import { checkMusicFileAvailable } from '@renderer/utils/music'

let gettingUrlId = ''
let musicUrlRequestId = 0
let musicUrlAbortController: AbortController | null = null
const createGettingUrlId = (musicInfo: LX.Music.MusicInfo | LX.Download.ListItem) => {
  const originalMusicInfo = 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
  const tInfo = originalMusicInfo.meta.toggleMusicInfo
  return `${originalMusicInfo.source}:${originalMusicInfo.id}:${musicInfo.id}:${tInfo?.source ?? ''}:${tInfo?.id ?? ''}`
}

const playbackRouteState: {
  musicId: string
  failedUrls: Set<string>
  failedRouteKeys: Set<string>
  rateLimitedRouteKeys: Map<string, number>
  refreshRouteKeys: Set<string>
  currentUrl: string
  currentResolvedInfo: MusicUrlResolvedInfo | null
} = {
  musicId: '',
  failedUrls: new Set(),
  failedRouteKeys: new Set(),
  rateLimitedRouteKeys: new Map(),
  refreshRouteKeys: new Set(),
  currentUrl: '',
  currentResolvedInfo: null,
}

const resetPlaybackRouteState = (musicInfo: LX.Music.MusicInfo | LX.Download.ListItem) => {
  playbackRouteState.musicId = createGettingUrlId(musicInfo)
  playbackRouteState.failedUrls.clear()
  playbackRouteState.failedRouteKeys.clear()
  playbackRouteState.rateLimitedRouteKeys.clear()
  playbackRouteState.refreshRouteKeys.clear()
  playbackRouteState.currentUrl = ''
  playbackRouteState.currentResolvedInfo = null
}

const invalidateCurrentPlaybackRoute = () => {
  if (playbackRouteState.currentUrl) playbackRouteState.failedUrls.add(playbackRouteState.currentUrl)
  const resolvedInfo = playbackRouteState.currentResolvedInfo
  if (resolvedInfo?.routeKey) {
    if (
      playbackRouteState.refreshRouteKeys.has(resolvedInfo.routeKey) ||
      /^(cache|local|download):/.test(resolvedInfo.routeKey)
    ) {
      playbackRouteState.failedRouteKeys.add(resolvedInfo.routeKey)
      playbackRouteState.refreshRouteKeys.delete(resolvedInfo.routeKey)
    } else {
      playbackRouteState.refreshRouteKeys.add(resolvedInfo.routeKey)
    }
  }
  if (
    resolvedInfo?.resolvedMusicInfo &&
    resolvedInfo.quality &&
    resolvedInfo.cacheProviderId &&
    /^(cache|api):/.test(resolvedInfo.routeKey ?? '')
  ) {
    void removeStoreMusicUrl(resolvedInfo.resolvedMusicInfo, resolvedInfo.quality, resolvedInfo.cacheProviderId)
  }
  playbackRouteState.currentUrl = ''
  playbackRouteState.currentResolvedInfo = null
}

const createDelayNextTimeout = (delay: number) => {
  let timeout: NodeJS.Timeout | null
  const clearDelayNextTimeout = () => {
    // console.log(this.timeout)
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
  }

  const addDelayNextTimeout = () => {
    clearDelayNextTimeout()
    timeout = setTimeout(() => {
      timeout = null
      if (window.lx.isPlayedStop) return
      console.warn('delay next timeout timeout', delay)
      void playNext(true)
    }, delay)
  }

  return {
    clearDelayNextTimeout,
    addDelayNextTimeout,
  }
}
const { addDelayNextTimeout, clearDelayNextTimeout } = createDelayNextTimeout(5000)

const RATE_LIMIT_COOLDOWN = 15_000
const releaseRateLimitedRoutes = () => {
  const now = Date.now()
  for (const [routeKey, expiresAt] of playbackRouteState.rateLimitedRouteKeys) {
    if (expiresAt > now) continue
    playbackRouteState.failedRouteKeys.delete(routeKey)
    playbackRouteState.rateLimitedRouteKeys.delete(routeKey)
  }
}

const getRateLimitRetryDelay = () => {
  const now = Date.now()
  let retryAt = now + 1_000
  for (const expiresAt of playbackRouteState.rateLimitedRouteKeys.values()) {
    retryAt = Math.max(retryAt, expiresAt)
  }
  return Math.max(1_000, retryAt - now)
}

/**
 * 检查音乐信息是否已更改
 */
const diffCurrentMusicInfo = (curMusicInfo: LX.Music.MusicInfo | LX.Download.ListItem): boolean => {
  // return curMusicInfo !== playMusicInfo.musicInfo || isPlay.value
  return gettingUrlId != createGettingUrlId(curMusicInfo) || curMusicInfo.id != playMusicInfo.musicInfo?.id || isPlay.value
}

let cancelDelayRetry: (() => void) | null = null
const delayRetry = async(musicInfo: LX.Music.MusicInfo | LX.Download.ListItem, requestId: number, signal: AbortSignal, isRefresh = false, quality?: LX.Quality): Promise<string | null> => {
  // if (cancelDelayRetry) cancelDelayRetry()
  return new Promise<string | null>((resolve, reject) => {
    const delay = getRateLimitRetryDelay()
    const time = Math.ceil(delay / 1_000)
    setAllStatus(window.i18n.t('player__getting_url_delay_retry', { time }))
    const tiemout = setTimeout(() => {
      releaseRateLimitedRoutes()
      getMusicPlayUrl(musicInfo, requestId, signal, isRefresh, true, quality).then((result) => {
        cancelDelayRetry = null
        resolve(result)
      }).catch(async(err: any) => {
        cancelDelayRetry = null
        reject(err)
      })
    }, delay)
    cancelDelayRetry = () => {
      clearTimeout(tiemout)
      cancelDelayRetry = null
      resolve(null)
    }
  })
}
const getMusicPlayUrl = async(musicInfo: LX.Music.MusicInfo | LX.Download.ListItem, requestId: number, signal: AbortSignal, isRefresh = false, isRateLimitRetry = false, quality?: LX.Quality): Promise<string | null> => {
  // this.musicInfo.url = await getMusicPlayUrl(targetSong, type)
  setAllStatus(window.i18n.t('player__getting_url'))
  releaseRateLimitedRoutes()

  const originalMusicInfo = 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
  const requestedSource = originalMusicInfo.source
  const blockedApiProviders = new Map<string, Error>()
  for (const routeKey of playbackRouteState.rateLimitedRouteKeys.keys()) {
    if (routeKey.startsWith('api-provider:')) {
      blockedApiProviders.set(routeKey.slice('api-provider:'.length), new Error(requestMsg.tooManyRequests))
    }
  }
  const requestOptions: MusicUrlRequestOptions = {
    excludedUrls: playbackRouteState.failedUrls,
    excludedRouteKeys: playbackRouteState.failedRouteKeys,
    refreshRouteKeys: playbackRouteState.refreshRouteKeys,
    blockedApiProviders,
    signal,
    onRouteFailed(routeKey, url) {
      if (requestId != musicUrlRequestId) return
      playbackRouteState.failedRouteKeys.add(routeKey)
      playbackRouteState.refreshRouteKeys.delete(routeKey)
      if (url) playbackRouteState.failedUrls.add(url)
    },
    onRouteRateLimited(routeKey) {
      if (requestId != musicUrlRequestId) return
      playbackRouteState.failedRouteKeys.add(routeKey)
      playbackRouteState.rateLimitedRouteKeys.set(routeKey, Date.now() + RATE_LIMIT_COOLDOWN)
    },
  }
  const handleResolved = (info: MusicUrlResolvedInfo) => {
    if (requestId != musicUrlRequestId) return
    const isFallback = info.resolvedSource != requestedSource
    playbackRouteState.currentResolvedInfo = { ...info, requestedSource, isFallback }
    const resolvedMusicInfo = info.resolvedMusicInfo
    playbackSourceInfo.value = {
      requestedSource,
      resolvedSource: info.resolvedSource,
      quality: info.quality,
      mode: info.mode,
      isFallback,
      resolvedSongId: info.officialReportSongId ?? (resolvedMusicInfo?.source == 'tx'
        ? String(resolvedMusicInfo.meta.id ?? '')
        : (resolvedMusicInfo ? String(resolvedMusicInfo.meta.songId ?? '') : '')),
      resolvedMediaId: resolvedMusicInfo?.source == 'tx' ? (resolvedMusicInfo.meta.strMediaMid ?? '') : '',
      officialSourceId: resolvedMusicInfo?.source == 'wy' ? String(resolvedMusicInfo.meta.albumId ?? '') : '',
    }
  }

  const attempts: Array<{
    musicInfo: LX.Music.MusicInfo | LX.Download.ListItem
    allowToggleSource: boolean
    routeStrategy: MusicUrlRequestOptions['routeStrategy']
    directOnly?: boolean
  }> = []
  const addOnlineAttempts = (onlineMusicInfo: LX.Music.MusicInfoOnline) => {
    const targetToggleMusicInfo = onlineMusicInfo.meta.toggleMusicInfo
    const hasExplicitToggle = !!targetToggleMusicInfo && (targetToggleMusicInfo.id != onlineMusicInfo.id || targetToggleMusicInfo.source != onlineMusicInfo.source)
    const primaryMusicInfo = hasExplicitToggle ? targetToggleMusicInfo : onlineMusicInfo
    const exactCandidates = hasExplicitToggle ? [primaryMusicInfo, onlineMusicInfo] : [onlineMusicInfo]
    for (const candidate of exactCandidates) {
      if (candidate.source == 'tx' || candidate.source == 'wy') {
        attempts.push({ musicInfo: candidate, allowToggleSource: false, routeStrategy: 'official' })
      }
      attempts.push({ musicInfo: candidate, allowToggleSource: false, routeStrategy: 'api' })
    }
    attempts.push({ musicInfo: primaryMusicInfo, allowToggleSource: true, routeStrategy: 'all' })
  }
  if ('progress' in musicInfo) {
    attempts.push({ musicInfo, allowToggleSource: false, routeStrategy: 'all', directOnly: true })
    addOnlineAttempts(originalMusicInfo as LX.Music.MusicInfoOnline)
  } else if (originalMusicInfo.source == 'local') {
    attempts.push({ musicInfo, allowToggleSource: false, routeStrategy: 'all', directOnly: true })
    attempts.push({ musicInfo, allowToggleSource: true, routeStrategy: 'all' })
  } else {
    addOnlineAttempts(originalMusicInfo)
  }

  let lastError: unknown = new Error('music URL unavailable')
  let rateLimitError: Error | null = null
  for (const attempt of attempts) {
    try {
      const url = await getMusicUrl({
        musicInfo: attempt.musicInfo,
        quality,
        isRefresh,
        allowToggleSource: attempt.allowToggleSource,
        requestOptions: { ...requestOptions, routeStrategy: attempt.routeStrategy, directOnly: attempt.directOnly },
        onResolved: handleResolved,
        onToggleSource() {
          if (diffCurrentMusicInfo(musicInfo)) return
          setAllStatus(window.i18n.t('toggle_source_try'))
        },
      })
      if (requestId != musicUrlRequestId) return null
      if (window.lx.isPlayedStop || diffCurrentMusicInfo(musicInfo)) return null
      return url
    } catch (err: any) {
      lastError = err
      if (err.message == requestMsg.cancelRequest) break
      if (err.message == requestMsg.tooManyRequests) rateLimitError = err
    }
  }

  const error = rateLimitError ?? (lastError instanceof Error ? lastError : new Error('music URL unavailable'))
  if (requestId != musicUrlRequestId) return null
  if (window.lx.isPlayedStop || diffCurrentMusicInfo(musicInfo) || error.message == requestMsg.cancelRequest) return null
  if (error.message == requestMsg.tooManyRequests && !isRateLimitRetry) return delayRetry(musicInfo, requestId, signal, isRefresh, quality)
  throw error
}

const setMusicUrlInternal = (musicInfo: LX.Music.MusicInfo | LX.Download.ListItem, isRefresh?: boolean, quality?: LX.Quality, preserveFailedRoutes = false) => {
  if (!preserveFailedRoutes && !isRefresh && quality == null && !diffCurrentMusicInfo(musicInfo)) return
  if (preserveFailedRoutes && musicInfo.id != playMusicInfo.musicInfo?.id) return
  if (cancelDelayRetry) cancelDelayRetry()
  musicUrlAbortController?.abort()
  const abortController = new AbortController()
  musicUrlAbortController = abortController
  if (!preserveFailedRoutes || playbackRouteState.musicId != createGettingUrlId(musicInfo)) resetPlaybackRouteState(musicInfo)
  clearDelayNextTimeout()
  playbackSourceInfo.value = null
  gettingUrlId = createGettingUrlId(musicInfo)
  const requestId = ++musicUrlRequestId
  void getMusicPlayUrl(musicInfo, requestId, abortController.signal, isRefresh, false, quality).then((url) => {
    if (requestId != musicUrlRequestId) return
    if (!url) return
    playbackRouteState.currentUrl = url
    setResource(url)
  }).catch((err: any) => {
    if (requestId != musicUrlRequestId) return
    console.log(err)
    setAllStatus(err.message)
    window.app_event.error()
    if (appSetting['player.autoSkipOnError']) addDelayNextTimeout()
  }).finally(() => {
    if (musicUrlAbortController == abortController) musicUrlAbortController = null
    if (requestId == musicUrlRequestId && musicInfo === playMusicInfo.musicInfo) {
      gettingUrlId = ''
    }
  })
}

export const setMusicUrl = (musicInfo: LX.Music.MusicInfo | LX.Download.ListItem, isRefresh?: boolean, quality?: LX.Quality) => {
  setMusicUrlInternal(musicInfo, isRefresh, quality)
}

export const retryMusicUrl = (musicInfo: LX.Music.MusicInfo | LX.Download.ListItem) => {
  const musicId = createGettingUrlId(musicInfo)
  if (gettingUrlId == musicId) return
  if (playbackRouteState.musicId != musicId) resetPlaybackRouteState(musicInfo)
  invalidateCurrentPlaybackRoute()
  setMusicUrlInternal(musicInfo, false, undefined, true)
}

// 恢复上次播放的状态
const handleRestorePlay = async(restorePlayInfo: LX.Player.SavedPlayInfo) => {
  const musicInfo = playMusicInfo.musicInfo
  if (!musicInfo) return

  setImmediate(() => {
    if (musicInfo.id != playMusicInfo.musicInfo?.id) return
    window.app_event.setProgress(appSetting['player.isSavePlayTime'] ? restorePlayInfo.time : 0, restorePlayInfo.maxTime)
    window.app_event.pause()
  })


  void getPicPath({ musicInfo, listId: playMusicInfo.listId }).then((url: string) => {
    if (musicInfo.id != playMusicInfo.musicInfo?.id || url == _musicInfo.pic) return
    setMusicInfo({ pic: url })
    window.app_event.picUpdated()
  }).catch(_ => _)

  void getLyricInfo({ musicInfo }).then((lyricInfo) => {
    if (musicInfo.id != playMusicInfo.musicInfo?.id) return
    setMusicInfo({
      lrc: lyricInfo.lyric,
      tlrc: lyricInfo.tlyric,
      lxlrc: lyricInfo.lxlyric,
      rlrc: lyricInfo.rlyric,
      rawlrc: lyricInfo.rawlrcInfo.lyric,
    })
    window.app_event.lyricUpdated()
  }).catch((err) => {
    console.log(err)
    if (musicInfo.id != playMusicInfo.musicInfo?.id) return
    setAllStatus(window.i18n.t('lyric__load_error'))
  })

  if (appSetting['player.togglePlayMethod'] == 'random' && !playMusicInfo.isTempPlay) addPlayedList({ ...playMusicInfo as LX.Player.PlayMusicInfo })
}


// 处理音乐播放
const handlePlay = () => {
  window.lx.isPlayedStop &&= false

  resetRandomNextMusicInfo()
  if (window.lx.restorePlayInfo) {
    void handleRestorePlay(window.lx.restorePlayInfo)
    window.lx.restorePlayInfo = null
    return
  }
  const musicInfo = playMusicInfo.musicInfo

  if (!musicInfo) return

  setStop()
  window.app_event.pause()

  clearDelayNextTimeout()


  if (appSetting['player.togglePlayMethod'] == 'random' && !playMusicInfo.isTempPlay) addPlayedList({ ...(playMusicInfo as LX.Player.PlayMusicInfo) })

  setMusicUrl(musicInfo)

  void getPicPath({ musicInfo, listId: playMusicInfo.listId }).then((url: string) => {
    if (musicInfo.id != playMusicInfo.musicInfo?.id || url == _musicInfo.pic) return
    setMusicInfo({ pic: url })
    window.app_event.picUpdated()
  }).catch(_ => _)

  void getLyricInfo({ musicInfo }).then((lyricInfo) => {
    if (musicInfo.id != playMusicInfo.musicInfo?.id) return
    setMusicInfo({
      lrc: lyricInfo.lyric,
      tlrc: lyricInfo.tlyric,
      lxlrc: lyricInfo.lxlyric,
      rlrc: lyricInfo.rlyric,
      rawlrc: lyricInfo.rawlrcInfo.lyric,
    })
    window.app_event.lyricUpdated()
  }).catch((err) => {
    console.log(err)
    if (musicInfo.id != playMusicInfo.musicInfo?.id) return
    setAllStatus(window.i18n.t('lyric__load_error'))
  })
}

/**
 * 播放列表内歌曲
 * @param listId 列表id
 * @param id 歌曲id
 */
export const playListById = (listId: string, id: string) => {
  const prevListId = playInfo.playerListId
  setPlayListId(listId)
  // pause()
  const musicInfo = getList(listId).find(m => m.id == id)
  if (!musicInfo) return
  setPlayMusicInfo(listId, musicInfo)
  if (appSetting['player.isAutoCleanPlayedList'] || prevListId != listId) clearPlayedList()
  clearTempPlayeList()
  handlePlay()
}

/**
 * 播放列表内歌曲
 * @param listId 列表id
 * @param index 播放的歌曲位置
 */
export const playList = (listId: string, index: number) => {
  const prevListId = playInfo.playerListId
  setPlayListId(listId)
  // pause()
  setPlayMusicInfo(listId, getList(listId)[index])
  if (appSetting['player.isAutoCleanPlayedList'] || prevListId != listId) clearPlayedList()
  clearTempPlayeList()
  handlePlay()
}

const handleToggleStop = () => {
  stop()
  setTimeout(() => {
    setPlayMusicInfo(null, null)
  })
}

const randomNextMusicInfo = {
  info: null as LX.Player.PlayMusicInfo | null,
  // index: -1,
}
export const resetRandomNextMusicInfo = () => {
  if (randomNextMusicInfo.info) {
    randomNextMusicInfo.info = null
    // randomNextMusicInfo.index = -1
  }
}

export const getNextPlayMusicInfo = async(): Promise<LX.Player.PlayMusicInfo | null> => {
  if (tempPlayList.length) { // 如果稍后播放列表存在歌曲则直接播放改列表的歌曲
    const playMusicInfo = tempPlayList[0]
    return playMusicInfo
  }

  if (playMusicInfo.musicInfo == null) return null

  if (randomNextMusicInfo.info) return randomNextMusicInfo.info

  // console.log(playInfo.playerListId)
  const currentListId = playInfo.playerListId
  if (!currentListId) return null
  const currentList = getList(currentListId)

  if (playedList.length) { // 移除已播放列表内不存在原列表的歌曲
    let currentId: string
    if (playMusicInfo.isTempPlay) {
      const musicInfo = currentList[playInfo.playerPlayIndex]
      if (musicInfo) currentId = musicInfo.id
    } else {
      currentId = playMusicInfo.musicInfo.id
    }
    // 从已播放列表移除播放列表已删除的歌曲
    let index
    for (index = playedList.findIndex(m => m.musicInfo.id === currentId) + 1; index < playedList.length; index++) {
      const playMusicInfo = playedList[index]
      const currentId = playMusicInfo.musicInfo.id
      if (playMusicInfo.listId == currentListId && !currentList.some(m => m.id === currentId)) {
        removePlayedList(index)
        continue
      }
      break
    }

    if (index < playedList.length) return playedList[index]
  }
  // const isCheckFile = findNum > 2 // 针对下载列表，如果超过两次都碰到无效歌曲，则过滤整个列表内的无效歌曲
  let { filteredList, playerIndex } = await filterList({ // 过滤已播放歌曲
    listId: currentListId,
    list: currentList,
    playedList,
    playerMusicInfo: currentList[playInfo.playerPlayIndex],
    isNext: true,
  })

  if (!filteredList.length) return null
  // let currentIndex: number = filteredList.indexOf(currentList[playInfo.playerPlayIndex])
  if (playerIndex == -1 && filteredList.length) playerIndex = 0
  let nextIndex = playerIndex

  let togglePlayMethod = appSetting['player.togglePlayMethod']
  switch (togglePlayMethod) {
    case 'listLoop':
      nextIndex = playerIndex === filteredList.length - 1 ? 0 : playerIndex + 1
      break
    case 'random':
      nextIndex = getRandom(0, filteredList.length)
      break
    case 'list':
      nextIndex = playerIndex === filteredList.length - 1 ? -1 : playerIndex + 1
      break
    case 'singleLoop':
      break
    default:
      return null
  }
  if (nextIndex < 0) return null

  const nextPlayMusicInfo = {
    musicInfo: filteredList[nextIndex],
    listId: currentListId,
    isTempPlay: false,
  }

  if (togglePlayMethod == 'random') {
    randomNextMusicInfo.info = nextPlayMusicInfo
    // randomNextMusicInfo.index = nextIndex
  }
  return nextPlayMusicInfo
}

const handlePlayNext = (playMusicInfo: LX.Player.PlayMusicInfo) => {
  // pause()
  setPlayMusicInfo(playMusicInfo.listId, playMusicInfo.musicInfo, playMusicInfo.isTempPlay)
  handlePlay()
}

/**
 * 播放“稍后播放”列表内的指定歌曲
 * @param index 歌曲位置
 */
export const playTempListByIndex = (index: number) => {
  const targetMusicInfo = tempPlayList[index]
  if (!targetMusicInfo) return
  removeTempPlayList(index)
  handlePlayNext(targetMusicInfo)
}

/**
 * 下一曲
 * @param isAutoToggle 是否自动切换
 * @returns
 */
export const playNext = async(isAutoToggle = false): Promise<void> => {
  console.log('skip next', isAutoToggle)
  if (tempPlayList.length) { // 如果稍后播放列表存在歌曲则直接播放改列表的歌曲
    playTempListByIndex(0)
    console.log('play temp list')
    return
  }

  if (playMusicInfo.musicInfo == null) {
    handleToggleStop()
    console.log('musicInfo empty')
    return
  }

  // console.log(playInfo.playerListId)
  const currentListId = playInfo.playerListId
  if (!currentListId) {
    handleToggleStop()
    console.log('currentListId empty')
    return
  }
  const currentList = getList(currentListId)

  if (playedList.length) { // 移除已播放列表内不存在原列表的歌曲
    let currentId: string
    if (playMusicInfo.isTempPlay) {
      const musicInfo = currentList[playInfo.playerPlayIndex]
      if (musicInfo) currentId = musicInfo.id
    } else {
      currentId = playMusicInfo.musicInfo.id
    }
    // 从已播放列表移除播放列表已删除的歌曲
    let index
    for (index = playedList.findIndex(m => m.musicInfo.id === currentId) + 1; index < playedList.length; index++) {
      const playMusicInfo = playedList[index]
      const currentId = playMusicInfo.musicInfo.id
      if (playMusicInfo.listId == currentListId && !currentList.some(m => m.id === currentId)) {
        removePlayedList(index)
        continue
      }
      break
    }

    if (index < playedList.length) {
      handlePlayNext(playedList[index])
      console.log('play played list')
      return
    }
  }
  if (randomNextMusicInfo.info) {
    handlePlayNext(randomNextMusicInfo.info)
    return
  }
  // const isCheckFile = findNum > 2 // 针对下载列表，如果超过两次都碰到无效歌曲，则过滤整个列表内的无效歌曲
  let { filteredList, playerIndex } = await filterList({ // 过滤已播放歌曲
    listId: currentListId,
    list: currentList,
    playedList,
    playerMusicInfo: currentList[playInfo.playerPlayIndex],
    isNext: true,
  })

  if (!filteredList.length) {
    handleToggleStop()
    console.log('filtered list empty')
    return
  }
  // let currentIndex: number = filteredList.indexOf(currentList[playInfo.playerPlayIndex])
  if (playerIndex == -1 && filteredList.length) playerIndex = 0
  let nextIndex = playerIndex

  let togglePlayMethod = appSetting['player.togglePlayMethod']
  if (!isAutoToggle) {
    switch (togglePlayMethod) {
      case 'list':
      case 'singleLoop':
      case 'none':
        togglePlayMethod = 'listLoop'
    }
  }
  switch (togglePlayMethod) {
    case 'listLoop':
      nextIndex = playerIndex === filteredList.length - 1 ? 0 : playerIndex + 1
      break
    case 'random':
      nextIndex = getRandom(0, filteredList.length)
      break
    case 'list':
      nextIndex = playerIndex === filteredList.length - 1 ? -1 : playerIndex + 1
      break
    case 'singleLoop':
      break
    default:
      nextIndex = -1
      console.log('stop toggle play', togglePlayMethod, isAutoToggle)
      return
  }
  if (nextIndex < 0) {
    console.log('next index empty')
    return
  }

  handlePlayNext({
    musicInfo: filteredList[nextIndex],
    listId: currentListId,
    isTempPlay: false,
  })
}

/**
 * 上一曲
 */
export const playPrev = async(isAutoToggle = false): Promise<void> => {
  if (playMusicInfo.musicInfo == null) {
    handleToggleStop()
    return
  }

  const currentListId = playInfo.playerListId
  if (!currentListId) {
    handleToggleStop()
    return
  }
  const currentList = getList(currentListId)

  if (playedList.length) {
    let currentId: string
    if (playMusicInfo.isTempPlay) {
      const musicInfo = currentList[playInfo.playerPlayIndex]
      if (musicInfo) currentId = musicInfo.id
    } else {
      currentId = playMusicInfo.musicInfo.id
    }
    // 从已播放列表移除播放列表已删除的歌曲
    let index
    for (index = playedList.findIndex(m => m.musicInfo.id === currentId) - 1; index > -1; index--) {
      const playMusicInfo = playedList[index]
      const currentId = playMusicInfo.musicInfo.id
      if (playMusicInfo.listId == currentListId && !currentList.some(m => m.id === currentId)) {
        removePlayedList(index)
        continue
      }
      break
    }

    if (index > -1) {
      handlePlayNext(playedList[index])
      return
    }
  }

  // const isCheckFile = findNum > 2
  let { filteredList, playerIndex } = await filterList({ // 过滤已播放歌曲
    listId: currentListId,
    list: currentList,
    playedList,
    playerMusicInfo: currentList[playInfo.playerPlayIndex],
    isNext: false,
  })
  if (!filteredList.length) {
    handleToggleStop()
    return
  }

  // let currentIndex = filteredList.indexOf(currentList[playInfo.playerPlayIndex])
  if (playerIndex == -1 && filteredList.length) playerIndex = 0
  let nextIndex = playerIndex
  if (!playMusicInfo.isTempPlay) {
    let togglePlayMethod = appSetting['player.togglePlayMethod']
    if (!isAutoToggle) {
      switch (togglePlayMethod) {
        case 'list':
        case 'singleLoop':
        case 'none':
          togglePlayMethod = 'listLoop'
      }
    }
    switch (togglePlayMethod) {
      case 'random':
        nextIndex = getRandom(0, filteredList.length)
        break
      case 'listLoop':
      case 'list':
        nextIndex = playerIndex === 0 ? filteredList.length - 1 : playerIndex - 1
        break
      case 'singleLoop':
        break
      default:
        nextIndex = -1
        return
    }
    if (nextIndex < 0) return
  }

  handlePlayNext({
    musicInfo: filteredList[nextIndex],
    listId: currentListId,
    isTempPlay: false,
  })
}

/**
 * 恢复播放
 */
export const play = () => {
  window.lx.isPlayedStop &&= false
  if (playMusicInfo.musicInfo == null) return
  if (isEmpty()) {
    if (createGettingUrlId(playMusicInfo.musicInfo) != gettingUrlId) setMusicUrl(playMusicInfo.musicInfo)
    return
  }
  setPlay()
}

/**
 * 暂停播放
 */
export const pause = () => {
  setPause()
}

/**
 * 停止播放
 */
export const stop = () => {
  setStop()
  setTimeout(() => {
    window.app_event.stop()
  })
}

/**
 * 播放、暂停播放切换
 */
export const togglePlay = () => {
  window.lx.isPlayedStop &&= false
  if (isPlay.value) {
    pause()
  } else {
    play()
  }
}

/**
 * 收藏当前播放的歌曲
 */
export const collectMusic = () => {
  if (!playMusicInfo.musicInfo) return
  void addListMusics(loveList.id, ['progress' in playMusicInfo.musicInfo ? playMusicInfo.musicInfo.metadata.musicInfo : playMusicInfo.musicInfo])
}

/**
 * 取消收藏当前播放的歌曲
 */
export const uncollectMusic = () => {
  if (!playMusicInfo.musicInfo) return
  void removeListMusics({ listId: loveList.id, ids: ['progress' in playMusicInfo.musicInfo ? playMusicInfo.musicInfo.metadata.musicInfo.id : playMusicInfo.musicInfo.id] })
}

/**
 * 不喜欢当前播放的歌曲
 */
export const dislikeMusic = async() => {
  if (!playMusicInfo.musicInfo) return
  const minfo = 'progress' in playMusicInfo.musicInfo ? playMusicInfo.musicInfo.metadata.musicInfo : playMusicInfo.musicInfo
  await addDislikeInfo([{ name: minfo.name, singer: minfo.singer }])
  await playNext(true)
}
