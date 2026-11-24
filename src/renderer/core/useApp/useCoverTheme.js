import { ref, watch, onMounted } from '@common/utils/vueTools'
import { createThemeColors } from '@common/theme/utils'
import { appSetting } from '@renderer/store/setting'
import { musicInfo } from '@renderer/store/player/state'
import { themeShouldUseDarkColors } from '@renderer/store'

// 用小尺寸采样图生成一次调色板，切换明暗时直接复用两个色阶。
export default function useCoverTheme() {
  const palette = ref(null)
  watch([() => appSetting['theme.coverPalette'], () => musicInfo.pic], async([enabled, cover], _, cleanup) => {
    palette.value = null
    if (!enabled || !cover) return
    const image = new window.Image()
    let stale = false
    cleanup(() => { stale = true })
    try {
      image.src = cover
      await image.decode()
      if (stale) return
      const colors = await import('@material/material-color-utilities')
      if (stale) return
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 40
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      ctx.drawImage(image, 0, 0, 40, 40)
      const bytes = ctx.getImageData(0, 0, 40, 40).data
      const pixels = []
      for (let i = 0; i < bytes.length; i += 4) {
        if (bytes[i + 3] >= 192) pixels.push(colors.argbFromRgb(bytes[i], bytes[i + 1], bytes[i + 2]))
      }
      if (!pixels.length) return
      const [seed] = colors.Score.score(colors.QuantizerCelebi.quantize(pixels, 64))
      const schemes = colors.themeFromSourceColor(seed).schemes
      const rgb = n => 'rgb(' + [colors.redFromArgb(n), colors.greenFromArgb(n), colors.blueFromArgb(n)].join(', ') + ')'
      const tokens = (scheme, dark) => ({
        ...createThemeColors(rgb(scheme.primary), rgb(scheme.onSurface), dark, !dark),
        '--color-content-background': rgb(scheme.surface),
        '--color-app-background': rgb(scheme.surfaceVariant),
        '--color-font': rgb(scheme.onSurface),
        '--color-font-label': rgb(scheme.onSurfaceVariant),
        '--color-nav-font': rgb(scheme.primary),
      })
      palette.value = { light: tokens(schemes.light, false), dark: tokens(schemes.dark, true) }
    } catch { /* 缺失或无法采样的封面沿用用户当前主题。 */ }
  }, { immediate: true })
  onMounted(() => {
    const root = document.getElementById('root')
    watch([palette, themeShouldUseDarkColors], ([colors, dark], _, cleanup) => {
      if (!colors) return
      const tokens = dark ? colors.dark : colors.light
      for (const [key, value] of Object.entries(tokens)) root.style.setProperty(key, value)
      cleanup(() => { for (const key of Object.keys(tokens)) root.style.removeProperty(key) })
    }, { immediate: true })
  })
}
