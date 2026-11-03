import { NativeModules } from 'react-native'
import defaultSetting from '@/config/defaultSetting'
import settingState from '@/store/setting/state'
import { updateSetting, persistSetting } from './common'
import { getUserApiList, getUserApiScript, addUserApi } from '@/utils/data'
import { setUserApiList } from './userApi'
import { getProviderCookies, getQQCredentials } from './musicAccount/cookies'
import { readKugouSession, saveKugouSession } from './musicAccount/kugou'
import { saveQQImportedCookies } from './musicAccount/qqImportedSession'
import { clearOfficialUrlCache } from './musicAccount/cache'
import { clearDailyCache } from './musicAccount/daily'
import { parseCloudSnapshot, parseSnapshotAccounts, portableSettings, restoreSnapshotSources, snapshotSummary, type CloudSnapshot, type SnapshotSelection } from '@/utils/cloudSnapshot'
import { getCloudConfig, putCloudBackup, readCloudBackup } from './cloudLibrary'

const sources = async() => Promise.all((await getUserApiList()).map(async item => ({ id: item.id, name: item.name, script: await getUserApiScript(item.id) })))
const exportAccounts = async(): Promise<NonNullable<CloudSnapshot['accounts']>> => {
  const accounts: NonNullable<CloudSnapshot['accounts']> = {}
  const { uin, authst, isWeChat } = getQQCredentials(await getProviderCookies('tx'))
  if (uin && authst) accounts.tx = { qqmusic_uin: uin, qqmusic_key: authst, musicid: uin, musickey: authst, login_type: isWeChat ? '2' : '1', ...(isWeChat ? { wxuin: uin } : { uin }) }
  const wy = await getProviderCookies('wy')
  if (wy.MUSIC_U) accounts.wy = { MUSIC_U: wy.MUSIC_U, ...(wy.__csrf ? { __csrf: wy.__csrf } : {}) }
  const kg = await readKugouSession()
  if (kg) accounts.kg = { ...kg }
  return parseSnapshotAccounts(accounts)
}
export const uploadCloudConfig = async(password: string, selected: SnapshotSelection) => {
  const setting = settingState.setting
  const snapshot: CloudSnapshot = { format: 'qmusic-config', version: 1, platform: 'android', createdAt: Date.now() }
  if (selected.settings) snapshot.settings = portableSettings(setting as unknown as Record<string, unknown>, defaultSetting as unknown as Record<string, unknown>)
  if (selected.sources) {
    snapshot.sources = await sources()
    const ids = new Set(snapshot.sources.map(item => item.id))
    snapshot.sourceSelection = { primary: ids.has(setting['common.apiSource']) ? setting['common.apiSource'] : '', backups: setting['common.apiBackupSources'].filter(id => ids.has(id)) }
  }
  if (selected.accounts) snapshot.accounts = await exportAccounts()
  const raw = JSON.stringify(snapshot)
  parseCloudSnapshot(raw)
  return putCloudBackup(raw, password)
}

export const previewCloudConfig = async(id: string, password: string) => {
  const config = JSON.stringify(await getCloudConfig())
  const snapshot = parseCloudSnapshot(await readCloudBackup(id, password))
  const expiresAt = Date.now() + 5 * 60_000
  let consumed = false
  return {
    ...snapshotSummary(snapshot, defaultSetting as unknown as Record<string, unknown>),
    async restore(selected: SnapshotSelection) {
      if (consumed || expiresAt < Date.now()) throw new Error('备份预览已过期，请重新预览')
      if (!selected.settings && !selected.sources && !selected.accounts) throw new Error('请选择要恢复的内容')
      const summary = snapshotSummary(snapshot, defaultSetting as unknown as Record<string, unknown>)
      if (!(selected.settings && summary.settings) && !(selected.sources && snapshot.sources) && !(selected.accounts && summary.accounts.length)) throw new Error('这份备份不包含勾选的内容，请重新选择')
      consumed = true
      if (config != JSON.stringify(await getCloudConfig())) throw new Error('连接已切换，请重新预览')
      let stage = '音源'
      try {
        const setting = selected.settings ? portableSettings(snapshot.settings ?? {}, defaultSetting as unknown as Record<string, unknown>) : {}
        if (selected.sources && snapshot.sources) {
          Object.assign(setting, await restoreSnapshotSources(snapshot, await sources(), async script => (await addUserApi(script)).id))
          setUserApiList(await getUserApiList())
        }
        stage = '账号'
        if (selected.accounts && snapshot.accounts) {
          const accounts = parseSnapshotAccounts(snapshot.accounts)
          if (accounts.tx) await saveQQImportedCookies(accounts.tx)
          if (accounts.wy) await NativeModules.MusicCredentialModule.restoreNeteaseCookies(JSON.stringify(accounts.wy))
          if (accounts.kg) await saveKugouSession({ userId: accounts.kg.userId, token: accounts.kg.token, mid: accounts.kg.mid, nickname: accounts.kg.nickname ?? '', avatar: accounts.kg.avatar ?? '' })
          clearOfficialUrlCache()
          clearDailyCache()
        }
        stage = '设置'
        updateSetting(setting as Partial<LX.AppSetting>)
        await persistSetting()
      } catch { throw new Error(`${stage}恢复失败；此前已完成的项目保留。请重新预览后重试，相同音源不会重复导入。`) }
    },
  }
}
