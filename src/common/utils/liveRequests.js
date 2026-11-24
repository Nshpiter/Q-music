import { inflateSync, brotliDecompressSync } from 'node:zlib'

const cap = 4 * 1024 * 1024
export const livePacket = (operation, data = '') => {
  const payload = Buffer.from(data && JSON.stringify(data))
  const head = Buffer.alloc(16)
  head.writeUInt32BE(payload.length + 16, 0)
  head.writeUInt16BE(16, 4)
  head.writeUInt16BE(1, 6)
  head.writeUInt32BE(operation, 8)
  head.writeUInt32BE(1, 12)
  return Buffer.concat([head, payload])
}

// 先核对鉴权结果，再接受心跳与弹幕。压缩包和内层消息均受长度限制。
export function readLivePackets(bytes, visit, depth = 0) {
  if (bytes.length > cap || depth > 1) throw Error('live_packet_size')
  for (let i = 0; i < bytes.length;) {
    if (bytes.length - i < 16) throw Error('live_packet_header')
    const size = bytes.readUInt32BE(i)
    const header = bytes.readUInt16BE(i + 4)
    const version = bytes.readUInt16BE(i + 6)
    const operation = bytes.readUInt32BE(i + 8)
    if (header < 16 || size < header || size > bytes.length - i) throw Error('live_packet_size')
    const body = bytes.subarray(i + header, i + size)
    i += size
    if (version === 2 || version === 3) {
      const decompress = version === 2 ? inflateSync : brotliDecompressSync
      readLivePackets(decompress(body, { maxOutputLength: cap }), visit, depth + 1)
    } else if (operation === 5 || operation === 8) visit(operation, JSON.parse(body.toString('utf8')))
    else if (operation === 3) visit(operation)
  }
}

export function createRequestQueue(search, accept, failure, available, signal) {
  const pending = []
  const consume = async() => {
    while (!signal.aborted && pending.length) {
      const keyword = pending[0]
      try {
        const hit = await search(keyword)
        if (!signal.aborted) accept(hit, keyword)
      } catch {
        if (!signal.aborted) failure(keyword)
      }
      pending.shift()
    }
  }
  return (message) => {
    if (signal.aborted || typeof message !== 'string') return
    const keyword = /^(?:点歌\s*|(?:play|pl)\s+)(.{1,80})$/iu.exec(message.trim())?.[1].trim()
    if (!keyword || pending.length >= available() || pending.includes(keyword)) return
    pending.push(keyword)
    if (pending.length === 1) consume()
  }
}
