import { app, safeStorage } from 'electron'
import { createHash, randomBytes } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import getStore from '@main/utils/store'
import { encryptBuffer, decryptBuffer, encryptFile, decryptFile } from './cloudCipher'
import { createCloudStorage, objectKey, type CloudConfig, type CloudProvider } from './cloudStorage'
import { emptyProfiles, normalizeProfiles, withProfile, type CloudProfiles } from './cloudProfiles'

export type { CloudConfig } from './cloudStorage'
export interface CloudTrack {
  id: string
  name: string
  singer: string
  fileName: string
  size: number
  playlist: string
}

const STORE_NAME = 'cloud_library_credentials'
const STORE_KEY = 'config'
const PASSWORD_KEY = 'password'
const validProvider = (provider: string): provider is CloudProvider => ['s3', 'webdav'].includes(provider)
const safePart = (value: string) => value.replace(/[^\p{L}\p{N} ._()-]/gu, '_').slice(0, 160).trim() || 'music'

const validateConfig = (config: CloudConfig) => {
  const endpoint = new URL(config.endpoint)
  if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(endpoint.hostname))) throw new Error('云服务地址必须使用 HTTPS')
  if (!['s3', 'webdav'].includes(config.provider) || !config.accessKey || !config.secretKey) throw new Error('请填写完整的云服务配置')
  if (config.provider === 's3' && (!config.bucket || !config.region)) throw new Error('请填写存储桶和区域')
  if (!/^[A-Za-z0-9/_-]*$/.test(config.prefix) || config.prefix.includes('..')) throw new Error('云端目录只能使用字母、数字、/、_ 和 -')
}

export const saveCloudConfig = (config: CloudConfig) => {
  const store = readProfiles()
  const next = withProfile(store, config)
  validateConfig(next.profiles[config.provider]!)
  persistProfiles(next)
  return getCloudConfig()
}

const persistProfiles = (store: CloudProfiles) => {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('系统安全存储不可用')
  getStore(STORE_NAME).set(STORE_KEY, safeStorage.encryptString(JSON.stringify(store)).toString('base64'))
}

const readProfiles = (): CloudProfiles => {
  const value = getStore(STORE_NAME).get<string>(STORE_KEY)
  if (!value) return emptyProfiles()
  if (!safeStorage.isEncryptionAvailable()) throw new Error('系统安全存储不可用')
  const saved = JSON.parse(safeStorage.decryptString(Buffer.from(value, 'base64'))) as CloudProfiles | CloudConfig
  const profiles = normalizeProfiles(saved)
  if (!validProvider(profiles.activeProvider)) throw new Error('云端配置格式错误')
  return profiles
}

const readCloudConfig = (): CloudConfig => {
  const store = readProfiles()
  const config = store.profiles[store.activeProvider]
  if (!config) throw new Error('请先配置云服务')
  return config
}

export const getCloudConfig = () => {
  try {
    const store = readProfiles()
    const config = store.profiles[store.activeProvider]
    if (!config) return { provider: store.activeProvider, configured: false }
    const { secretKey, ...visible } = config
    return { ...visible, configured: true }
  } catch {
    return { provider: 's3' as const, configured: false }
  }
}

export const getSavedCloudPassword = (): string => {
  const saved = getStore(STORE_NAME).get<string>(PASSWORD_KEY)
  if (!saved) return ''
  if (!safeStorage.isEncryptionAvailable()) throw new Error('系统安全存储不可用')
  return safeStorage.decryptString(Buffer.from(saved, 'base64'))
}

export const saveCloudPassword = (password: string): void => {
  if (password && password.length < 8) throw new Error('加密口令至少需要 8 个字符')
  if (!safeStorage.isEncryptionAvailable()) throw new Error('系统安全存储不可用')
  getStore(STORE_NAME).set(PASSWORD_KEY, password ? safeStorage.encryptString(password).toString('base64') : null)
}

export const selectCloudProvider = (provider: CloudProvider) => {
  if (!validProvider(provider)) throw new Error('不支持的远程服务')
  const store = readProfiles()
  store.activeProvider = provider
  persistProfiles(store)
  return getCloudConfig()
}

const storageFor = (config: CloudConfig) => createCloudStorage(config)

