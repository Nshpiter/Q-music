import { randomBytes } from 'node:crypto'
import { app } from 'electron'
import { join } from 'node:path'
import { readFile, writeFile, stat, rm } from 'node:fs/promises'
import defaultSetting from '@common/defaultSetting'
import { parseCloudSnapshot, portableSettings, snapshotFileId, snapshotKey, snapshotSummary, restoreSnapshotSources, SNAPSHOT_LIMIT, type CloudSnapshot, type SnapshotSelection } from '@common/utils/cloudSnapshot'
import { getApiList, importApi } from '@main/modules/userApi'
import { getScript } from '@main/modules/userApi/utils'
import { readCloudConfig } from './cloudLibrary'
import { createCloudStorage } from './cloudStorage'
import { encryptBuffer, decryptBuffer } from './cloudCipher'
import { exportSnapshotAccounts, restoreSnapshotAccounts } from './musicAccount'

const tempFile = () => join(app.getPath('temp'), `qmusic-config-${randomBytes(12).toString('hex')}.qmc`)
const requireKey = (password: string) => { if (typeof password != 'string' || password.length < 8 || password.length > 1024) throw new Error('请填写至少 8 位的配置备份密钥，两端使用同一密钥') }
const sources = async() => Promise.all(getApiList().map(async item => ({ id: item.id, name: item.name, script: await getScript(item.id) })))
let preview: { token: string, config: string, snapshot: CloudSnapshot, expiresAt: number } | undefined

export const generateSnapshotKey = () => randomBytes(24).toString('hex')
export const listConfigBackups = async() => {
  const config = readCloudConfig()
  const prefix = snapshotKey(config.prefix, '1000000000000-0000000000000000.qmc').replace(/[^/]+$/, '')
  return [...new Set((await createCloudStorage(config).list(prefix)).map(snapshotFileId).filter((id): id is string => !!id))].sort().reverse().slice(0, 50)
}
export const uploadConfigBackup = async(password: string, selected: SnapshotSelection) => {
  requireKey(password)
  const config = readCloudConfig()
  const setting = global.lx.appSetting
  const snapshot: CloudSnapshot = { format: 'qmusic-config', version: 1, platform: 'desktop', createdAt: Date.now() }
  if (selected.settings) snapshot.settings = portableSettings(setting as unknown as Record<string, unknown>, defaultSetting as unknown as Record<string, unknown>)
  if (selected.sources) {
    snapshot.sources = await sources()
    const ids = new Set(snapshot.sources.map(item => item.id))
    snapshot.sourceSelection = { primary: ids.has(setting['common.apiSource']) ? setting['common.apiSource'] : '', backups: setting['common.apiBackupSources'].filter(id => ids.has(id)) }
  }
  if (selected.accounts) snapshot.accounts = await exportSnapshotAccounts()
  const raw = JSON.stringify(snapshot)
  parseCloudSnapshot(raw)
  if (Buffer.byteLength(raw) > SNAPSHOT_LIMIT) throw new Error('配置备份超过 8 MB，请减少音源数量')
  const id = `${snapshot.createdAt}-${randomBytes(8).toString('hex')}.qmc`
  const temp = tempFile()
  try {
    await writeFile(temp, encryptBuffer(Buffer.from(raw), password))
    await createCloudStorage(config).put(snapshotKey(config.prefix, id), temp)
    return id
  } finally { await rm(temp, { force: true }) }
}
export const previewConfigBackup = async(id: string, password: string) => {
  requireKey(password)
  preview = undefined
  const config = readCloudConfig()
  const temp = tempFile()
  try {
    await createCloudStorage(config).get(snapshotKey(config.prefix, id), temp, SNAPSHOT_LIMIT + 64)
    if ((await stat(temp)).size > SNAPSHOT_LIMIT + 64) throw new Error('配置备份超过大小限制')
    let raw: string
    try { raw = decryptBuffer(await readFile(temp), password).toString('utf8') } catch { throw new Error('密钥不匹配或备份已损坏，未修改本地配置') }
    const snapshot = parseCloudSnapshot(raw)
    const token = randomBytes(16).toString('hex')
    preview = { token, config: JSON.stringify(config), snapshot, expiresAt: Date.now() + 5 * 60_000 }
    return { token, ...snapshotSummary(snapshot, defaultSetting as unknown as Record<string, unknown>) }
  } finally { await rm(temp, { force: true }) }
}
export const restoreConfigBackup = async(token: string, selected: SnapshotSelection) => {
  const pending = preview
  preview = undefined
  if (!pending || pending.token != token || pending.expiresAt < Date.now() || pending.config != JSON.stringify(readCloudConfig())) throw new Error('备份预览已过期或连接已切换，请重新预览')
  if (!selected.settings && !selected.sources && !selected.accounts) throw new Error('请选择要恢复的内容')
  const { snapshot } = pending
  const summary = snapshotSummary(snapshot, defaultSetting as unknown as Record<string, unknown>)
  if (!(selected.settings && summary.settings) && !(selected.sources && snapshot.sources) && !(selected.accounts && summary.accounts.length)) throw new Error('这份备份不包含勾选的内容，请重新选择')
  let stage = '音源'
  try {
    const setting = selected.settings ? portableSettings(snapshot.settings ?? {}, defaultSetting as unknown as Record<string, unknown>) : {}
    if (selected.sources && snapshot.sources) Object.assign(setting, await restoreSnapshotSources(snapshot, await sources(), async script => (await importApi(script)).apiInfo.id))
    stage = '账号'
    if (selected.accounts && snapshot.accounts) await restoreSnapshotAccounts(snapshot.accounts)
    stage = '设置'
    global.lx.event_app.update_config(setting as Partial<LX.AppSetting>)
    return snapshotSummary(snapshot, defaultSetting as unknown as Record<string, unknown>)
  } catch { throw new Error(`${stage}恢复失败；此前已完成的项目保留。请重新预览后重试，相同音源不会重复导入。`) }
}
