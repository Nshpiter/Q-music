import { destroy, loadScript, sendAction, type ActionsEvent, type ResponseParams } from '@/utils/nativeModules/userApi'
import { getUserApiScript } from '@/utils/data'
import { state } from '@/store/userApi'
import settingState from '@/store/setting/state'
import BackgroundTimer from 'react-native-background-timer'
import { fetchData } from '@/core/init/userApi/request'

interface Runtime {
  createdAt: number
  id: string
  runtimeId: string
  info: LX.UserApi.UserApiInfo
  status?: boolean
  ready: Promise<LX.UserApi.UserApiInfo>
  resolve: (info: LX.UserApi.UserApiInfo) => void
  reject: (error: Error) => void
  timeout: number
}
const runtimes = new Map<string, Runtime>()
const requests = new Map<string, { runtimeId: string, resolve: (result: ResponseParams['result']) => void, reject: (error: Error) => void, timeout: number }>()
const httpRequests = new Map<string, { runtimeId: string, abort: () => void }>()
const isAllowed = (id: string) => id === settingState.setting['common.apiSource'] || settingState.setting['common.apiBackupSources'].includes(id)

export const cancelUserApiRequest = (key: string) => {
  const target = requests.get(key)
  if (!target) return
  requests.delete(key)
  BackgroundTimer.clearTimeout(target.timeout)
  target.reject(new Error('Cancel request'))
}

export const resetUserApiRuntimes = (ids = [...runtimes.keys()]) => {
  for (const id of ids) {
    const runtime = runtimes.get(id)
    if (!runtime) continue
    runtimes.delete(id)
    BackgroundTimer.clearTimeout(runtime.timeout)
    runtime.reject(new Error('Cancel request'))
    for (const [key, request] of requests) if (request.runtimeId === runtime.runtimeId) cancelUserApiRequest(key)
    for (const [key, request] of httpRequests) {
      if (request.runtimeId !== runtime.runtimeId) continue
      httpRequests.delete(key)
      request.abort()
    }
    if (runtime.runtimeId) destroy(runtime.runtimeId)
  }
}

export const pruneUserApiRuntimes = () => {
  resetUserApiRuntimes([...runtimes.keys()].filter(id => !isAllowed(id) || !state.list.some(api => api.id === id)))
}

export const loadUserApiRuntime = async(id: string, primary = false): Promise<LX.UserApi.UserApiInfo> => {
  if (!primary && !isAllowed(id)) return Promise.reject(new Error('source not enabled'))
  const existing = runtimes.get(id)
  if (existing) {
    if (existing.status !== false || Date.now() - existing.createdAt < 30_000) return existing.ready
    resetUserApiRuntimes([id])
  }
  const info = state.list.find(api => api.id === id)
  if (!info) return Promise.reject(new Error('api not found'))
  let resolveReady!: Runtime['resolve']
  let rejectReady!: Runtime['reject']
  const ready = new Promise<LX.UserApi.UserApiInfo>((resolve, reject) => { resolveReady = resolve; rejectReady = reject })
  const runtime: Runtime = {
    id,
    runtimeId: '',
    info,
    ready,
    resolve: resolveReady,
    reject: rejectReady,
    createdAt: Date.now(),
    timeout: BackgroundTimer.setTimeout(() => {
      runtime.status = false
      rejectReady(new Error('source init timeout'))
      if (runtime.runtimeId) destroy(runtime.runtimeId)
    }, 8_000),
  }
  runtimes.set(id, runtime)
  void getUserApiScript(id).then(script => {
    if (runtimes.get(id) !== runtime || runtime.status === false) return
    runtime.runtimeId = loadScript({ ...info, script }, primary)
  }).catch(error => {
    BackgroundTimer.clearTimeout(runtime.timeout)
    runtime.status = false
    rejectReady(error instanceof Error ? error : new Error('source init failed'))
  })
  return ready
}

export const requestUserApi = (id: string, data: LX.UserApi.UserApiRequestParams) => {
  const runtime = runtimes.get(id)
  const promise = new Promise<ResponseParams['result']>((resolve, reject) => {
    if (!runtime?.status || !isAllowed(id)) { reject(new Error('source unavailable')); return }
    cancelUserApiRequest(data.requestKey)
    requests.set(data.requestKey, {
      runtimeId: runtime.runtimeId,
      resolve,
      reject,
      timeout: BackgroundTimer.setTimeout(() => {
        requests.delete(data.requestKey)
        reject(new Error('music API request timeout'))
      }, 20_000),
    })
    sendAction('request', data, runtime.runtimeId)
  })
  return { promise, canceleFn: () => { cancelUserApiRequest(data.requestKey) } }
}

export const handleUserApiRuntimeEvent = (event: ActionsEvent) => {
  const runtime = [...runtimes.values()].find(item => item.runtimeId === event.runtimeId)
  if (!runtime) return false
  switch (event.action) {
    case 'init':
      if (runtime.status !== undefined) return false
      BackgroundTimer.clearTimeout(runtime.timeout)
      runtime.status = event.data.status
      if (event.data.status) {
        runtime.info = event.data.info
        runtime.resolve(event.data.info)
      } else runtime.reject(new Error(event.data.errorMessage ?? 'source init failed'))
      break
    case 'response': {
      const request = requests.get(event.data.requestKey)
      if (!request || request.runtimeId !== event.runtimeId) return false
      requests.delete(event.data.requestKey)
      BackgroundTimer.clearTimeout(request.timeout)
      if (event.data.status) request.resolve(event.data.result)
      else request.reject(new Error(event.data.errorMessage ?? 'music API request failed'))
      break
    }
    case 'request': {
      const key = `${event.runtimeId}:${event.data.requestKey}`
      httpRequests.get(key)?.abort()
      const req = fetchData(event.data.url, event.data.options)
      const entry = { runtimeId: event.runtimeId, abort: () => { req.abort() } }
      httpRequests.set(key, entry)
      void req.request.then(response => {
        if (httpRequests.get(key) === entry) sendAction('response', { requestKey: event.data.requestKey, error: null, response }, event.runtimeId)
      }).catch(error => {
        if (httpRequests.get(key) === entry) sendAction('response', { requestKey: event.data.requestKey, error: error.message, response: null }, event.runtimeId)
      }).finally(() => {
        if (httpRequests.get(key) === entry) httpRequests.delete(key)
      })
      break
    }
    case 'cancelRequest': {
      const key = `${event.runtimeId}:${event.data}`
      const request = httpRequests.get(key)
      httpRequests.delete(key)
      request?.abort()
      break
    }
    default: break
  }
  return true
}
