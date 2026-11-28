import { isNightTime } from './schedule'
import { createThemeColors } from './utils'

export type ThemeAppearance = 'light' | 'dark' | 'system' | 'time'
type Settings = Partial<LX.AppSetting>

// 旧设置只在未选择独立外观模式时生效，升级不会改写用户原来的主题文件。
export const getThemeAppearance = (setting: Settings, baseDark = false): ThemeAppearance => {
  if (setting['theme.appearance']) return setting['theme.appearance']
  if (setting['theme.autoByTime']) return 'time'
  if (setting['theme.id'] == 'auto') return 'system'
  return baseDark ? 'dark' : 'light'
}

export const getBaseThemeId = (setting: Settings): string => setting['theme.id'] == 'auto'
  ? setting['theme.lightId'] ?? 'green'
  : setting['theme.id'] ?? 'green'

export const isDarkAppearance = (mode: ThemeAppearance, systemDark: boolean, date = new Date(), setting: Settings = {}) => mode == 'dark' || (mode == 'system' && systemDark) || (mode == 'time' && isNightTime(date, setting))

const parseRgb = (color: string): number[] => {
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color)?.[1]
  if (hex) {
    const full = hex.length == 3 ? hex.split('').map(char => char + char).join('') : hex
    return [0, 2, 4].map(index => parseInt(full.slice(index, index + 2), 16))
  }
  const parts = /^rgba?\(([^)]+)\)$/i.exec(color)?.[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3).map(value => value.endsWith('%') ? parseFloat(value) * 2.55 : Number(value))
  return parts?.length == 3 && parts.every(Number.isFinite) ? parts.map(value => Math.max(0, Math.min(255, value))) : [31, 107, 82]
}
const rgb = (channels: number[]) => `rgb(${channels.map(Math.round).join(', ')})`
const blend = (a: number[], b: number[], ratio: number) => a.map((value, index) => value * (1 - ratio) + b[index] * ratio)
const luminance = (channels: number[]) => channels.map(value => {
  const channel = value / 255
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)

export const adaptThemeAppearance = (theme: LX.Theme, dark: boolean): LX.Theme => {
  if (theme.isDark == dark) return theme
  const original = parseRgb(theme.config.themeColors['--color-primary'])
  const surface = dark ? blend([18, 20, 22], original, 0.025) : [255, 255, 255]
  let accent = original
  // 保留色相，深色模式下只提高不足的亮度，避免水墨等深色强调色消失。
  if (dark) {
    for (let i = 0; i < 20 && (luminance(accent) + 0.05) / (luminance(surface) + 0.05) < 4.8; i++) accent = blend(accent, [255, 255, 255], 0.1)
  }
  const colors = createThemeColors(rgb(accent), undefined, dark, false) as LX.ThemeColors
  if (dark) {
    for (let level = 600; level <= 1000; level += 100) {
      const color = blend(surface, accent, (1000 - level) / 12000)
      const key = `--color-primary-light-${level}` as keyof LX.ThemeColors
      colors[key] = rgb(color)
      for (let alpha = 100; alpha <= 900; alpha += 100) colors[`${key}-alpha-${alpha}` as keyof LX.ThemeColors] = `rgba(${color.map(Math.round).join(', ')}, ${1 - alpha / 1000})`
    }
  }
  return {
    ...theme,
    isDark: dark,
    isDarkFont: false,
    config: {
      themeColors: colors,
      extInfo: {
        ...theme.config.extInfo,
        '--color-app-background': dark ? 'rgba(13, 15, 17, 0.94)' : '#F4F2ED',
        '--color-main-background': `rgba(${surface.map(Math.round).join(', ')}, ${dark ? '0.92' : '0.90'})`,
        '--color-nav-font': 'var(--color-font)',
      },
    },
  }
}
