/* global AudioWorkletProcessor, registerProcessor, sampleRate */
// AMLL 音频包统一为 48 kHz、双声道、有符号小端 16 位。跨渲染块保留采样相位。
class AmllPcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.active = true
    this.phase = 0
    this.offset = 0
    this.buffer = new Int16Array(1920)
    this.previousLeft = 0
    this.previousRight = 0
    this.port.onmessage = () => { this.active = false }
  }

  process(inputs) {
    const [left, right = left] = inputs[0]
    if (!this.active || !left?.length) return this.active
    for (let i = 0; i < left.length; i++) {
      for (; this.phase < 48000; this.phase += sampleRate) {
        const mix = this.phase / 48000
        const l = this.previousLeft + (left[i] - this.previousLeft) * mix
        const r = this.previousRight + (right[i] - this.previousRight) * mix
        this.buffer[this.offset++] = Math.round(Math.max(-1, Math.min(1, l)) * (l < 0 ? 32768 : 32767))
        this.buffer[this.offset++] = Math.round(Math.max(-1, Math.min(1, r)) * (r < 0 ? 32768 : 32767))
        if (this.offset === this.buffer.length) {
          this.port.postMessage(this.buffer.buffer, [this.buffer.buffer])
          this.buffer = new Int16Array(1920)
          this.offset = 0
        }
      }
      this.phase -= 48000
      this.previousLeft = left[i]
      this.previousRight = right[i]
    }
    return true
  }
}

registerProcessor('q-music-amll-pcm', AmllPcmProcessor)