const tempFile = (suffix: string) => join(app.getPath('temp'), `qmusic-cloud-${randomBytes(12).toString('hex')}${suffix}`)

export const listCloudTracks = async(password: string): Promise<CloudTrack[]> => {
  if (password && password.length < 8) throw new Error('端到端加密口令至少需要 8 个字符')
  const config = readCloudConfig()
  const storage = storageFor(config)
  const encrypted = Boolean(password)
  const prefix = objectKey(config, 'meta', '', encrypted)
  const keys = await storage.list(prefix.slice(0, -4))
  const tracks: CloudTrack[] = []
  for (const key of keys) {
    const temp = tempFile('.qmc')
    try {
      await storage.get(key, temp)
      const metadata = await readFile(temp)
      const track = JSON.parse((encrypted ? decryptBuffer(metadata, password) : metadata).toString('utf8')) as CloudTrack
      if (/^[a-f0-9]{64}$/.test(track.id) && track.name && track.fileName) tracks.push(track)
    } finally { await rm(temp, { force: true }) }
  }
  return tracks
}

export const uploadCloudTrack = async(source: string, password: string, playlist = '云端曲库', name = '', singer = ''): Promise<CloudTrack> => {
  if (password && password.length < 8) throw new Error('端到端加密口令至少需要 8 个字符')
  const config = readCloudConfig()
  const info = await stat(source)
  if (!info.isFile() || info.size === 0) throw new Error('请选择有效歌曲文件')
  if (!/\.(mp3|flac|wav|m4a|aac|ogg|ape)$/i.test(source)) throw new Error('不支持的歌曲格式')
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(source)) hash.update(chunk as Buffer)
  const id = hash.digest('hex')
  const track: CloudTrack = { id, name: name.trim().slice(0, 160) || basename(source, extname(source)), singer: singer.trim().slice(0, 160), fileName: basename(source), size: info.size, playlist: playlist.trim().slice(0, 100) || '云端曲库' }
  const audio = tempFile('.qmc')
  const meta = tempFile('.qmc')
  try {
    const storage = storageFor(config)
    const encrypted = Boolean(password)
    if (encrypted) await encryptFile(source, audio, password)
    await storage.put(objectKey(config, 'audio', id, encrypted), encrypted ? audio : source)
    const metadata = Buffer.from(JSON.stringify(track))
    await writeFile(meta, encrypted ? encryptBuffer(metadata, password) : metadata)
    await storage.put(objectKey(config, 'meta', id, encrypted), meta)
    return track
  } finally { await Promise.all([rm(audio, { force: true }), rm(meta, { force: true })]) }
}

export const importCloudTracks = async(ids: string[], password: string): Promise<Array<CloudTrack & { filePath: string }>> => {
  const config = readCloudConfig()
  const encryptedMode = Boolean(password)
  const tracks = (await listCloudTracks(password)).filter(track => ids.includes(track.id))
  const storage = storageFor(config)
  const destination = join(app.getPath('music'), 'QMusic Cloud')
  await mkdir(destination, { recursive: true })
  const imported: Array<CloudTrack & { filePath: string }> = []
  for (const track of tracks) {
    const ext = extname(track.fileName).toLowerCase()
    const filePath = join(destination, `${safePart(track.name)}-${track.id.slice(0, 8)}${ext}`)
    let validLocalFile = false
    if (existsSync(filePath)) {
      const hash = createHash('sha256')
      for await (const chunk of createReadStream(filePath)) hash.update(chunk as Buffer)
      validLocalFile = hash.digest('hex') === track.id
    }
    if (!validLocalFile) {
      const remote = tempFile('.qmc')
      const restored = tempFile(ext)
      try {
        await storage.get(objectKey(config, 'audio', track.id, encryptedMode), remote)
        if (encryptedMode) await decryptFile(remote, restored, password)
        else await copyFile(remote, restored)
        const hash = createHash('sha256')
        for await (const chunk of createReadStream(restored)) hash.update(chunk as Buffer)
        if (hash.digest('hex') !== track.id) throw new Error('云端歌曲校验失败')
        await copyFile(restored, filePath)
      } finally { await Promise.all([rm(remote, { force: true }), rm(restored, { force: true })]) }
    }
    imported.push({ ...track, filePath })
  }
  return imported
}
