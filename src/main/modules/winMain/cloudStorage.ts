import { createReadStream, createWriteStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { XMLParser } from 'fast-xml-parser'
import fetch from 'node-fetch'

export type CloudProvider = 's3' | 'webdav'
export interface CloudConfig {
  provider: CloudProvider
  endpoint: string
  region: string
  bucket: string
  prefix: string
  accessKey: string
  secretKey: string
}

const ENCRYPTED_ROOT = 'qmusic-cloud/v1'
const STANDARD_ROOT = 'qmusic-cloud/standard/v1'
const xmlParser = new XMLParser({ removeNSPrefix: true })

export const objectKey = (config: CloudConfig, type: 'audio' | 'meta', id: string, encrypted = true) => [config.prefix.replace(/^\/+|\/+$/g, ''), encrypted ? ENCRYPTED_ROOT : STANDARD_ROOT, type, `${id}.qmc`].filter(Boolean).join('/')

export interface CloudStorage {
  list: (prefix: string) => Promise<string[]>
  put: (key: string, file: string) => Promise<void>
  get: (key: string, file: string) => Promise<void>
}

const s3Storage = (config: CloudConfig): CloudStorage => {
  const client = new S3Client({ region: config.region, endpoint: config.endpoint, forcePathStyle: true, credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey } })
  return {
    async list(prefix) {
      const keys: string[] = []
      let token: string | undefined
      do {
        const result = await client.send(new ListObjectsV2Command({ Bucket: config.bucket, Prefix: prefix, ContinuationToken: token }))
        keys.push(...(result.Contents ?? []).flatMap(item => item.Key ? [item.Key] : []))
        token = result.NextContinuationToken
      } while (token)
      return keys
    },
    async put(key, file) {
      await new Upload({ client, params: { Bucket: config.bucket, Key: key, Body: createReadStream(file), ContentType: 'application/octet-stream' }, leavePartsOnError: false }).done()
    },
    async get(key, file) {
      const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }))
      if (!result.Body) throw new Error('云端文件为空')
      await pipeline(result.Body as NodeJS.ReadableStream, createWriteStream(file))
    },
  }
}

const webdavStorage = (config: CloudConfig): CloudStorage => {
  const base = config.endpoint.replace(/\/+$/, '')
  const auth = `Basic ${Buffer.from(`${config.accessKey}:${config.secretKey}`).toString('base64')}`
  const urlFor = (key: string) => `${base}/${key.split('/').map(encodeURIComponent).join('/')}`
  const request = async(method: string, key: string, body?: NodeJS.ReadableStream, size?: number) => {
    const response = await fetch(urlFor(key), { method, headers: { Authorization: auth, ...(method === 'PROPFIND' ? { Depth: '1' } : {}), ...(size == null ? {} : { 'Content-Length': String(size) }) }, body: body as any })
    if (!response.ok && !(method === 'MKCOL' && response.status === 405)) throw new Error(`WebDAV ${method} 失败 (${response.status})`)
    return response
  }
  const ensureDirs = async(key: string) => {
    const parts = key.split('/').slice(0, -1)
    for (let index = 1; index <= parts.length; index++) await request('MKCOL', parts.slice(0, index).join('/'))
  }
  return {
    async list(prefix) {
      const response = await fetch(urlFor(prefix.replace(/\/$/, '')), { method: 'PROPFIND', headers: { Authorization: auth, Depth: '1' } })
      if (response.status === 404) return []
      if (!response.ok) throw new Error(`WebDAV PROPFIND 失败 (${response.status})`)
      const result = xmlParser.parse(await response.text())
      const responses = result.multistatus?.response ?? []
      const entries = Array.isArray(responses) ? responses : [responses]
      const basePath = decodeURIComponent(new URL(base).pathname).replace(/\/$/, '') + '/'
      return entries.map((entry: any) => entry.href)
        .filter((href: unknown): href is string => typeof href === 'string')
        .map((href: string) => decodeURIComponent(new URL(href, base + '/').pathname))
        .filter((path: string) => path.startsWith(basePath))
        .map((path: string) => path.slice(basePath.length))
        .filter((key: string) => key.startsWith(prefix) && key.endsWith('.qmc'))
    },
    async put(key, file) { await ensureDirs(key); await request('PUT', key, createReadStream(file), (await stat(file)).size) },
    async get(key, file) { await pipeline((await request('GET', key)).body, createWriteStream(file)) },
  }
}

export const createCloudStorage = (config: CloudConfig): CloudStorage => {
  if (config.provider === 's3') return s3Storage(config)
  if (config.provider === 'webdav') return webdavStorage(config)
  throw new Error('不支持的远程服务')
}
