import { getAnalyser } from './index'

let workletReady
export async function attachAmllAudio(version, socket, signal) {
  const source = getAnalyser()
  if (!source || signal.aborted) return
  const context = source.context
  workletReady ??= context.audioWorklet.addModule(new URL('./amll-pcm.worklet.js', import.meta.url)).catch(error => {
    workletReady = undefined
    throw error
  })
  await workletReady
  if (signal.aborted) return
  const tap = new window.AudioWorkletNode(context, 'q-music-amll-pcm', { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 2, channelCountMode: 'explicit' })
  tap.port.onmessage = ({ data }) => {
    if (signal.aborted || socket.readyState !== window.WebSocket.OPEN || socket.bufferedAmount > 64000) return
    const packet = new Uint8Array(6 + data.byteLength)
    const view = new DataView(packet.buffer)
    view.setUint16(0, version === 'v1' ? 9 : 0, true)
    view.setUint32(2, data.byteLength, true)
    packet.set(new Uint8Array(data), 6)
    socket.send(packet)
  }
  source.connect(tap)
  signal.addEventListener('abort', () => {
    source.disconnect(tap)
    tap.port.postMessage('stop')
    tap.port.onmessage = null
    tap.port.close()
  }, { once: true })
}
