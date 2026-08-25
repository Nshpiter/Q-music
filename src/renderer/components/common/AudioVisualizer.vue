<template>
  <div :class="$style.content">
    <canvas ref="dom_canvas" :class="$style.canvas" />
  </div>
</template>

<script>
import { ref, onBeforeUnmount, onMounted } from '@common/utils/vueTools'
import { getAnalyser } from '@renderer/plugins/player'
import { isPlay } from '@renderer/store/player/state'

const FFT_SIZE = 1024
const FRAME_INTERVAL = 1000 / 30
const ENERGY_REST_THRESHOLD = 0.004
const SAMPLE_SIZE = 24
const FALLBACK_COLORS = [
  { r: 99, g: 116, b: 255 },
  { r: 69, g: 195, b: 169 },
  { r: 192, g: 104, b: 235 },
]

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
const rgba = (color, alpha) => `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
const mixColor = (from, to, weight) => ({
  r: Math.round(from.r + (to.r - from.r) * weight),
  g: Math.round(from.g + (to.g - from.g) * weight),
  b: Math.round(from.b + (to.b - from.b) * weight),
})
const parseRgb = color => {
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color)
  return match
    ? { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) }
    : { ...FALLBACK_COLORS[0] }
}
const getLuminance = ({ r, g, b }) => (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255
const getSaturation = ({ r, g, b }) => {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max ? (max - min) / max : 0
}
const getHue = ({ r, g, b }) => {
  const values = [r / 255, g / 255, b / 255]
  const max = Math.max(...values)
  const min = Math.min(...values)
  const delta = max - min
  if (!delta) return 0
  let hue = max == values[0]
    ? ((values[1] - values[2]) / delta) % 6
    : max == values[1]
      ? (values[2] - values[0]) / delta + 2
      : (values[0] - values[1]) / delta + 4
  hue /= 6
  return hue < 0 ? hue + 1 : hue
}

export default {
  setup() {
    const dom_canvas = ref(null)
    const sampleCanvas = document.createElement('canvas')
    const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true })

    sampleCanvas.width = SAMPLE_SIZE
    sampleCanvas.height = SAMPLE_SIZE

    let analyser = getAnalyser()
    let ctx = null
    let dataArray = null
    let width = 0
    let height = 0
    let dpr = 1
    let isPlaying = false
    let animationFrameId = null
    let lastDrawTime = 0
    let frame = 0
    let phase = 0
    let energy = 0
    let bassEnergy = 0
    let midEnergy = 0
    let trebleEnergy = 0
    let coverSource = ''
    let pendingCoverSource = ''
    let albumBox = null
    let themeColor = readThemeColor()
    let palette = createFallbackPalette()

    function readThemeColor() {
      return parseRgb(getComputedStyle(document.documentElement).getPropertyValue('--color-primary') || 'rgb(99, 116, 255)')
    }

    function createFallbackPalette() {
      return FALLBACK_COLORS.map((color, index) => mixColor(themeColor, color, index ? 0.5 : 0.18))
    }

    const polishColor = color => {
      let result = color
      const luminance = getLuminance(color)
      if (luminance < 0.28) result = mixColor(result, { r: 255, g: 255, b: 255 }, 0.24)
      if (luminance > 0.78) result = mixColor(result, themeColor, 0.24)
      if (getSaturation(color) < 0.22) result = mixColor(result, themeColor, 0.34)
      return result
    }

    const ensureAnalyser = () => {
      if (!analyser) analyser = getAnalyser()
      if (!analyser) {
        if (!dataArray) dataArray = new Uint8Array(FFT_SIZE / 2)
        return
      }
      analyser.fftSize = FFT_SIZE
      analyser.smoothingTimeConstant = 0.72
      analyser.minDecibels = -92
      analyser.maxDecibels = -18
      if (dataArray?.length != analyser.frequencyBinCount) dataArray = new Uint8Array(analyser.frequencyBinCount)
    }

    // 专辑色只在封面变化时采样，避免逐帧取色拖累 Linux 图形合成。
    const extractPalette = image => {
      if (!sampleContext || !image.naturalWidth || !image.naturalHeight) return
      try {
        sampleContext.clearRect(0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
        sampleContext.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
        const pixels = sampleContext.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data
        const buckets = Array.from({ length: 12 }, () => ({ r: 0, g: 0, b: 0, weight: 0 }))
        for (let i = 0; i < pixels.length; i += 4) {
          const color = { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] }
          const luminance = getLuminance(color)
          const saturation = getSaturation(color)
          if (pixels[i + 3] < 180 || luminance < 0.07 || luminance > 0.94 || saturation < 0.12) continue
          const weight = 0.35 + saturation * 0.75 + (1 - Math.abs(luminance - 0.52)) * 0.22
          const bucket = buckets[Math.floor(getHue(color) * buckets.length) % buckets.length]
          bucket.r += color.r * weight
          bucket.g += color.g * weight
          bucket.b += color.b * weight
          bucket.weight += weight
        }
        const candidates = buckets
          .map((bucket, index) => ({
            index,
            weight: bucket.weight,
            color: bucket.weight
              ? { r: Math.round(bucket.r / bucket.weight), g: Math.round(bucket.g / bucket.weight), b: Math.round(bucket.b / bucket.weight) }
              : null,
          }))
          .filter(item => item.color)
          .sort((a, b) => b.weight - a.weight)
        const selected = []
        for (const candidate of candidates) {
          const separated = selected.every(item => {
            const distance = Math.abs(candidate.index - item.index)
            return Math.min(distance, buckets.length - distance) >= 2
          })
          if (separated) selected.push(candidate)
          if (selected.length == 3) break
        }
        const fallback = createFallbackPalette()
        palette = fallback.map((color, index) => polishColor(selected[index]?.color ?? color))
      } catch (error) {
        // 第三方封面没有 CORS 许可时回退主题色，不影响播放。
        palette = createFallbackPalette()
      }
    }

    const refreshPalette = () => {
      themeColor = readThemeColor()
      const image = document.querySelector('.q-album-stage img')
      const source = image?.currentSrc || image?.src || ''
      if (!image || !source) {
        coverSource = ''
        palette = createFallbackPalette()
        return
      }
      if (source == coverSource) return
      if (image.complete && image.naturalWidth) {
        coverSource = source
        pendingCoverSource = ''
        extractPalette(image)
      } else if (source != pendingCoverSource) {
        pendingCoverSource = source
        image.addEventListener('load', () => {
          if ((image.currentSrc || image.src) != pendingCoverSource) return
          coverSource = pendingCoverSource
          pendingCoverSource = ''
          extractPalette(image)
          startRender()
        }, { once: true })
      }
    }

    const measureLayout = () => {
      const canvas = dom_canvas.value
      const album = document.querySelector('.q-album-stage')
      if (!canvas || !album) {
        albumBox = null
        return
      }
      const canvasRect = canvas.getBoundingClientRect()
      const albumRect = album.getBoundingClientRect()
      albumBox = {
        x: (albumRect.left - canvasRect.left) * dpr,
        y: (albumRect.top - canvasRect.top) * dpr,
        width: albumRect.width * dpr,
        height: albumRect.height * dpr,
      }
    }

    const sampleBand = (startRatio, endRatio) => {
      if (!dataArray?.length) return 0
      const start = clamp(Math.floor(dataArray.length * startRatio), 1, dataArray.length - 1)
      const end = clamp(Math.ceil(dataArray.length * endRatio), start + 1, dataArray.length)
      let sum = 0
      for (let i = start; i < end; i++) sum += dataArray[i]
      return Math.pow(sum / (end - start) / 255, 0.72)
    }

    const updateEnergy = () => {
      if (isPlaying && analyser && dataArray) analyser.getByteFrequencyData(dataArray)
      let bass = isPlaying ? sampleBand(0.006, 0.055) : 0
      let mid = isPlaying ? sampleBand(0.055, 0.24) : 0
      let treble = isPlaying ? sampleBand(0.24, 0.58) : 0
      // 某些第三方音频链路无法暴露频谱数据时，保留与播放状态同步的呼吸动画，
      // 避免开关已启用但页面完全静止。
      if (isPlaying && bass + mid + treble < 0.018) {
        bass = 0.2 + Math.sin(phase * 1.7) * 0.08
        mid = 0.16 + Math.sin(phase * 2.1 + 1.2) * 0.06
        treble = 0.12 + Math.sin(phase * 2.8 + 2.4) * 0.04
      }
      bassEnergy = bassEnergy * 0.8 + bass * 0.2
      midEnergy = midEnergy * 0.82 + mid * 0.18
      trebleEnergy = trebleEnergy * 0.86 + treble * 0.14
      energy = energy * 0.82 + (bass * 0.48 + mid * 0.34 + treble * 0.18) * 0.18
    }

    const drawGlow = (x, y, radius, color, alpha, stretchX = 1, stretchY = 1) => {
      if (radius <= 0 || alpha <= 0) return
      ctx.save()
      ctx.translate(x, y)
      ctx.scale(stretchX, stretchY)
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
      gradient.addColorStop(0, rgba(color, alpha))
      gradient.addColorStop(0.32, rgba(color, alpha * 0.72))
      gradient.addColorStop(0.7, rgba(color, alpha * 0.2))
      gradient.addColorStop(1, rgba(color, 0))
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    const drawAmbientField = () => {
      const longestSide = Math.max(width, height)
      const activeBoost = isPlaying ? 1 : 0.58
      const baseAlpha = (0.1 + energy * 0.2) * activeBoost
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      drawGlow(width * (0.18 + Math.sin(phase * 0.42) * 0.055), height * (0.28 + Math.cos(phase * 0.31) * 0.07), longestSide * 0.52 * (1 + bassEnergy * 0.28), palette[0], baseAlpha * 1.28, 1.18, 0.86)
      drawGlow(width * (0.78 + Math.cos(phase * 0.34) * 0.07), height * (0.34 + Math.sin(phase * 0.27) * 0.08), longestSide * 0.47 * (1 + midEnergy * 0.22), palette[1], baseAlpha * 1.08, 1.04, 0.92)
      drawGlow(width * (0.56 + Math.sin(phase * 0.25 + 1.8) * 0.1), height * (0.82 + Math.cos(phase * 0.38) * 0.05), longestSide * 0.44 * (1 + trebleEnergy * 0.16), palette[2], baseAlpha, 1.28, 0.68)
      drawGlow(width * (0.53 + Math.cos(phase * 0.2) * 0.08), height * (0.48 + Math.sin(phase * 0.24) * 0.06), longestSide * 0.58, mixColor(palette[0], palette[1], 0.5), baseAlpha * 0.5, 1.38, 0.82)
      if (albumBox) {
        drawGlow(
          albumBox.x + albumBox.width / 2,
          albumBox.y + albumBox.height / 2,
          Math.max(albumBox.width, albumBox.height) * (0.88 + bassEnergy * 0.28),
          palette[0],
          (0.12 + bassEnergy * 0.2) * activeBoost,
          1.08,
          1.08,
        )
      }
      ctx.restore()
    }

    const drawSpectrumRibbon = () => {
      const bandCount = 42
      const centerY = height * 0.58
      const maxAmplitude = Math.min(height * 0.16, width * 0.09)
      const spacing = width / (bandCount - 1)
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.lineCap = 'round'
      for (let index = 0; index < bandCount; index++) {
        const ratio = index / (bandCount - 1)
        const dataIndex = dataArray?.length
          ? clamp(Math.floor(Math.pow(ratio, 1.7) * dataArray.length * 0.58), 0, dataArray.length - 1)
          : 0
        const analyserValue = dataArray?.length ? dataArray[dataIndex] / 255 : 0
        const fallbackValue = 0.22 + Math.sin(phase * 2.2 + index * 0.48) * 0.12
        const value = isPlaying ? Math.max(analyserValue, fallbackValue) : 0.08
        const envelope = Math.sin(Math.PI * ratio)
        const amplitude = (8 * dpr + maxAmplitude * value * envelope) * (0.82 + bassEnergy * 0.34)
        const color = mixColor(palette[0], palette[index % 2 ? 1 : 2], ratio)
        ctx.strokeStyle = rgba(color, 0.12 + value * 0.26)
        ctx.lineWidth = Math.max(1.5 * dpr, spacing * 0.16)
        ctx.beginPath()
        ctx.moveTo(index * spacing, centerY - amplitude)
        ctx.lineTo(index * spacing, centerY + amplitude)
        ctx.stroke()
      }
      ctx.restore()
    }

    const renderFrame = timestamp => {
      animationFrameId = window.requestAnimationFrame(renderFrame)
      if (timestamp - lastDrawTime < FRAME_INTERVAL) return
      lastDrawTime = timestamp
      frame += 1
      phase += isPlaying ? 0.042 : 0.018
      if (frame % 90 == 0) refreshPalette()
      if (frame % 30 == 0) measureLayout()
      ensureAnalyser()
      updateEnergy()
      ctx.clearRect(0, 0, width, height)
      drawAmbientField()
      drawSpectrumRibbon()
      if (!isPlaying && energy < ENERGY_REST_THRESHOLD) {
        window.cancelAnimationFrame(animationFrameId)
        animationFrameId = null
      }
    }

    const startRender = () => {
      if (animationFrameId != null || !ctx) return
      lastDrawTime = 0
      animationFrameId = window.requestAnimationFrame(renderFrame)
    }
    const handlePlay = () => {
      isPlaying = true
      ensureAnalyser()
      startRender()
    }
    const handlePause = () => {
      isPlaying = false
      startRender()
    }
    const resizeCanvas = () => {
      const canvas = dom_canvas.value
      if (!canvas) return
      // 大面积渐变限制到 1.5x DPR，降低集显和 Wayland 的合成负担。
      dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      width = canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr))
      height = canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr))
      measureLayout()
    }
    const handleResize = () => {
      resizeCanvas()
      startRender()
    }

    window.app_event.on('play', handlePlay)
    window.app_event.on('pause', handlePause)
    window.app_event.on('error', handlePause)
    window.addEventListener('resize', handleResize)

    onBeforeUnmount(() => {
      isPlaying = false
      if (animationFrameId != null) window.cancelAnimationFrame(animationFrameId)
      window.app_event.off('play', handlePlay)
      window.app_event.off('pause', handlePause)
      window.app_event.off('error', handlePause)
      window.removeEventListener('resize', handleResize)
    })

    onMounted(() => {
      ctx = dom_canvas.value.getContext('2d', { alpha: true })
      themeColor = readThemeColor()
      palette = createFallbackPalette()
      resizeCanvas()
      ensureAnalyser()
      refreshPalette()
      isPlaying = isPlay.value
      startRender()
    })

    return { dom_canvas }
  },
}
</script>

<style lang="less" module>
.content {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  overflow: hidden;
}
.canvas {
  display: block;
  width: 100%;
  height: 100%;
  opacity: 0.96;
}
</style>
