// PC、安卓共用配置快照协议；只迁移兼容偏好，不携带设备路径、权限或同步服务密钥。
export const SNAPSHOT_LIMIT = 8 * 1024 * 1024
export const SNAPSHOT_ROOT = 'qmusic-cloud/config/v1/'
export type SnapshotProvider = 'tx' | 'wy' | 'kg'
export interface SnapshotSelection { settings: boolean, sources: boolean, accounts: boolean }
export interface SnapshotSource { id: string, name: string, script: string }
export interface CloudSnapshot {
  format: 'qmusic-config'
  version: 1
  platform: 'desktop' | 'android'
  createdAt: number
  settings?: Record<string, unknown>
  sources?: SnapshotSource[]
  sourceSelection?: { primary: string, backups: string[] }
  accounts?: Partial<Record<SnapshotProvider, Record<string, string>>>
}

const preferences = new Set([
  'common.langId', 'common.sourceNameType',
  'player.togglePlayMethod', 'player.playQuality', 'player.playbackRate',
  'player.isSavePlayTime', 'player.isShowLyricTranslation', 'player.isShowLyricRoma', 'player.isS2t',
  'player.isAutoCleanPlayedList', 'playDetail.style.layout', 'playDetail.style.align',
  'list.singlePlayMode', 'list.isClickPlayList', 'list.addMusicLocationType',
  'search.isShowHotSearch', 'search.isShowHistorySearch',
  'theme.id', 'theme.lightId', 'theme.darkId', 'theme.autoByTime', 'theme.appearance', 'theme.dayStart', 'theme.nightStart',
])
const enums: Record<string, string[]> = {
  'common.sourceNameType': ['real', 'alias'],
  'player.togglePlayMethod': ['listLoop', 'random', 'singleLoop', 'list', 'single'],
  'player.playQuality': ['128k', '320k', 'flac', 'flac24bit'],
  'playDetail.style.layout': ['classic', 'immersive'],
  'playDetail.style.align': ['left', 'center', 'right'],
  'list.singlePlayMode': ['add', 'replace'],
  'list.addMusicLocationType': ['top', 'bottom'],
  'theme.appearance': ['light', 'dark', 'system', 'time'],
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value == 'object' && !Array.isArray(value)
const fail = (): never => { throw new Error('配置备份格式无效或版本不兼容') }
const text = (value: unknown, max: number) => typeof value == 'string' && value.length <= max

export const portableSettings = (input: Record<string, unknown>, defaults: Record<string, unknown>) => {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (!preferences.has(key) || !Object.prototype.hasOwnProperty.call(defaults, key)) continue
    if (defaults[key] == null ? value !== null && !text(value, 128) : typeof value != typeof defaults[key]) continue
    if (typeof value == 'object' && value !== null) continue
    if (typeof value == 'string' && value.length > 128) continue
    if (typeof value == 'number' && (!Number.isFinite(value) || value < 0.1 || value > 4)) continue
    if (enums[key] && value !== null && !enums[key].includes(value as string)) continue
    if (['theme.dayStart', 'theme.nightStart'].includes(key) && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value))) continue
    result[key] = value
  }
  return result
}

export const parseSnapshotAccounts = (value: unknown): NonNullable<CloudSnapshot['accounts']> => {
  if (!record(value)) return fail()
  const result: NonNullable<CloudSnapshot['accounts']> = {}
  const allowed: Record<SnapshotProvider, string[]> = {
    tx: ['qqmusic_key', 'musickey', 'qqmusic_uin', 'musicid', 'login_type', 'wxuin', 'uin'],
    wy: ['MUSIC_U', '__csrf'],
    kg: ['userId', 'token', 'mid', 'nickname', 'avatar'],
  }
  for (const [provider, fields] of Object.entries(value)) {
    if (!Object.prototype.hasOwnProperty.call(allowed, provider) || !record(fields)) return fail()
    const data: Record<string, string> = {}
    for (const [key, content] of Object.entries(fields)) {
      if (!allowed[provider as SnapshotProvider].includes(key) || !text(content, 4096)) return fail()
      if (provider != 'kg' && !/^[!-:<-~]*$/.test(content as string)) return fail()
      data[key] = content as string
    }
    if (provider == 'tx' && (!/^[1-9]\d*$/.test(data.qqmusic_uin) || !data.qqmusic_key || !['1', '2'].includes(data.login_type))) return fail()
    if (provider == 'wy' && !data.MUSIC_U) return fail()
    if (provider == 'kg' && (!/^[1-9]\d*$/.test(data.userId) || !data.token || !/^[a-f0-9]{32}$/i.test(data.mid))) return fail()
    result[provider as SnapshotProvider] = data
  }
  return result
}

