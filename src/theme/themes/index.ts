/* eslint-disable @typescript-eslint/no-var-requires */
import { getUserTheme, saveUserTheme } from '@/utils/data'
import themes from '@/theme/themes/themes'
import settingState from '@/store/setting/state'
import themeState from '@/store/theme/state'
import { isUrl } from '@/utils'
import { privateStorageDirectoryPath } from '@/utils/fs'
import { type ImageSourcePropType } from 'react-native'

export const BG_IMAGES = {
  'china_ink.jpg': require('./images/china_ink.jpg') as ImageSourcePropType,
  'jqbg.jpg': require('./images/jqbg.jpg') as ImageSourcePropType,
  'landingMoon.png': require('./images/landingMoon2.png') as ImageSourcePropType,
  'myzcbg.jpg': require('./images/myzcbg.jpg') as ImageSourcePropType,
  'xnkl.png': require('./images/xnkl.png') as ImageSourcePropType,
} as const


let userThemes: LX.Theme[]
export const getAllThemes = async() => {
  // eslint-disable-next-line require-atomic-updates
  userThemes ??= await getUserTheme()
  return {
    themes,
    userThemes,
    dataPath: privateStorageDirectoryPath + '/theme_images',
  }
}

export const saveTheme = async(theme: LX.Theme) => {
  const targetTheme = userThemes.find(t => t.id === theme.id)
  if (targetTheme) Object.assign(targetTheme, theme)
  else userThemes.push(theme)
  await saveUserTheme(userThemes)
}

export const removeTheme = async(id: string) => {
  const index = userThemes.findIndex(t => t.id === id)
  if (index < 0) return
  userThemes.splice(index, 1)
  await saveUserTheme(userThemes)
}

export type LocalTheme = typeof themes[number]
type ColorsKey = keyof LX.Theme['config']['themeColors']
type ExtInfoKey = keyof LX.Theme['config']['extInfo']
const varColorRxp = /^var\((.+)\)$/

const parseColor = (color: string): [number, number, number] | null => {
  const hex = color.match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1]
  if (hex) {
    const value = hex.length == 3
      ? hex.split('').map(char => char + char).join('')
      : hex
    return [
      Number.parseInt(value.slice(0, 2), 16),
      Number.parseInt(value.slice(2, 4), 16),
      Number.parseInt(value.slice(4, 6), 16),
    ]
  }

  const values = color.match(/[\d.]+/g)
  if (!values || values.length < 3) return null
  return values.slice(0, 3).map(Number) as [number, number, number]
}

const getContrastText = (background: string) => {
  const rgb = parseColor(background)
  if (!rgb) return '#ffffff'

  const [r, g, b] = rgb.map(value => {
    const channel = value / 255
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const blackContrast = (luminance + 0.05) / 0.05
  const whiteContrast = 1.05 / (luminance + 0.05)
  return blackContrast >= whiteContrast ? '#212121' : '#ffffff'
}

export const buildActiveThemeColors = (theme: LX.Theme): LX.ActiveTheme => {
  let bgImg: ImageSourcePropType | undefined
  const extInfo = { ...theme.config.extInfo }
  const shouldShowBackground = !theme.isDark || !settingState.setting['theme.hideBgDark']

  if (theme.isCustom) {
    const image = extInfo['bg-image']
    if (image && shouldShowBackground) {
      bgImg = {
        uri: isUrl(image)
          ? image
          : `${privateStorageDirectoryPath}/theme_images/${image}`,
      }
    }
  } else {
    const localExtInfo = (theme as LocalTheme).config.extInfo
    if (localExtInfo['bg-image'] && shouldShowBackground) {
      bgImg = BG_IMAGES[localExtInfo['bg-image']]
    }
  }

  for (const [k, v] of Object.entries(extInfo) as Array<[ExtInfoKey, LX.Theme['config']['extInfo'][ExtInfoKey]]>) {
    if (!v.startsWith('var(')) continue
    extInfo[k] = theme.config.themeColors[v.replace(varColorRxp, '$1') as ColorsKey]
  }

  const colors = theme.config.themeColors
  const accent = colors['c-primary']
  const accentText = theme.isDark ? colors['c-primary'] : colors['c-primary-dark-500']
  const textPrimary = colors['c-850']
  const textSecondary = colors['c-650']
  const outline = theme.isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(40, 50, 66, 0.14)'

  return {
    id: theme.id,
    name: theme.name,
    isDark: theme.isDark,
    ...colors,
    ...extInfo,
    'c-font': textPrimary,
    'c-font-label': textSecondary,
    'c-primary-font': accentText,
    'c-primary-font-hover': accentText,
    'c-primary-font-active': accentText,
    'c-primary-background': colors['c-primary-alpha-900'],
    'c-primary-background-hover': colors['c-primary-alpha-800'],
    'c-primary-background-active': colors['c-primary-alpha-700'],
    'c-primary-input-background': colors['c-primary-alpha-900'],
    'c-button-font': accentText,
    'c-button-font-selected': accentText,
    'c-button-background': colors['c-primary-alpha-800'],
    'c-button-background-selected': colors['c-primary-alpha-700'],
    'c-button-background-hover': colors['c-primary-alpha-800'],
    'c-button-background-active': colors['c-primary-alpha-700'],
    'c-list-header-border-bottom': outline,
    'c-content-background': colors['c-primary-light-1000'],
    'c-border-background': outline,
    'q-surface-base': theme.isDark
      ? colors['c-primary-light-1000-alpha-300']
      : colors['c-primary-light-1000-alpha-500'],
    'q-surface-raised': theme.isDark
      ? colors['c-primary-light-1000-alpha-100']
      : colors['c-primary-light-1000-alpha-200'],
    'q-surface-tint': colors['c-primary-alpha-800'],
    'q-text-primary': textPrimary,
    'q-text-secondary': textSecondary,
    'q-accent': accent,
    'q-accent-text': accentText,
    'q-on-accent': getContrastText(accent),
    'q-outline': outline,
    'q-scrim': theme.isDark ? 'rgba(0, 0, 0, 0.64)' : 'rgba(40, 50, 66, 0.32)',
    'bg-image': bgImg,
  } as const
}


// const copyTheme = (theme: LX.Theme): LX.Theme => {
//   return {
//     ...theme,
//     config: {
//       ...theme.config,
//       extInfo: { ...theme.config.extInfo },
//       themeColors: { ...theme.config.themeColors },
//     },
//   }
// }
// type IDS = LocalTheme['id']
export const getTheme = async() => {
  // fs.promises.readdir()
  const shouldUseDarkColors = themeState.shouldUseDarkColors
  // let themeId = settingState.setting['theme.id'] == 'auto'
  //   ? shouldUseDarkColors
  //     ? settingState.setting['theme.darkId']
  //     : settingState.setting['theme.lightId']
  //   // : 'china_ink'
  //   : settingState.setting['theme.id']
  let themeId = settingState.setting['common.isAutoTheme'] && shouldUseDarkColors
    ? 'black'
    : settingState.setting['theme.id']
  // themeId = 'naruto'
  // themeId = 'pink'
  // themeId = 'black'
  let theme: LocalTheme | LX.Theme | undefined = themes.find(theme => theme.id == themeId)
  if (!theme) {
    userThemes = await getUserTheme()
    theme = userThemes.find(theme => theme.id == themeId)
    if (!theme) {
      themeId = settingState.setting['theme.id'] == 'auto' && shouldUseDarkColors ? 'black' : 'green'
      theme = themes.find(theme => theme.id == themeId) as LX.Theme
    }
  }

  return theme
}
