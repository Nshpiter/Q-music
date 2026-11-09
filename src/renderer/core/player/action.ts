import { playbackSession } from './session'
import { isEmpty, setPause, setPlay, setResource, setStop } from '@renderer/plugins/player'
import { originalReportIdentity } from '@renderer/core/music/playbackReport'
import { isPlay, isPlayPending, playedList, playInfo, playMusicInfo, playbackSourceInfo, tempPlayList, musicInfo as _musicInfo } from '@renderer/store/player/state'
import { playbackRecovery } from './recovery'
import {
  getList,
  getSourceList,
  updatePlayIndex,
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
import { getMusicUrl, getPicPath, getLyricInfo, isCustomApiSource } from '../music/index'
import { findMatchedTranslation } from '../music/translation'
import type { MusicUrlRequestOptions, MusicUrlResolvedInfo } from '../music/index'
import { filterList } from './utils'
import { requestMsg } from '@renderer/utils/message'
import { getRandom } from '@renderer/utils/index'
import { addListMusics, removeListMusics } from '@renderer/store/list/action'
import { getFavoriteListId } from '@renderer/core/localFavorite'
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

const applyLyricInfo = (musicInfo: LX.Music.MusicInfo | LX.Download.ListItem, lyricInfo: LX.Player.LyricInfo) => {
  setMusicInfo({
    lrc: lyricInfo.lyric,
    tlrc: lyricInfo.tlyric,
    lxlrc: lyricInfo.lxlyric,
    rlrc: lyricInfo.rlyric,
    rawlrc: lyricInfo.rawlrcInfo.lyric,
  })
  window.app_event.lyricUpdated()
  if ('progress' in musicInfo || musicInfo.source == 'local' || lyricInfo.tlyric) return
  void findMatchedTranslation(musicInfo, lyricInfo).then(translation => {
    if (!translation || musicInfo.id != playMusicInfo.musicInfo?.id || _musicInfo.tlrc) return
    setMusicInfo({ tlrc: translation })
    window.app_event.lyricUpdated()
  })
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
    const token = playbackRecovery.token()
    timeout = setTimeout(() => {
      timeout = null
      if (window.lx.isPlayedStop || !playbackRecovery.isCurrent(token)) return
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

const cancelPendingPlayback = () => {
  playbackRecovery.cancel()
  ++musicUrlRequestId
  musicUrlAbortController?.abort()
  musicUrlAbortController = null
  cancelDelayRetry?.()
  clearDelayNextTimeout()
  gettingUrlId = ''
  isPlayPending.value = false
}

export const handlePlaybackFailure = (message = window.i18n.t('player__error')) => {
  if (playbackRecovery.isCancelled() || window.lx.isPlayedStop) return
  clearDelayNextTimeout()
  const music = playMusicInfo.musicInfo
  const canSkip = music && playbackRecovery.canSkip(createGettingUrlId(music))
  if (!appSetting['player.autoSkipOnError'] || !canSkip) {
    pause()
    setAllStatus(canSkip ? message : window.i18n.t('player__errors_stopped'))
    return
  }
  isPlayPending.value = true
  setAllStatus(message)
  addDelayNextTimeout()
}

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
  const explicitToggleMusicInfo = originalMusicInfo.meta.toggleMusicInfo
  const hasExplicitToggle = !!explicitToggleMusicInfo && (
    explicitToggleMusicInfo.id != originalMusicInfo.id ||
    explicitToggleMusicInfo.source != originalMusicInfo.source
  )
  // 手动切换的平台是用户真正请求的源；自动跨平台回退仍以原曲源为请求源。
  const requestedSource = hasExplicitToggle ? explicitToggleMusicInfo.source : originalMusicInfo.source
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
    // requestedSource 是用户本次播放真正选择的平台。解析器内部可能会
    // 尝试多个候选平台，不能用 info.requestedSource 覆盖用户的选择，
    // 否则切换平台失败后回到原平台时会被误报为“未回退”。
    const isFallback = !!info.isFallback || info.resolvedSource != requestedSource
    playbackRouteState.currentResolvedInfo = { ...info, requestedSource, isFallback }
    const resolvedMusicInfo = info.resolvedMusicInfo
    playbackSourceInfo.value = {
      musicKey: `${originalMusicInfo.source}:${originalMusicInfo.id}`,
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
      reportIdentity: originalReportIdentity(originalMusicInfo),
      cacheProviderId: info.cacheProviderId,
    }
  }

  const attempts: Array<{
    musicInfo: LX.Music.MusicInfo | LX.Download.ListItem
    allowToggleSource: boolean
    routeStrategy: MusicUrlRequestOptions['routeStrategy']
    userApiScope?: MusicUrlRequestOptions['userApiScope']
    directOnly?: boolean
  }> = []
  const addOnlineAttempts = (onlineMusicInfo: LX.Music.MusicInfoOnline) => {
    const targetToggleMusicInfo = onlineMusicInfo.meta.toggleMusicInfo
    const hasExplicitToggle = !!targetToggleMusicInfo && (targetToggleMusicInfo.id != onlineMusicInfo.id || targetToggleMusicInfo.source != onlineMusicInfo.source)
    const primaryMusicInfo = hasExplicitToggle ? targetToggleMusicInfo : onlineMusicInfo
    const exactCandidates = hasExplicitToggle ? [primaryMusicInfo, onlineMusicInfo] : [onlineMusicInfo]
    const preferCustomApi = isCustomApiSource() && !hasExplicitToggle
    for (const candidate of exactCandidates) {
      // 自定义 API 是默认线路；手动点选平台时保留明确的平台优先意图，
      // 官方失败后仍会尝试自定义 API。
      if (preferCustomApi) {
        attempts.push({ musicInfo: candidate, allowToggleSource: false, routeStrategy: 'api', userApiScope: 'primary' })
        if (candidate.source == 'tx' || candidate.source == 'wy') {
          attempts.push({ musicInfo: candidate, allowToggleSource: false, routeStrategy: 'official' })
        }
        if (appSetting['common.apiBackupSources']?.length) {
          attempts.push({ musicInfo: candidate, allowToggleSource: false, routeStrategy: 'api', userApiScope: 'backup' })
        }
      } else {
        if (candidate.source == 'tx' || candidate.source == 'wy') {
          attempts.push({ musicInfo: candidate, allowToggleSource: false, routeStrategy: 'official' })
        }
        attempts.push({ musicInfo: candidate, allowToggleSource: false, routeStrategy: 'api' })
      }
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
    if (signal.aborted || requestId != musicUrlRequestId) return null
    try {
      const url = await getMusicUrl({
        musicInfo: attempt.musicInfo,
        quality,
        isRefresh,
        allowToggleSource: attempt.allowToggleSource,
        requestOptions: { ...requestOptions, routeStrategy: attempt.routeStrategy, userApiScope: attempt.userApiScope, directOnly: attempt.directOnly },
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
  if (playbackRecovery.isCancelled()) return
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
  isPlayPending.value = true
  void getMusicPlayUrl(musicInfo, requestId, abortController.signal, isRefresh, false, quality).then((url) => {
    if (requestId != musicUrlRequestId) return
    if (!url) return
    playbackRouteState.currentUrl = url
    setResource(url)
  }).catch((err: any) => {
    if (requestId != musicUrlRequestId) return
    console.log(err)
    window.app_event.error()
    handlePlaybackFailure(err.message)
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
    applyLyricInfo(musicInfo, lyricInfo)
  }).catch((err) => {
    console.log(err)
    if (musicInfo.id != playMusicInfo.musicInfo?.id) return
    setAllStatus(window.i18n.t('lyric__load_error'))
  })

  if (appSetting['player.togglePlayMethod'] == 'random' && !playMusicInfo.isTempPlay) addPlayedList({ ...playMusicInfo as LX.Player.PlayMusicInfo })
}


// 处理音乐播放
const handlePlay = () => {
  cancelPendingPlayback()
  playbackRecovery.begin()
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
    applyLyricInfo(musicInfo, lyricInfo)
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
  const musicInfo = getSourceList(listId).find(m => m.id == id)
  if (!musicInfo) return
  playbackRecovery.resetFailures()
  playbackSession.reset()
  const prevListId = playInfo.playerListId
  setPlayListId(listId)
  // pause()
  setPlayMusicInfo(listId, musicInfo)
  playbackSession.record({ listId, musicInfo, isTempPlay: false })
  if (appSetting['player.isAutoCleanPlayedList'] || prevListId != listId) clearPlayedList()
  clearTempPlayeList()
  handlePlay()
}

/**
 * 播放列表内歌曲
 * @param listId 列表id
 * @param index 播放的歌曲位置
 */
export const playList = (listId: string, index: number, continuous = false) => {
  const selected = getSourceList(listId)[index]
  if (!selected) return
  playbackRecovery.resetFailures()
  playbackSession.reset()
  playbackSession.continuous = continuous
  resetRandomNextMusicInfo()
  const prevListId = playInfo.playerListId
  setPlayListId(listId)
  // pause()
  setPlayMusicInfo(listId, selected)
  playbackSession.record({ listId, musicInfo: selected, isTempPlay: false })
  if (continuous || appSetting['player.isAutoCleanPlayedList'] || prevListId != listId) clearPlayedList()
  clearTempPlayeList()
  handlePlay()
}

const handleToggleStop = () => {
  stop()
  const token = playbackRecovery.token()
  setTimeout(() => {
    if (token != playbackRecovery.token()) return
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
  const forward = playbackSession.history[playbackSession.cursor + 1]
  if (forward) return forward

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

  if (!playbackSession.continuous && playedList.length) { // 移除已播放列表内不存在原列表的歌曲
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
    playedList: playbackSession.continuous ? [] : playedList,
    playerMusicInfo: currentList[playInfo.playerPlayIndex],
    isNext: true,
  })

  if (!filteredList.length) return null
  // let currentIndex: number = filteredList.indexOf(currentList[playInfo.playerPlayIndex])
  if (playerIndex == -1 && filteredList.length) playerIndex = 0
  let nextIndex = playerIndex

  let togglePlayMethod = playbackSession.continuous ? 'listLoop' : appSetting['player.togglePlayMethod']
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

const getCurrentPlayMusicInfo = () => playMusicInfo

const handlePlayNext = (playMusicInfo: LX.Player.PlayMusicInfo, replay = false) => {
  if (!replay) {
    const current = getCurrentPlayMusicInfo()
    if (!playbackSession.history.length && current.musicInfo) {
      const initial: LX.Player.PlayMusicInfo = { listId: current.listId, musicInfo: current.musicInfo, isTempPlay: current.isTempPlay }
      playbackSession.record(initial)
    }
    playbackSession.record(playMusicInfo)
  }
  // pause()
  setPlayMusicInfo(playMusicInfo.listId, playMusicInfo.musicInfo, playMusicInfo.isTempPlay)
  handlePlay()
}

/**
 * 播放“稍后播放”列表内的指定歌曲
 * @param index 歌曲位置
 */
export const playTempListByIndex = (index: number, isAutoToggle = false) => {
  if (!isAutoToggle) playbackRecovery.resetFailures()
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
  if (isAutoToggle && (playbackRecovery.isCancelled() || window.lx.isPlayedStop)) return
  if (!isAutoToggle) playbackRecovery.resetFailures()
  cancelPendingPlayback()
  const token = playbackRecovery.begin()
  isPlayPending.value = true
  console.log('skip next', isAutoToggle)
  const forward = playbackSession.forward()
  if (forward) { handlePlayNext(forward, true); return }
  if (tempPlayList.length) { // 如果稍后播放列表存在歌曲则直接播放改列表的歌曲
    playTempListByIndex(0, isAutoToggle)
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

  if (!playbackSession.continuous && playedList.length) { // 移除已播放列表内不存在原列表的歌曲
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
    playedList: playbackSession.continuous ? [] : playedList,
    playerMusicInfo: currentList[playInfo.playerPlayIndex],
    isNext: true,
  })

  if (!playbackRecovery.isCurrent(token)) return

  if (!filteredList.length) {
    handleToggleStop()
    console.log('filtered list empty')
    return
  }
  // let currentIndex: number = filteredList.indexOf(currentList[playInfo.playerPlayIndex])
  if (playerIndex == -1 && filteredList.length) playerIndex = 0
  let nextIndex = playerIndex

  let togglePlayMethod = playbackSession.continuous ? 'listLoop' : appSetting['player.togglePlayMethod']
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
      cancelPendingPlayback()
      return
  }
  if (nextIndex < 0) {
    cancelPendingPlayback()
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
  if (isAutoToggle && (playbackRecovery.isCancelled() || window.lx.isPlayedStop)) return
  if (!isAutoToggle) playbackRecovery.resetFailures()
  cancelPendingPlayback()
  const token = playbackRecovery.begin()
  isPlayPending.value = true
  const previous = playbackSession.back()
  if (previous) { handlePlayNext(previous, true); return }
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

  if (!playbackSession.continuous && playedList.length) {
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
    playedList: playbackSession.continuous ? [] : playedList,
    playerMusicInfo: currentList[playInfo.playerPlayIndex],
    isNext: false,
  })
  if (!playbackRecovery.isCurrent(token)) return
  if (!filteredList.length) {
    handleToggleStop()
    return
  }

  // let currentIndex = filteredList.indexOf(currentList[playInfo.playerPlayIndex])
  if (playerIndex == -1 && filteredList.length) playerIndex = 0
  let nextIndex = playerIndex
  if (!playMusicInfo.isTempPlay) {
    let togglePlayMethod = playbackSession.continuous ? 'listLoop' : appSetting['player.togglePlayMethod']
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
  if (isPlayPending.value) return
  playbackRecovery.begin()
  playbackRecovery.resetFailures()
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
  cancelPendingPlayback()
  setPause()
  setAllStatus('')
}

/**
 * 停止播放
 */
export const stop = () => {
  cancelPendingPlayback()
  const token = playbackRecovery.token()
  setStop()
  setTimeout(() => {
    if (token != playbackRecovery.token()) return
    window.app_event.stop()
  })
}

/**
 * 播放、暂停播放切换
 */
export const togglePlay = () => {
  if (isPlay.value || isPlayPending.value) {
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
  void addListMusics(getFavoriteListId(), ['progress' in playMusicInfo.musicInfo ? playMusicInfo.musicInfo.metadata.musicInfo : playMusicInfo.musicInfo])
}

/**
 * 取消收藏当前播放的歌曲
 */
export const uncollectMusic = () => {
  if (!playMusicInfo.musicInfo) return
  void removeListMusics({ listId: getFavoriteListId(), ids: ['progress' in playMusicInfo.musicInfo ? playMusicInfo.musicInfo.metadata.musicInfo.id : playMusicInfo.musicInfo.id] })
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

// 只清理本次播放会话，不删除任何歌单或下载文件。
export const appendQueueItems = (tracks: Array<NonNullable<LX.Player.PlayMusicInfo['musicInfo']>>) => {
  if (!playMusicInfo.musicInfo || !tracks.length) return false
  const id = playInfo.playerListId || '__session_queue__'
  playbackSession.replace(id, [...getList(id), ...tracks])
  setPlayListId(id)
  clearPlayedList()
  resetRandomNextMusicInfo()
  updatePlayIndex()
  return true
}

export const clearPlayQueue = () => {
  stop()
  playbackSession.reset()
  clearPlayedList()
  clearTempPlayeList()
  resetRandomNextMusicInfo()
  setPlayMusicInfo(null, null)
}

export const removeQueueIndex = (index: number) => {
  const id = playInfo.playerListId
  if (!id) return
  const list = getList(id) as Array<LX.Player.PlayMusicInfo['musicInfo']>
  const removed = list[index]
  if (!removed || !Number.isInteger(index)) return
  const current = playMusicInfo
  const anchor = list[playInfo.playerPlayIndex]
  const removingCurrent = !current.isTempPlay && index == playInfo.playerPlayIndex
  const shouldResume = isPlay.value || isPlayPending.value
  if (list.length == 1 && !tempPlayList.length && removingCurrent) {
    clearPlayQueue()
    return
  }
  if (removingCurrent) stop()
  const token = playbackRecovery.token()
  playbackSession.remove(id, list, index)
  const remaining = getList(id) as Array<LX.Player.PlayMusicInfo['musicInfo']>
  if (!remaining.some(item => item.id == removed.id)) playbackSession.forget(item => item.listId == id && item.musicInfo.id == removed.id)
  clearPlayedList()
  resetRandomNextMusicInfo()
  if (!removingCurrent) {
    if (current.isTempPlay && anchor) {
      const anchorIndex = remaining.indexOf(anchor)
      playInfo.playerPlayIndex = anchorIndex
    }
    updatePlayIndex()
    return
  }
  if (token != playbackRecovery.token()) return
  if (tempPlayList.length) {
    const next = tempPlayList[0]
    removeTempPlayList(0)
    playInfo.playerPlayIndex = Math.min(index - 1, remaining.length - 1)
    setPlayMusicInfo(next.listId, next.musicInfo, true)
    playbackSession.record(next)
    if (shouldResume) handlePlay()
    return
  }
  const next = remaining[Math.min(index, remaining.length - 1)]
  if (!next) return
  const selection = { listId: id, musicInfo: next, isTempPlay: false }
  setPlayMusicInfo(id, next)
  playbackSession.record(selection)
  if (shouldResume) handlePlay()
}

export const playQueueIndex = (index: number) => {
  const id = playInfo.playerListId
  if (!id) return
  const musicInfo = getList(id)[index]
  if (!musicInfo) return
  playbackRecovery.resetFailures()
  handlePlayNext({ listId: id, musicInfo, isTempPlay: false })
}

export const playHistoryIndex = (index: number) => {
  const item = playbackSession.select(index)
  if (!item) return
  playbackRecovery.resetFailures()
  handlePlayNext(item, true)
}
