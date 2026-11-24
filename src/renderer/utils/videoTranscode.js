import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export async function transcodeBackdrop(file, signal) {
  signal.throwIfAborted()
  if (!path.isAbsolute(file) || !/\.(?:mp4|m4v|mkv|mov|avi|wmv|webm|ogv)$/i.test(file)) throw Error('video_format')
  const info = await stat(file)
  if (!info.isFile()) throw Error('video_format')
  const key = createHash('sha256').update(JSON.stringify([file, info.size, info.mtimeMs])).digest('hex')
  const directory = path.join(tmpdir(), 'q-music-video-background')
  const target = path.join(directory, key + '.mp4')
  const cached = await stat(target).catch(() => null)
  signal.throwIfAborted()
  if (cached?.size) return pathToFileURL(target).href
  await mkdir(directory, { recursive: true })
  signal.throwIfAborted()
  const partial = path.join(directory, key + '.' + randomUUID() + '.mp4')
  try {
    await new Promise((resolve, reject) => {
      const args = ['-nostdin', '-loglevel', 'error', '-protocol_whitelist', 'file', '-i', file, '-map', '0:v:0', '-map', '0:a:0?', '-vf', 'scale=w=max(2\\,trunc(min(1280\\,iw)/2)*2):h=-2', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', partial]
      const child = spawn('ffmpeg', args, { windowsHide: true, shell: false, stdio: 'ignore' })
      const abort = () => child.kill()
      signal.addEventListener('abort', abort, { once: true })
      child.once('error', reject)
      child.once('close', code => {
        signal.removeEventListener('abort', abort)
        if (code === 0 && !signal.aborted) resolve()
        else reject(Error(signal.aborted ? 'video_cancelled' : 'video_convert_failed'))
      })
    })
    signal.throwIfAborted()
    await rename(partial, target)
    return pathToFileURL(target).href
  } finally {
    await rm(partial, { force: true }).catch(() => {})
  }
}
