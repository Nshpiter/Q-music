// import { setUserApi as setUserApiAction } from '@renderer/utils/ipc'
import musicSdk from '@/utils/musicSdk'
// import apiSourceInfo from '@renderer/utils/musicSdk/api-source-info'
import { updateSetting } from './common'
import settingState from '@/store/setting/state'
import { destroyUserApi, setUserApi, setUserApiStatus } from './userApi'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'


let selectionRevision = 0
export const setApiSource = (apiId: string) => {
  const revision = ++selectionRevision
  if (global.lx.apiInitPromise[1]) {
    global.lx.apiInitPromise[0] = new Promise(resolve => {
      global.lx.apiInitPromise[1] = false
      global.lx.apiInitPromise[2] = (result: boolean) => {
        global.lx.apiInitPromise[1] = true
        resolve(result)
      }
    })
  }
  if (/^user_api/.test(apiId)) {
    setUserApi(apiId).catch(err => {
      if (revision !== selectionRevision) return
      if (!global.lx.apiInitPromise[1]) global.lx.apiInitPromise[2](false)
      setUserApiStatus(false, err instanceof Error ? err.message : 'source init failed')
      console.log(err)
      if (err.message !== 'api not found') return
      let api = apiSourceInfo.find(api => !api.disabled)
      if (!api) return
      if (api.id != settingState.setting['common.apiSource']) setApiSource(api.id)
    })
  } else {
    // @ts-expect-error
    global.lx.qualityList = musicSdk.supportQuality[apiId] ?? {}
    destroyUserApi()
    if (!global.lx.apiInitPromise[1]) global.lx.apiInitPromise[2](true)
    // apiSource.value = apiId
    // void setUserApiAction(apiId)
  }

  if (apiId != settingState.setting['common.apiSource']) {
    updateSetting({ 'common.apiSource': apiId })
    requestAnimationFrame(() => {
      global.state_event.apiSourceUpdated(apiId)
    })
  }
}

