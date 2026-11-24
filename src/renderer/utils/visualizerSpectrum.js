// IEC 61672 A 计权的幅频曲线。将修正量转换到 AnalyserNode 的 dB 区间。
export const aWeightingDb = hz => {
  if (hz <= 0) return -100
  const f2 = hz * hz
  const numerator = 12194 ** 2 * f2 * f2
  const denominator = (f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2)
  return 2 + 20 * Math.log10(numerator / denominator)
}

export function createSpectrum(source, resolution, weighted, response, baseSize, smoothing = 0) {
  const sigma = Math.max(0, Math.min(8, Number(smoothing) || 0))
  const radius = Math.ceil(3 * sigma)
  const kernel = radius ? Float32Array.from({ length: radius * 2 + 1 }, (_, i) => Math.exp(-0.5 * ((i - radius) / sigma) ** 2)) : null
  const sizes = resolution === 'multi' ? [4096, 2048, 512] : [resolution === '2048' ? 2048 : baseSize]
  const bands = sizes.map(size => {
    const analyser = source.context.createAnalyser()
    analyser.fftSize = size
    analyser.minDecibels = -92
    analyser.maxDecibels = -18
    analyser.smoothingTimeConstant = response === 'fast' ? 0.35 : response === 'slow' ? 0.9 : 0.72
    source.connect(analyser)
    const bytes = new Uint8Array(analyser.frequencyBinCount)
    const weights = weighted ? Float32Array.from(bytes, (_, i) => aWeightingDb(i * source.context.sampleRate / size) * 255 / 74) : null
    return { analyser, bytes, weights, scratch: kernel ? new Uint8Array(bytes.length) : null }
  })
  return {
    update() {
      for (const { analyser, bytes, weights, scratch } of bands) {
        analyser.getByteFrequencyData(bytes)
        if (weights) {
          for (let i = 0; i < bytes.length; i++) bytes[i] = Math.max(0, Math.min(255, bytes[i] + weights[i]))
        }
        if (kernel) {
          scratch.set(bytes)
          for (let i = 0; i < bytes.length; i++) {
            let energy = 0
            let weight = 0
            for (let j = Math.max(0, i - radius); j <= Math.min(bytes.length - 1, i + radius); j++) {
              const k = kernel[j - i + radius]
              energy += k * scratch[j]
              weight += k
            }
            bytes[i] = Math.round(energy / weight)
          }
        }
      }
    },
    sample(from, to) {
      const hz = (from + to) * source.context.sampleRate / 4
      const { bytes } = bands.length === 1 ? bands[0] : hz < 500 ? bands[0] : hz < 3200 ? bands[1] : bands[2]
      const start = Math.max(1, Math.min(bytes.length - 1, Math.floor(bytes.length * from)))
      const end = Math.min(bytes.length, Math.max(start + 1, Math.ceil(bytes.length * to)))
      let sum = 0
      for (let i = start; i < end; i++) sum += bytes[i]
      return Math.pow(sum / ((end - start) * 255), 0.72)
    },
    close() {
      for (const { analyser } of bands) source.disconnect(analyser)
    },
  }
}