export const parseCloudSnapshot = (raw: string): CloudSnapshot => {
  if (raw.length > SNAPSHOT_LIMIT) return fail()
  let data: unknown
  try { data = JSON.parse(raw) } catch { return fail() }
  if (!record(data) || data.format != 'qmusic-config' || data.version !== 1 || !['desktop', 'android'].includes(String(data.platform)) || typeof data.createdAt != 'number' || !Number.isSafeInteger(data.createdAt) || data.createdAt <= 0) return fail()
  const result: CloudSnapshot = { format: 'qmusic-config', version: 1, platform: data.platform as CloudSnapshot['platform'], createdAt: data.createdAt }
  if (data.settings !== undefined) {
    if (!record(data.settings) || Object.keys(data.settings).length > 500) return fail()
    result.settings = data.settings
  }
  if (data.sources !== undefined) {
    if (!Array.isArray(data.sources) || data.sources.length > 100) return fail()
    const ids = new Set<string>()
    result.sources = data.sources.map(item => {
      if (!record(item) || !text(item.id, 128) || !item.id || ids.has(item.id as string) || !text(item.name, 256) || !text(item.script, 2 * 1024 * 1024) || !/^\/\*[\s\S]+?\*\//.test(item.script as string)) return fail()
      ids.add(item.id as string)
      return { id: item.id as string, name: item.name as string, script: item.script as string }
    })
    const selection = data.sourceSelection
    if (!record(selection) || !text(selection.primary, 128) || !Array.isArray(selection.backups) || selection.backups.length > 100 || selection.backups.some(id => !text(id, 128))) return fail()
    if ((selection.primary && !ids.has(selection.primary as string)) || selection.backups.some(id => !ids.has(id as string))) return fail()
    result.sourceSelection = { primary: selection.primary as string, backups: selection.backups as string[] }
  }
  if (data.accounts !== undefined) result.accounts = parseSnapshotAccounts(data.accounts)
  if (!result.settings && !result.sources && !result.accounts) return fail()
  return result
}

export const snapshotSummary = (snapshot: CloudSnapshot, defaults: Record<string, unknown>) => ({
  platform: snapshot.platform,
  createdAt: snapshot.createdAt,
  settings: Object.keys(portableSettings(snapshot.settings ?? {}, defaults)).length,
  sources: snapshot.sources?.map(source => source.name) ?? [],
  accounts: Object.keys(snapshot.accounts ?? {}) as SnapshotProvider[],
})

export const snapshotFileId = (key: string) => /(?:^|\/)(\d{13}-[a-f0-9]{16}\.qmc)$/.exec(key)?.[1] ?? null
export const snapshotKey = (prefix: string, id: string) => {
  if (!/^\d{13}-[a-f0-9]{16}\.qmc$/.test(id)) throw new Error('配置备份文件名无效')
  return [prefix.replace(/^\/+|\/+$/g, ''), SNAPSHOT_ROOT + id].filter(Boolean).join('/')
}

export const restoreSnapshotSources = async(snapshot: CloudSnapshot, existing: SnapshotSource[], importScript: (script: string) => Promise<string>) => {
  const ids = new Map<string, string>()
  const known = [...existing]
  for (const source of snapshot.sources ?? []) {
    let local = known.find(item => item.script === source.script)
    if (!local) {
      local = { ...source, id: await importScript(source.script) }
      known.push(local)
    }
    ids.set(source.id, local.id)
  }
  const selection = snapshot.sourceSelection
  return {
    ...(selection?.primary ? { 'common.apiSource': ids.get(selection.primary)! } : {}),
    'common.apiBackupSources': [...new Set(selection?.backups.map(id => ids.get(id)!).filter(Boolean) ?? [])],
  }
}
