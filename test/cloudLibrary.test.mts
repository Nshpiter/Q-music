import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { test } from 'node:test'
import { decryptBuffer, decryptFile, encryptBuffer, encryptFile } from '../src/main/modules/winMain/cloudCipher.ts'
import { createCloudStorage, objectKey } from '../src/main/modules/winMain/cloudStorage.ts'
import { normalizeProfiles, withProfile } from '../src/main/modules/winMain/cloudProfiles.ts'

test('云端元数据和音频使用相同口令往返，错误口令或篡改会失败', async() => {
  const password = '中文密码1234'
  const plain = Buffer.from('一首用于验证格式的歌曲')
  const encrypted = encryptBuffer(plain, password)
  assert.equal(encrypted.subarray(0, 5).toString('hex'), '514d434501')
  assert.deepEqual(decryptBuffer(encrypted, password), plain)
  assert.throws(() => decryptBuffer(encrypted, 'another-password'))
  encrypted[40] ^= 1
  assert.throws(() => decryptBuffer(encrypted, password))

  const directory = await mkdtemp(join(tmpdir(), 'qmusic-cloud-test-'))
  try {
    const source = join(directory, 'source.mp3')
    const remote = join(directory, 'remote.qmc')
    const output = join(directory, 'output.mp3')
    const music = Buffer.alloc(2 * 1024 * 1024, 0xa5)
    await writeFile(source, music)
    await encryptFile(source, remote, password)
    assert.notDeepEqual((await readFile(remote)).subarray(33, 100), music.subarray(0, 67))
    await decryptFile(remote, output, password)
    assert.deepEqual(await readFile(output), music)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('WebDAV 适配器能创建目录、列出并往返传输对象', async() => {
  const objects = new Map<string, Buffer>()
  const folders = new Set<string>()
  let created = 0
  const server = createServer(async(req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
    if (req.method === 'MKCOL') {
      created++
      const existed = folders.has(path)
      folders.add(path)
      res.writeHead(existed ? 405 : 201).end()
    } else if (req.method === 'PUT') {
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(chunk as Buffer)
      objects.set(path, Buffer.concat(chunks))
      res.writeHead(201).end()
    } else if (req.method === 'GET') {
      const body = objects.get(path)
      res.writeHead(body ? 200 : 404).end(body)
    } else if (req.method === 'PROPFIND') {
      if (!folders.has(path)) return res.writeHead(404).end()
      const entries = [...objects.keys()].filter(key => key.startsWith(`${path}/`))
      const xml = `<d:multistatus xmlns:d="DAV:">${entries.map(key => `<d:response><d:href>${encodeURI(key)}</d:href></d:response>`).join('')}</d:multistatus>`
      res.writeHead(207, { 'Content-Type': 'application/xml' }).end(xml)
    } else res.writeHead(405).end()
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const directory = await mkdtemp(join(tmpdir(), 'qmusic-dav-test-'))
  try {
    const audio = join(directory, 'song.mp3')
    const source = join(directory, 'source.qmc')
    const target = join(directory, 'target.qmc')
    const restored = join(directory, 'restored.mp3')
    const body = Buffer.from('cloud import round trip')
    await writeFile(audio, body)
    await encryptFile(audio, source, '中文密码1234')
    const storage = createCloudStorage({ provider: 'webdav', endpoint: `http://127.0.0.1:${address.port}/remote`, region: '', bucket: '', prefix: '', accessKey: 'user', secretKey: 'pass' })
    const key = 'qmusic-cloud/v1/meta/example.qmc'
    assert.deepEqual(await storage.list('qmusic-cloud/v1/meta/'), [])
    assert.equal(created, 0)
    await storage.put(key, source)
    assert.deepEqual(await storage.list('qmusic-cloud/v1/meta/'), [key])
    await storage.get(key, target)
    await decryptFile(target, restored, '中文密码1234')
    assert.deepEqual(await readFile(restored), body)
  } finally {
    server.close()
    await rm(directory, { recursive: true, force: true })
  }
})

test('云服务配置迁移后按服务保留密钥，切换不覆盖其它服务', () => {
  const s3 = { provider: 's3' as const, endpoint: 'https://r2.example', region: 'auto', bucket: 'music', prefix: '', accessKey: 'r2-key', secretKey: 'r2-secret' }
  const dav = { provider: 'webdav' as const, endpoint: 'https://dav.example', region: '', bucket: '', prefix: '', accessKey: 'dav-user', secretKey: 'dav-pass' }
  const migrated = normalizeProfiles(s3)
  const both = withProfile(migrated, dav)
  assert.equal(both.profiles.s3?.secretKey, 'r2-secret')
  assert.equal(both.profiles.webdav?.secretKey, 'dav-pass')
  const updated = withProfile(both, { ...s3, secretKey: '' })
  assert.equal(updated.activeProvider, 's3')
  assert.equal(updated.profiles.s3?.secretKey, 'r2-secret')
  assert.equal(updated.profiles.webdav?.secretKey, 'dav-pass')
  const formerOneDrive = { activeProvider: 'onedrive', profiles: { s3, webdav: dav, onedrive: { provider: 'onedrive' } } }
  assert.equal(normalizeProfiles(formerOneDrive as unknown as Parameters<typeof normalizeProfiles>[0]).activeProvider, 's3')
})

test('免口令与旧版口令加密歌曲使用独立的云端目录', () => {
  const config = { provider: 's3' as const, endpoint: 'https://r2.example', region: 'auto', bucket: 'music', prefix: 'my-music', accessKey: 'key', secretKey: 'secret' }
  assert.equal(objectKey(config, 'meta', 'abc'), 'my-music/qmusic-cloud/v1/meta/abc.qmc')
  assert.equal(objectKey(config, 'meta', 'abc', false), 'my-music/qmusic-cloud/standard/v1/meta/abc.qmc')
  assert.notEqual(objectKey(config, 'audio', 'abc'), objectKey(config, 'audio', 'abc', false))
})

test('S3 适配器能列出并往返传输对象', async() => {
  const objects = new Map<string, Buffer>()
  const server = createServer(async(req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = decodeURIComponent(url.pathname)
    if (req.method === 'PUT') {
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(chunk as Buffer)
      objects.set(path, Buffer.concat(chunks))
      res.writeHead(200, { ETag: '"test"' }).end()
    } else if (req.method === 'GET' && url.searchParams.has('list-type')) {
      const prefix = url.searchParams.get('prefix') ?? ''
      const keys = [...objects.keys()].filter(key => key.startsWith(`/bucket/${prefix}`)).map(key => key.slice('/bucket/'.length))
      const xml = `<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><IsTruncated>false</IsTruncated>${keys.map(key => `<Contents><Key>${key}</Key></Contents>`).join('')}</ListBucketResult>`
      res.writeHead(200, { 'Content-Type': 'application/xml' }).end(xml)
    } else if (req.method === 'GET') {
      const body = objects.get(path)
      res.writeHead(body ? 200 : 404, { 'Content-Type': 'application/octet-stream' }).end(body)
    } else res.writeHead(405).end()
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const directory = await mkdtemp(join(tmpdir(), 'qmusic-s3-test-'))
  try {
    const source = join(directory, 'source.qmc')
    const target = join(directory, 'target.qmc')
    const body = encryptBuffer(Buffer.from('track'), '中文密码1234')
    await writeFile(source, body)
    const storage = createCloudStorage({ provider: 's3', endpoint: `http://127.0.0.1:${address.port}`, region: 'us-east-1', bucket: 'bucket', prefix: '', accessKey: 'user', secretKey: 'pass' })
    const key = 'qmusic-cloud/v1/meta/example.qmc'
    await storage.put(key, source)
    assert.deepEqual(await storage.list('qmusic-cloud/v1/meta/'), [key])
    await storage.get(key, target)
    assert.deepEqual(await readFile(target), body)
    const standardKey = 'qmusic-cloud/standard/v1/meta/example.qmc'
    const metadata = Buffer.from('{"name":"免口令歌曲"}')
    await writeFile(source, metadata)
    await storage.put(standardKey, source)
    assert.deepEqual(await storage.list('qmusic-cloud/standard/v1/meta/'), [standardKey])
    await storage.get(standardKey, target)
    assert.deepEqual(await readFile(target), metadata)
  } finally {
    server.close()
    await rm(directory, { recursive: true, force: true })
  }
})
