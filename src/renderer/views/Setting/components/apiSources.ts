import { computed } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'
import { userApi } from '@renderer/store'
import apiSourceInfo from '@renderer/utils/musicSdk/api-source-info'

export type ApiSourceStatusKey =
  | 'setting__basic_source_status_success'
  | 'setting__basic_source_status_initing'
  | 'setting__basic_source_status_failed'

export interface SettingApiSourceItem {
  id: string
  name: string
  label: string
  disabled: boolean
  desc?: string
  statusLabel?: string
}

export const useApiSources = (t: (key: ApiSourceStatusKey) => string) => {
  const getApiStatus = () => {
    if (userApi.status) return t('setting__basic_source_status_success')
    if (userApi.message == 'initing') return t('setting__basic_source_status_initing')
    return t('setting__basic_source_status_failed')
  }

  return computed<SettingApiSourceItem[]>(() => [
    ...apiSourceInfo.map(api => ({
      id: api.id,
      name: api.name,
      label: api.name,
      disabled: api.disabled,
    })),
    ...userApi.list.map(api => {
      const statusText = api.id == appSetting['common.apiSource'] ? `[${getApiStatus()}]` : ''
      const version = api.version ?? ''
      const desc = version ? (/^\d/.test(version) ? `v${version}` : version) : ''
      return {
        id: api.id,
        name: api.name,
        label: `${api.name}${statusText}`,
        desc,
        statusLabel: statusText,
        disabled: false,
      }
    }),
  ])
}
