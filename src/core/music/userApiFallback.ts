import { getUserApiProviderIds, resolveUserApiFallback, USER_API_CANCELLED, type UserApiProviderScope } from '@/utils/userApiFallback'
import { loadUserApiRuntime, requestUserApi } from '@/core/userApiRuntime'
import settingState from '@/store/setting/state'
import { state } from '@/store/userApi'
import { toOldMusicInfo } from '@/utils'
import { getMusicUrl, saveMusicUrl } from '@/utils/data'
import { requestMsg } from '@/utils/message'

const failedUrls = new Map<string, number>()
export const excludeFailedUserApiUrl = (url: string) => {
  if (!url) return
  failedUrls.set(url, Date.now() + 120_000)
  if (failedUrls.size > 80) failedUrls.delete(failedUrls.keys().next().value!)
}

export const resolveCustomMusicUrl = async(musicInfo: LX.Music.MusicInfo, quality: LX.Quality, isRefresh: boolean, signal?: AbortSignal, providerScope: UserApiProviderScope = 'all') => {
  const controller = new AbortController()
  const cancel = () => { controller.abort() }
  const onConfigChanged = (keys: Array<keyof LX.AppSetting>) => {
    if (keys.includes('common.apiSource') || keys.includes('common.apiBackupSources')) cancel()
  }
  if (signal?.aborted) cancel()
  signal?.addEventListener('abort', cancel, { once: true })
  global.state_event.on('configUpdated', onConfigChanged)
  try {
    for (const [url, expiresAt] of failedUrls) if (expiresAt <= Date.now()) failedUrls.delete(url)
    const providers = getUserApiProviderIds(settingState.setting['common.apiSource'], settingState.setting['common.apiBackupSources'], state.list, providerScope)
    const result = await resolveUserApiFallback({
      providers,
      source: musicInfo.source,
      quality,
      signal: controller.signal,
      excludedUrls: new Set(failedUrls.keys()),
      isCurrent: () => providers.every(id => state.list.some(api => api.id === id)),
      getInfo: async id => loadUserApiRuntime(id),
      readCache: isRefresh ? undefined : async(id, type) => getMusicUrl(musicInfo, type, id),
      request(id, type) {
        const requestKey = `fallback_${id}_${Math.random().toString(36).slice(2)}`
        const request = requestUserApi(id, { requestKey, data: { source: musicInfo.source, action: 'musicUrl', info: { type: musicInfo.source === 'local' ? null : type, musicInfo: toOldMusicInfo(musicInfo) } } })
        return { promise: request.promise.then(result => result?.data?.url as string), cancel: request.canceleFn }
      },
    })
    if (!result.isFromCache) void saveMusicUrl(musicInfo, result.quality, result.url, result.providerId)
    return result
  } catch (error) {
    if ((error as Error).message === USER_API_CANCELLED) throw new Error(requestMsg.cancelRequest)
    throw error
  } finally {
    signal?.removeEventListener('abort', cancel)
    global.state_event.off('configUpdated', onConfigChanged)
  }
}
