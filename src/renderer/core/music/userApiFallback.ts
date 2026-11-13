import { getUserApiProviderIds, resolveUserApiFallback, USER_API_CANCELLED, type UserApiProviderScope } from '@common/utils/userApiFallback'
import { getUserApiList, getUserApiStatus, sendUserApiRequest, userApiRequestCancel } from '@renderer/utils/ipc'
import { appSetting } from '@renderer/store/setting'
import { watch } from '@common/utils/vueTools'
import { toOldMusicInfo } from '@renderer/utils'
import { requestMsg } from '@renderer/utils/message'

export const resolveCustomMusicUrl = async(musicInfo: LX.Music.MusicInfo, quality: LX.Quality, options: Pick<Parameters<typeof resolveUserApiFallback>[0], 'allowQualityFallback' | 'readCache' | 'isExcluded' | 'excludedUrls' | 'isProviderBlocked' | 'onFailure' | 'signal'> & { providerScope?: UserApiProviderScope } = {}) => {
  const controller = new AbortController()
  const cancel = () => { controller.abort() }
  if (options.signal?.aborted) cancel()
  options.signal?.addEventListener('abort', cancel, { once: true })
  const stop = watch(() => [appSetting['common.apiSource'], ...appSetting['common.apiBackupSources']], cancel, { flush: 'sync' })
  try {
    const list = await getUserApiList()
    return await resolveUserApiFallback({
      ...options,
      providers: getUserApiProviderIds(appSetting['common.apiSource'], appSetting['common.apiBackupSources'], list, options.providerScope),
      source: musicInfo.source,
      quality,
      signal: controller.signal,
      async getInfo(id) {
        const status = await getUserApiStatus(id)
        if (!status.status || !status.apiInfo) throw new Error(status.message || 'source init failed')
        return status.apiInfo
      },
      request(id, type) {
        const requestKey = `fallback_${id}_${Math.random().toString(36).slice(2)}`
        return {
          promise: sendUserApiRequest({ apiId: id, requestKey, data: { source: musicInfo.source, action: 'musicUrl', info: { type: musicInfo.source === 'local' ? null : type, musicInfo: toOldMusicInfo(musicInfo) } } }).then(result => result?.data?.url as string),
          cancel() { userApiRequestCancel(requestKey) },
        }
      },
    })
  } catch (error) {
    if ((error as Error).message === USER_API_CANCELLED) throw new Error(requestMsg.cancelRequest)
    throw error
  } finally {
    stop()
    options.signal?.removeEventListener('abort', cancel)
  }
}
