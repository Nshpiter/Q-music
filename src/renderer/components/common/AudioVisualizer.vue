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
const SMOOTHING_TIME_CONSTANT = 0.82
const WAVE_SAMPLE_COUNT = 32
const ALBUM_REMEASURE_INTERVAL = 20
const ENERGY_REST_THRESHOLD = 0.003
const FALLBACK_PRIMARY = { r: 99, g: 116, b: 255 }
const ACCENT_COLOR = { r: 124, g: 142, b: 255 }

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
const rgba = (color, alpha) => `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
const mixColor = (from, to, weight) => ({
  r: Math.round(from.r + (to.r - from.r) * weight),
  g: Math.round(from.g + (to.g - from.g) * weight),
  b: Math.round(from.b + (to.b - from.b) * weight),
})
const parseRgb = color => {
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color)
  if (!match) return { ...FALLBACK_PRIMARY }
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
  }
}

export default {
  setup() {
    const dom_canvas = ref(null)

    let analyser = getAnalyser()
    let ctx = null
    let dataArray = null
    let barSamples = new Float32Array(WAVE_SAMPLE_COUNT)
    let smoothBarSamples = new Float32Array(WAVE_SAMPLE_COUNT)
    let bufferLength = 0
    let width = 0
    let height = 0
    let dpr = 1
    let isPlaying = false
    let animationFrameId = null
    let frame = 0
    let phase = 0
    let energy = 0
    let bassEnergy = 0
    let themeColor = readThemeColor()
    let accentColor = mixColor(themeColor, ACCENT_COLOR, 0.42)
    let waveBox = {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    }

    function readThemeColor() {
      return parseRgb(getComputedStyle(document.documentElement).getPropertyValue('--color-primary') || 'rgb(99, 116, 255)')
    }

    const allocateAnalyserData = length => {
      bufferLength = length
      dataArray = new Uint8Array(bufferLength)
    }

    const ensureAnalyser = () => {
      if (!analyser) analyser = getAnalyser()
      if (!analyser) {
        if (!bufferLength) allocateAnalyserData(FFT_SIZE / 2)
        return
      }
      analyser.fftSize = FFT_SIZE
      analyser.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT
      if (bufferLength != analyser.frequencyBinCount) allocateAnalyserData(analyser.frequencyBinCount)
    }

    // 以底栏中间控制区为锚点，让声纹稳定出现在播放按钮正上方。
    const measureWaveBox = () => {
      const canvas = dom_canvas.value
      if (!canvas) return
      const canvasRect = canvas.getBoundingClientRect()
      const controlRect = document.querySelector('.q-player-center-control')?.getBoundingClientRect()
      const footerRect = document.querySelector('.q-player-footer')?.getBoundingClientRect()
      if (!controlRect || controlRect.width < 180 || controlRect.height < 36) {
        waveBox = {
          x: width * 0.38,
          y: height * 0.76,
          width: width * 0.24,
          height: Math.max(34 * dpr, height * 0.04),
        }
        return
      }

      const controlCenterX = (controlRect.left - canvasRect.left + controlRect.width / 2) * dpr
      const footerTop = ((footerRect?.top ?? controlRect.top) - canvasRect.top) * dpr
      const controlWidth = controlRect.width * dpr
      const boxWidth = clamp(controlWidth * 0.58, 260 * dpr, Math.min(width * 0.28, 380 * dpr))
      const boxHeight = clamp(controlRect.height * 0.56 * dpr, 34 * dpr, 46 * dpr)
      const safeX = 28 * dpr
      const safeTop = 90 * dpr
      const gap = 10 * dpr

      waveBox = {
        x: clamp(controlCenterX - boxWidth / 2, safeX, Math.max(safeX, width - boxWidth - safeX)),
        y: clamp(footerTop - boxHeight - gap, safeTop, Math.max(safeTop, footerTop - boxHeight - gap)),
        width: boxWidth,
        height: boxHeight,
      }
    }

    const refreshThemeColor = () => {
      themeColor = readThemeColor()
      accentColor = mixColor(themeColor, ACCENT_COLOR, 0.42)
    }

    const updateWaveSamples = () => {
      if (isPlaying && analyser && dataArray) analyser.getByteFrequencyData(dataArray)

      let sum = 0
      let bassSum = 0
      for (let i = 0; i < WAVE_SAMPLE_COUNT; i++) {
        const t = i / (WAVE_SAMPLE_COUNT - 1)
        const index = clamp(Math.round((0.018 + t ** 1.58 * 0.56) * bufferLength), 2, Math.max(2, bufferLength - 3))
        const raw = isPlaying && dataArray
          ? (dataArray[index - 1] + dataArray[index] + dataArray[index + 1]) / 765
          : 0
        const centerWeight = 0.34 + Math.sin(Math.PI * t) * 0.66
        const idleMotion = isPlaying ? (0.016 + Math.sin(phase * 1.2 + i * 0.62) * 0.01) * centerWeight : 0
        const shaped = Math.max(Math.pow(clamp(raw * 2.1, 0, 1), 0.74) * centerWeight, idleMotion)
        barSamples[i] = barSamples[i] * 0.6 + shaped * 0.4
        sum += barSamples[i]
        if (i < WAVE_SAMPLE_COUNT * 0.36) bassSum += barSamples[i]
      }
      for (let i = 0; i < WAVE_SAMPLE_COUNT; i++) {
        const prev = barSamples[Math.max(0, i - 1)]
        const current = barSamples[i]
        const next = barSamples[Math.min(WAVE_SAMPLE_COUNT - 1, i + 1)]
        smoothBarSamples[i] = prev * 0.18 + current * 0.64 + next * 0.18
      }
      barSamples.set(smoothBarSamples)
      energy = energy * 0.8 + sum / WAVE_SAMPLE_COUNT * 0.2
      bassEnergy = bassEnergy * 0.78 + bassSum / (WAVE_SAMPLE_COUNT * 0.36) * 0.22
    }

    const drawRoundedRect = (x, y, rectWidth, rectHeight, radius) => {
      if (ctx.roundRect) {
        ctx.roundRect(x, y, rectWidth, rectHeight, radius)
        return
      }
      const r = Math.min(radius, rectWidth / 2, rectHeight / 2)
      ctx.moveTo(x + r, y)
      ctx.arcTo(x + rectWidth, y, x + rectWidth, y + rectHeight, r)
      ctx.arcTo(x + rectWidth, y + rectHeight, x, y + rectHeight, r)
      ctx.arcTo(x, y + rectHeight, x, y, r)
      ctx.arcTo(x, y, x + rectWidth, y, r)
    }

    const drawBandGlow = () => {
      ctx.save()
      const glow = ctx.createLinearGradient(waveBox.x, 0, waveBox.x + waveBox.width, 0)
      glow.addColorStop(0, rgba(themeColor, 0))
      glow.addColorStop(0.26, rgba(themeColor, 0.05 + energy * 0.06))
      glow.addColorStop(0.5, rgba(accentColor, 0.12 + energy * 0.12))
      glow.addColorStop(0.74, rgba(themeColor, 0.05 + energy * 0.06))
      glow.addColorStop(1, rgba(themeColor, 0))
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.ellipse(
        waveBox.x + waveBox.width * 0.5,
        waveBox.y + waveBox.height * 0.7,
        waveBox.width * 0.48,
        waveBox.height * 0.42,
        0,
        0,
        Math.PI * 2,
      )
      ctx.fill()
      ctx.restore()
    }

    const drawMiniSpectrum = () => {
      const count = WAVE_SAMPLE_COUNT
      const gap = clamp(waveBox.width * 0.007, 2.2 * dpr, 4.2 * dpr)
      const barWidth = clamp((waveBox.width - gap * (count - 1)) / count, 3.2 * dpr, 7 * dpr)
      const totalWidth = barWidth * count + gap * (count - 1)
      const startX = waveBox.x + (waveBox.width - totalWidth) / 2
      const baseline = waveBox.y + waveBox.height * 0.76
      const maxHeight = waveBox.height * (0.66 + bassEnergy * 0.24)

      ctx.save()
      ctx.shadowColor = rgba(accentColor, 0.16 + energy * 0.18)
      ctx.shadowBlur = 7 * dpr

      for (let i = 0; i < count; i++) {
        const t = i / (count - 1)
        const value = barSamples[i]
        const edgeFade = Math.sin(Math.PI * t)
        const pulse = 0.88 + Math.sin(phase * 1.7 + i * 0.42) * 0.12
        const barHeight = (4.5 * dpr + value * maxHeight * pulse) * edgeFade
        const x = startX + i * (barWidth + gap)
        const y = baseline - barHeight
        const color = mixColor(themeColor, accentColor, 0.38 + edgeFade * 0.3)
        const gradient = ctx.createLinearGradient(0, y, 0, baseline)
        gradient.addColorStop(0, rgba(color, 0.56 + value * 0.24))
        gradient.addColorStop(0.62, rgba(color, 0.34 + value * 0.16))
        gradient.addColorStop(1, rgba(color, 0.1))

        ctx.fillStyle = gradient
        ctx.beginPath()
        drawRoundedRect(x, y, barWidth, Math.max(2 * dpr, barHeight), barWidth / 2)
        ctx.fill()
      }
      ctx.restore()
    }

    const renderFrame = () => {
      frame += 1
      phase += 0.035
      if (frame % 48 == 0) refreshThemeColor()
      if (frame % ALBUM_REMEASURE_INTERVAL == 0) measureWaveBox()
      ensureAnalyser()
      updateWaveSamples()

      ctx.clearRect(0, 0, width, height)
      drawBandGlow()
      drawMiniSpectrum()

      if (!isPlaying && energy < ENERGY_REST_THRESHOLD) {
        animationFrameId = null
        return
      }
      animationFrameId = window.requestAnimationFrame(renderFrame)
    }

    const startRender = () => {
      if (animationFrameId != null || !ctx) return
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
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr))
      height = canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr))
      measureWaveBox()
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
      if (animationFrameId != null) {
        window.cancelAnimationFrame(animationFrameId)
        animationFrameId = null
      }
      window.app_event.off('play', handlePlay)
      window.app_event.off('pause', handlePause)
      window.app_event.off('error', handlePause)
      window.removeEventListener('resize', handleResize)
    })

    onMounted(() => {
      const canvas = dom_canvas.value
      ctx = canvas.getContext('2d')
      refreshThemeColor()
      resizeCanvas()
      ensureAnalyser()
      isPlaying = isPlay.value
      startRender()
    })

    return {
      dom_canvas,
    }
  },
}
</script>

<style lang="less" module>
.content {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 3;
}
.canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
