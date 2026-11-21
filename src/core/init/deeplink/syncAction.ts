import { updateSetting } from '@/core/common'
import { connectServer } from '@/plugins/sync'
import { addSyncHostHistory, setSyncHost } from '@/utils/data'
import { toast } from '@/utils/tools'

const connectSyncHost = async(data: unknown) => {
  if (!data || typeof data !== 'object') throw new Error(global.i18n.t('sync_qr_invalid'))
  const host = 'host' in data && typeof data.host == 'string' ? data.host.trim().replace(/\/$/, '') : ''
  const authCode = 'authCode' in data && typeof data.authCode == 'string' ? data.authCode.trim() : ''

  if (!/^https?:\/\/\S+$/i.test(host) || !authCode || authCode.length > 64) {
    throw new Error(global.i18n.t('sync_qr_invalid'))
  }

  await Promise.all([
    setSyncHost(host),
    addSyncHostHistory(host),
  ])
  updateSetting({ 'sync.enable': true })
  await connectServer(host, authCode)
  toast(global.i18n.t('sync_qr_connecting'))
}

export const handleSyncAction = async(action: string, params: { data?: unknown }) => {
  if (action == 'connect') await connectSyncHost(params.data)
}
