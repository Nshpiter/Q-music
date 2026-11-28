import { mainOn } from '@common/mainIpc'
import { closeWindow, createWindow, getProxy, getRuntimeId, openDevTools, sendEvent } from './main'
import names from './rendererEvent/name'
import { getUserApis } from './utils'
import { sendShowUpdateAlert, sendStatusChange } from '@main/modules/winMain'

interface Runtime {
  createdAt: number
  info: LX.UserApi.UserApiInfo
  status?: LX.UserApi.UserApiStatus
  ready: Promise<LX.UserApi.UserApiStatus>
  settle: (status: LX.UserApi.UserApiStatus) => void
  timeout: NodeJS.Timeout
}
let primaryId = ''
const runtimes = new Map<string, Runtime>()
const requests = new Map<string, { apiId: string, resolve: (value: any) => void, reject: (error: Error) => void, timeout: NodeJS.Timeout }>()

const isAllowed = (id: string) => id === primaryId || (global.lx.appSetting['common.apiBackupSources'] ?? []).includes(id)

const finishInit = (runtime: Runtime, status: LX.UserApi.UserApiStatus) => {
  if (runtime.status) return
  clearTimeout(runtime.timeout)
  runtime.status = status
  runtime.settle(status)
  if (runtime.info.id === primaryId) sendStatusChange(status)
}

export const cancelRequest = (key: string) => {
  const request = requests.get(key)
  if (!request) return
  requests.delete(key)
  clearTimeout(request.timeout)
  request.reject(new Error('Cancel request'))
}

export const closeApis = async(ids = [...runtimes.keys()]) => {
  for (const id of ids) {
    const runtime = runtimes.get(id)
    if (runtime) {
      runtimes.delete(id)
      finishInit(runtime, { status: false, apiInfo: runtime.info, message: 'source changed' })
    }
    for (const [key, request] of requests) if (request.apiId === id) cancelRequest(key)
    await closeWindow(id)
  }
}

const ensureRuntime = async(id: string): Promise<LX.UserApi.UserApiStatus> => {
  if (!isAllowed(id)) return Promise.reject(new Error('source not enabled'))
  const existing = runtimes.get(id)
  if (existing) {
    if (existing.status?.status !== false || Date.now() - existing.createdAt < 30_000) return existing.ready
    await closeApis([id])
    return ensureRuntime(id)
  }
  const info = getUserApis().find(api => api.id === id)
  if (!info) return Promise.reject(new Error('api not found'))
  let settle!: Runtime['settle']
  const ready = new Promise<LX.UserApi.UserApiStatus>(resolve => { settle = resolve })
  const runtime: Runtime = {
    createdAt: Date.now(),
    info,
    ready,
    settle,
    timeout: setTimeout(() => {
      finishInit(runtime, { status: false, apiInfo: info, message: 'source init timeout' })
      void closeWindow(id)
    }, 8_000),
  }
  runtimes.set(id, runtime)
  void createWindow(info, () => runtimes.get(id) === runtime && runtime.status?.status !== false).then(window => {
    if (runtimes.get(id) !== runtime || runtime.status?.status === false) {
      if (!window.isDestroyed()) window.destroy()
      return
    }
    window.webContents.once('render-process-gone', () => { void closeApis([id]) })
    window.once('closed', () => {
      if (runtimes.get(id) === runtime && runtime.status?.status !== false) void closeApis([id])
    })
  }).catch(error => {
    if (runtimes.get(id) !== runtime) return
    finishInit(runtime, { status: false, apiInfo: info, message: error.message })
    void closeWindow(id)
  })
  return ready
}

export const loadApi = async(id: string) => {
  primaryId = id
  if (!getUserApis().some(api => api.id === id)) return
  await ensureRuntime(id)
}

export const reloadLoadedApi = async(id: string) => {
  if (!runtimes.has(id) && primaryId !== id) return
  await closeApis([id])
  if (primaryId === id) await loadApi(id)
  else if (isAllowed(id)) void ensureRuntime(id)
}

export const getStatus = async(id?: string): Promise<LX.UserApi.UserApiStatus> => {
  if (id) return ensureRuntime(id)
  return runtimes.get(primaryId)?.status ?? { status: false, message: 'initing' }
}

export const request = async({ apiId = primaryId, requestKey, data }: LX.UserApi.UserApiRequestParams): Promise<any> => {
  if (!isAllowed(apiId) || !runtimes.get(apiId)?.status?.status) return Promise.reject(new Error('source unavailable'))
  cancelRequest(requestKey)
  return new Promise((resolve, reject) => {
    requests.set(requestKey, {
      apiId,
      resolve,
      reject,
      timeout: setTimeout(() => {
        requests.delete(requestKey)
        reject(new Error('music API request timeout'))
      }, 20_000),
    })
    sendEvent(apiId, names.request, { requestKey, data })
  })
}

export const setAllowShowUpdateAlert = (id: string, enable: boolean) => {
  const runtime = runtimes.get(id)
  if (runtime) runtime.info.allowShowUpdateAlert = enable
}

export const init = () => {
  mainOn<any>(names.init, ({ event, params }) => {
    const id = getRuntimeId(event.sender)
    const runtime = id && runtimes.get(id)
    if (!runtime) return
    finishInit(runtime, params.status
      ? { status: true, apiInfo: { ...runtime.info, sources: params.data?.sources } }
      : { status: false, apiInfo: runtime.info, message: params.message })
  })
  mainOn<any>(names.response, ({ event, params }) => {
    const key = params.data?.requestKey
    const request = requests.get(key)
    // 归属由宿主窗口确认，不能相信脚本提交的 id 或其他脚本的 requestKey。
    if (!request || request.apiId !== getRuntimeId(event.sender)) return
    requests.delete(key)
    clearTimeout(request.timeout)
    if (params.status) request.resolve(params.data.result)
    else request.reject(new Error(params.message || 'music API request failed'))
  })
  mainOn(names.openDevTools, ({ event }) => {
    const id = getRuntimeId(event.sender)
    if (id) openDevTools(id)
  })
  mainOn(names.getProxy, ({ event }) => {
    const id = getRuntimeId(event.sender)
    if (id) sendEvent(id, names.proxyUpdate, getProxy())
  })
  mainOn<any>(names.showUpdateAlert, ({ event, params }) => {
    const id = getRuntimeId(event.sender)
    const info = id ? runtimes.get(id)?.info : undefined
    if (info?.allowShowUpdateAlert) sendShowUpdateAlert({ ...info, ...params.data })
  })
  global.lx.event_app.on('updated_config', keys => {
    if (!keys.includes('common.apiBackupSources')) return
    void closeApis([...runtimes.keys()].filter(id => !isAllowed(id)))
  })
}
