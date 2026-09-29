import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { open, stat } from 'node:fs/promises'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const MAGIC = Buffer.from('QMCE')
const HEADER_SIZE = 33
const KDF_ROUNDS = 250_000

const deriveKey = (password: string, salt: Buffer) => {
  if (password.length < 8) throw new Error('加密口令至少需要 8 个字符')
  return pbkdf2Sync(password, salt, KDF_ROUNDS, 32, 'sha256')
}

export const encryptBuffer = (value: Buffer, password: string) => {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(password, salt), iv)
  return Buffer.concat([MAGIC, Buffer.from([1]), salt, iv, cipher.update(value), cipher.final(), cipher.getAuthTag()])
}

export const decryptBuffer = (value: Buffer, password: string) => {
  if (value.length < HEADER_SIZE + 16 || !value.subarray(0, 4).equals(MAGIC) || value[4] !== 1) throw new Error('云端文件格式不兼容')
  const cipher = createDecipheriv('aes-256-gcm', deriveKey(password, value.subarray(5, 21)), value.subarray(21, 33))
  cipher.setAuthTag(value.subarray(-16))
  return Buffer.concat([cipher.update(value.subarray(HEADER_SIZE, -16)), cipher.final()])
}

export const encryptFile = async(source: string, target: string, password: string) => {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(password, salt), iv)
  const output = createWriteStream(target)
  output.write(Buffer.concat([MAGIC, Buffer.from([1]), salt, iv]))
  await pipeline(createReadStream(source), cipher, new Transform({
    transform(chunk, _, callback) { callback(null, chunk) },
    flush(callback) { this.push(cipher.getAuthTag()); callback() },
  }), output)
}

export const decryptFile = async(source: string, target: string, password: string) => {
  const length = (await stat(source)).size
  if (length < HEADER_SIZE + 16) throw new Error('云端歌曲文件不完整')
  const input = await open(source, 'r')
  const header = Buffer.alloc(HEADER_SIZE)
  const tag = Buffer.alloc(16)
  try {
    await input.read(header, 0, HEADER_SIZE, 0)
    await input.read(tag, 0, 16, length - 16)
  } finally { await input.close() }
  if (!header.subarray(0, 4).equals(MAGIC) || header[4] !== 1) throw new Error('云端文件格式不兼容')
  const cipher = createDecipheriv('aes-256-gcm', deriveKey(password, header.subarray(5, 21)), header.subarray(21, 33))
  cipher.setAuthTag(tag)
  await pipeline(createReadStream(source, { start: HEADER_SIZE, end: length - 17 }), cipher, createWriteStream(target))
}
