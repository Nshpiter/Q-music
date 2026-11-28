import { closeApis, loadApi, reloadLoadedApi, setAllowShowUpdateAlert as setRendererEventAllowShowUpdateAlert, init } from './runtime'
import {
  getUserApis,
  importApi as handleImportApi,
  removeApi as handleRemoveApi,
  replaceApiScript as handleReplaceApiScript,
  setAllowShowUpdateAlert as saveAllowShowUpdateAlert,
  setAutoUpdate as saveAutoUpdate,
  setSourceUrl as saveSourceUrl,
} from './utils'


let userApiId: string | null
let selectionRevision = 0

export const getApiList = getUserApis

export const importApi = async(script: string, sourceUrl?: string): Promise<LX.UserApi.ImportUserApi> => {
  return {
    apiInfo: await handleImportApi(script, sourceUrl),
    apiList: getUserApis(),
  }
}

export const replaceApiScript = async(id: string, script: string): Promise<LX.UserApi.UserApiReplaceScriptResult> => {
  const result = await handleReplaceApiScript(id, script)
  if (result.changed) await reloadLoadedApi(id)
  return result
}

export const setSourceUrl = (id: string, sourceUrl: string): LX.UserApi.UserApiInfo[] => {
  return saveSourceUrl(id, sourceUrl)
}

export const setAutoUpdate = (id: string, enable: boolean): LX.UserApi.UserApiInfo[] => {
  return saveAutoUpdate(id, enable)
}

export const removeApi = async(ids: string[]): Promise<LX.UserApi.UserApiInfo[]> => {
  if (userApiId && ids.includes(userApiId)) {
    userApiId = null
  }
  await closeApis(ids)
  handleRemoveApi(ids)
  return getUserApis()
}

export const setApi = async(id: string) => {
  const revision = ++selectionRevision
  if (userApiId) {
    userApiId = null
  }
  await closeApis()
  if (revision !== selectionRevision) return
  userApiId ||= id
  await loadApi(id)
}

export const setAllowShowUpdateAlert = (id: string, enable: boolean) => {
  saveAllowShowUpdateAlert(id, enable)
  setRendererEventAllowShowUpdateAlert(id, enable)
}


export * from './runtime'

export default () => {
  init()

  global.lx.event_app.on('main_window_close', () => {
    void closeApis()
  })
}
