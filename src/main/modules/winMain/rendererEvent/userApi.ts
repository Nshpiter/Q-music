import { WIN_MAIN_RENDERER_EVENT_NAME } from '@common/ipcNames'
import { mainHandle, mainOn } from '@common/mainIpc'
import {
  getApiList,
  importApi,
  removeApi,
  replaceApiScript,
  setApi,
  setAutoUpdate,
  setSourceUrl,
  getStatus,
  request,
  cancelRequest,
  setAllowShowUpdateAlert,
} from '@main/modules/userApi'
import { sendEvent } from '@main/modules/winMain/main'

export default () => {
  mainHandle<string | LX.UserApi.ImportUserApiParams, LX.UserApi.ImportUserApi>(WIN_MAIN_RENDERER_EVENT_NAME.import_user_api, async({ params }) => {
    if (typeof params == 'string') return importApi(params)
    return importApi(params.script, params.sourceUrl)
  })

  mainHandle<LX.UserApi.UserApiReplaceScriptParams, LX.UserApi.UserApiReplaceScriptResult>(WIN_MAIN_RENDERER_EVENT_NAME.replace_user_api_script, async({ params }) => {
    return replaceApiScript(params.id, params.script)
  })

  mainHandle<LX.UserApi.UserApiSetSourceUrlParams, LX.UserApi.UserApiInfo[]>(WIN_MAIN_RENDERER_EVENT_NAME.user_api_set_source_url, async({ params }) => {
    return setSourceUrl(params.id, params.sourceUrl)
  })

  mainHandle<LX.UserApi.UserApiSetAutoUpdateParams, LX.UserApi.UserApiInfo[]>(WIN_MAIN_RENDERER_EVENT_NAME.user_api_set_auto_update, async({ params }) => {
    return setAutoUpdate(params.id, params.enable)
  })

  mainHandle<string[], LX.UserApi.UserApiInfo[]>(WIN_MAIN_RENDERER_EVENT_NAME.remove_user_api, async({ params: apiIds }) => {
    return removeApi(apiIds)
  })

  mainHandle<LX.UserApi.UserApiSetApiParams>(WIN_MAIN_RENDERER_EVENT_NAME.set_user_api, async({ params: apiId }) => {
    await setApi(apiId)
  })

  mainHandle<LX.UserApi.UserApiInfo[]>(WIN_MAIN_RENDERER_EVENT_NAME.get_user_api_list, async() => {
    return getApiList()
  })

  mainHandle<string | undefined, LX.UserApi.UserApiStatus>(WIN_MAIN_RENDERER_EVENT_NAME.get_user_api_status, async({ params }) => {
    return getStatus(params)
  })

  mainHandle<LX.UserApi.UserApiSetAllowUpdateAlertParams>(WIN_MAIN_RENDERER_EVENT_NAME.user_api_set_allow_update_alert, async({ params: { id, enable } }) => {
    setAllowShowUpdateAlert(id, enable)
  })

  mainHandle<LX.UserApi.UserApiRequestParams>(WIN_MAIN_RENDERER_EVENT_NAME.request_user_api, async({ params }) => {
    return request(params)
  })
  mainOn<LX.UserApi.UserApiRequestCancelParams>(WIN_MAIN_RENDERER_EVENT_NAME.request_user_api_cancel, ({ params: requestKey }) => {
    cancelRequest(requestKey)
  })
}

export const sendStatusChange = (status: LX.UserApi.UserApiStatus) => {
  sendEvent(WIN_MAIN_RENDERER_EVENT_NAME.user_api_status, status)
}
export const sendShowUpdateAlert = (info: LX.UserApi.UserApiUpdateInfo) => {
  sendEvent(WIN_MAIN_RENDERER_EVENT_NAME.user_api_show_update_alert, info)
}
