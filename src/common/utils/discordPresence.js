import { createConnection } from 'node:net'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const frame = (opcode, value) => {
  const body = Buffer.from(JSON.stringify(value))
  const header = Buffer.alloc(8)
  header.writeUInt32LE(opcode, 0)
  header.writeUInt32LE(body.length, 4)
  return Buffer.concat([header, body])
}

// Discord 桌面客户端的本机 RPC。READY 后才发布，管道断开后重新握手。
export function discordPresence(clientId, stateChanged, connect = createConnection) {
  const directory = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || tmpdir()
  let socket, retry, publishTimer, handshakeTimer
  let buffer = Buffer.alloc(0)
  let closed = false
  let ready = false
  let activity = null
  let nonce = 0
  let lastPublish = 0
  let lastActivity
  function publish() {
    if (!ready || closed) return
    const serialized = JSON.stringify(activity)
    if (serialized === lastActivity) return
    clearTimeout(publishTimer)
    const remaining = 5000 - (Date.now() - lastPublish)
    if (remaining > 0) {
      publishTimer = setTimeout(publish, remaining)
      return
    }
    lastPublish = Date.now()
    lastActivity = serialized
    socket.write(frame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity }, nonce: String(++nonce) }))
  }
  function open(index) {
    if (closed) return
    const name = 'discord-ipc-' + index
    const endpoint = process.platform === 'win32' ? '\\\\?\\pipe\\' + name : join(directory, name)
    const conn = socket = connect(endpoint)
    buffer = Buffer.alloc(0)
    const reconnect = () => {
      clearTimeout(handshakeTimer)
      clearTimeout(publishTimer)
      const next = ready ? 0 : index + 1
      ready = false
      if (closed) return
      stateChanged('receiver_retry')
      retry = setTimeout(() => { open(next % 10) }, next > 0 && next < 10 ? 25 : 10000)
    }
    conn.once('connect', () => {
      conn.write(frame(0, { v: 1, client_id: clientId }))
      handshakeTimer = setTimeout(() => { conn.destroy() }, 5500)
    })
    conn.on('error', () => { conn.destroy() })
    conn.once('close', reconnect)
    conn.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk])
      while (buffer.length >= 8) {
        const opcode = buffer.readUInt32LE()
        const size = buffer.readUInt32LE(4)
        if (size > 1024 * 1024) { conn.destroy(); return }
        if (buffer.length < size + 8) return
        let message
        try { message = JSON.parse(buffer.toString('utf8', 8, size + 8)) } catch { conn.destroy(); return }
        buffer = buffer.subarray(size + 8)
        if (opcode === 2) { conn.destroy(); return }
        if (opcode === 3) conn.write(frame(4, message))
        if (opcode !== 1) continue
        if (message.evt === 'READY') {
          clearTimeout(handshakeTimer)
          ready = true
          lastActivity = undefined
          lastPublish = 0
          stateChanged('receiver_connected')
          publish()
        } else if (message.evt === 'ERROR') stateChanged('discord_rejected')
      }
    })
  }
  stateChanged('receiver_connecting')
  open(0)
  return {
    set(value) { activity = value; publish() },
    close() {
      closed = true
      clearTimeout(publishTimer)
      clearTimeout(handshakeTimer)
      clearTimeout(retry)
      if (ready && !socket.destroyed) socket.end(frame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: null }, nonce: String(++nonce) }))
      else socket?.destroy()
    },
  }
}
