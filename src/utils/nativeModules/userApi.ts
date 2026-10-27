import { NativeEventEmitter, NativeModules } from 'react-native'

const { UserApiModule } = NativeModules

const scripts = new Map<string, LX.UserApi.UserApiInfo>()
let primaryRuntimeId = ''
let sequence = 0
export const loadScript = (info: LX.UserApi.UserApiInfo & { script: string }, primary = true) => {
  const runtimeId = `${info.id}:${++sequence}`
  const { script, ...metadata } = info
  scripts.set(runtimeId, metadata)
  if (primary) primaryRuntimeId = runtimeId
  UserApiModule.loadScript({
    runtimeId,
    id: info.id,
    name: info.name,
    description: info.description,
    version: info.version ?? '',
    author: info.author ?? '',
    homepage: info.homepage ?? '',
    script,
  })
  return runtimeId
}

export interface SendResponseParams {
  requestKey: string
  error: string | null
  response: {
    statusCode: number
    statusMessage: string
    headers: Record<string, string>
    body: any
  } | null
}
export interface SendActions {
  request: LX.UserApi.UserApiRequestParams
  response: SendResponseParams
}
export const sendAction = <T extends keyof SendActions>(action: T, data: SendActions[T], runtimeId = primaryRuntimeId) => {
  if (scripts.has(runtimeId)) UserApiModule.sendAction(runtimeId, action, JSON.stringify(data))
}

// export const clearAppCache = CacheModule.clearAppCache as () => Promise<void>

export interface InitParams {
  status: boolean
  errorMessage: string
  info: LX.UserApi.UserApiInfo
}

export interface ResponseParams {
  status: boolean
  errorMessage?: string
  requestKey: string
  result: any
}
export interface UpdateInfoParams {
  name: string
  log: string
  updateUrl: string
}
export interface RequestParams {
  requestKey: string
  url: string
  options: {
    method: string
    data: any
    timeout: number
    headers: any
    binary: boolean
  }
}
export type CancelRequestParams = string

export interface Actions {
  init: InitParams
  request: RequestParams
  cancelRequest: CancelRequestParams
  response: ResponseParams
  showUpdateAlert: UpdateInfoParams
  log: string
}
export type ActionsEvent = { [K in keyof Actions]: { runtimeId: string, action: K, data: Actions[K] } }[keyof Actions]

export const onScriptAction = (handler: (event: ActionsEvent) => void): () => void => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(UserApiModule)
  const eventListener = eventEmitter.addListener('api-action', event => {
    const info = scripts.get(event.runtimeId as string)
    if (!info) return
    try {
      if (event.data) event.data = JSON.parse(event.data as string)
    } catch { return }
    if (event.action == 'init') {
      event.data.info = { ...info, sources: event.data.info?.sources }
    } else if (event.action == 'showUpdateAlert') {
      if (!info.allowShowUpdateAlert) return
    }
    handler(event as ActionsEvent)
  })

  return () => {
    eventListener.remove()
  }
}

export const destroy = (runtimeId?: string) => {
  if (runtimeId) {
    scripts.delete(runtimeId)
    UserApiModule.destroyScript(runtimeId)
  } else {
    scripts.clear()
    primaryRuntimeId = ''
    UserApiModule.destroy()
  }
}
