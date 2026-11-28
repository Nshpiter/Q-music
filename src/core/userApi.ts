import { action, state as userApiState } from '@/store/userApi'
import {
  addUserApi,
  removeUserApi as removeUserApiFromStore,
  replaceUserApiScript,
  setUserApiAllowShowUpdateAlert as setUserApiAllowShowUpdateAlertFromStore,
  updateUserApiMeta,
} from '@/utils/data'
import { hasUserApiRuntime, loadUserApiRuntime, resetUserApiRuntimes } from './userApiRuntime'
import { log as writeLog } from '@/utils/log'
import settingState from '@/store/setting/state'
import { httpFetch } from '@/utils/request'
import { runUserApiUpdates, type UserApiBatchUpdateResult } from '@/utils/userApiImport'


export const setUserApi = async(apiId: string) => {
  global.lx.qualityList = {}
  setUserApiStatus(false, 'initing')

  resetUserApiRuntimes()
  await loadUserApiRuntime(apiId, true)
}

export const destroyUserApi = () => {
  resetUserApiRuntimes()
}


export const setUserApiStatus: typeof action['setStatus'] = (status, message) => {
  action.setStatus(status, message)
}

export const setUserApiList: typeof action['setUserApiList'] = (list) => {
  action.setUserApiList(list)
}

export const importUserApi = async(script: string, sourceUrl?: string) => {
  const info = await addUserApi(script, sourceUrl)
  action.addUserApi(info)
  return info
}

export const updateUserApiSourceUrl = async(id: string, sourceUrl: string) => {
  const list = await updateUserApiMeta(id, { sourceUrl })
  action.setUserApiList(list)
  return list
}

export const setUserApiAutoUpdate = async(id: string, enable: boolean) => {
  const list = await updateUserApiMeta(id, { autoUpdate: enable })
  action.setUserApiList(list)
  return list
}

export const replaceUserApiScriptContent = async(id: string, script: string): Promise<{ changed: boolean, apiInfo: LX.UserApi.UserApiInfo, apiList: LX.UserApi.UserApiInfo[] }> => {
  const result = await replaceUserApiScript(id, script)
  action.setUserApiList(result.apiList)
  if (result.changed) {
    const isPrimary = settingState.setting['common.apiSource'] === id
    if (isPrimary || hasUserApiRuntime(id)) {
      resetUserApiRuntimes([id])
      await loadUserApiRuntime(id, isPrimary)
    }
  }
  return result
}

export const updateUserApisFromUrls = async(targetIds?: string[]): Promise<UserApiBatchUpdateResult<LX.UserApi.UserApiInfo>> => {
  const targets = targetIds?.length
    ? userApiState.list.filter(api => targetIds.includes(api.id))
    : userApiState.list
  return runUserApiUpdates<LX.UserApi.UserApiInfo>({
    apis: targets,
    fetchScript: url => httpFetch(url),
    replaceScript: async(id, script) => {
      const result = await replaceUserApiScriptContent(id, script)
      return { changed: result.changed, apiInfo: result.apiInfo }
    },
  })
}

export const removeUserApi = async(ids: string[]) => {
  resetUserApiRuntimes(ids)
  const list = await removeUserApiFromStore(ids)
  action.setUserApiList(list)
}

export const setUserApiAllowShowUpdateAlert = async(id: string, enable: boolean) => {
  await setUserApiAllowShowUpdateAlertFromStore(id, enable)
  action.setUserApiAllowShowUpdateAlert(id, enable)
}

export const log = {
  r_info(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    writeLog.info(...params)
  },
  r_warn(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    writeLog.warn(...params)
  },
  r_error(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    writeLog.error(...params)
  },
  log(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    if (global.lx.isEnableUserApiLog) writeLog.info(...params)
  },
  info(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    if (global.lx.isEnableUserApiLog) writeLog.info(...params)
  },
  warn(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    if (global.lx.isEnableUserApiLog) writeLog.warn(...params)
  },
  error(...params: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    if (global.lx.isEnableUserApiLog) writeLog.error(...params)
  },
}
