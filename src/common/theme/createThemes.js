//! 更新默认主题配置后，需要执行 npm run build:theme 重新构建index.json

const fs = require('fs')
const path = require('path')
const { createThemeColors } = require('./utils')

const defaultThemes = [
  {
    id: 'green',
    name: '松烟暖白',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(31, 107, 82)',
      font: 'rgb(28, 30, 32)',
      '--color-app-background': '#F4F2ED',
      '--color-main-background': 'rgba(255, 255, 255, 0.90)',
      '--color-nav-font': 'var(--color-font)',
      '--background-image': 'none',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#2ec4b6',
      '--color-btn-min': '#7ac74f',
      '--color-btn-close': '#f28482',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#4b5563',
      '--color-badge-tertiary': '#b45309',
    },
  },
  {
    id: 'blue',
    name: '海盐蔚蓝',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(37, 137, 229)',
      font: 'rgb(22, 29, 38)',
      '--color-app-background': 'var(--color-primary-light-800-alpha-400)',
      '--color-main-background': 'rgba(248, 251, 255, 0.78)',
      '--color-nav-font': 'var(--color-primary-dark-200)',
      '--background-image': 'none',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#2ec4b6',
      '--color-btn-min': '#7ac74f',
      '--color-btn-close': '#f28482',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#14b8a6',
      '--color-badge-tertiary': '#e59224',
    },
  },
  {
    id: 'blue_plus',
    name: '群青夜雾',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(59, 108, 168)',
      font: 'rgb(22, 27, 36)',
      '--color-app-background': 'var(--color-primary-light-700-alpha-400)',
      '--color-main-background': 'rgba(247, 250, 254, 0.78)',
      '--color-nav-font': 'var(--color-primary-dark-100)',
      '--background-image': 'none',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#2ec4b6',
      '--color-btn-min': '#7ac74f',
      '--color-btn-close': '#f28482',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#0284c7',
      '--color-badge-tertiary': '#2aa89b',
    },
  },
  {
    id: 'orange',
    name: '暖白陶土',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(198, 93, 52)',
      font: 'rgb(28, 30, 32)',
      '--color-app-background': '#F4F2ED',
      '--color-main-background': 'rgba(255, 255, 255, 0.90)',
      '--color-nav-font': 'var(--color-font)',
      '--background-image': 'none',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#2ec4b6',
      '--color-btn-min': '#7ac74f',
      '--color-btn-close': '#f28482',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#4b5563',
      '--color-badge-tertiary': '#b45309',
    },
  },
  {
    id: 'red',
    name: '丹霞绯红',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(217, 56, 72)',
      font: 'rgb(34, 24, 26)',
      '--color-app-background': 'var(--color-primary-light-800-alpha-400)',
      '--color-main-background': 'rgba(255, 249, 250, 0.78)',
      '--color-nav-font': 'var(--color-primary-dark-200)',
      '--background-image': 'none',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#2ec4b6',
      '--color-btn-min': '#7ac74f',
      '--color-btn-close': '#f28482',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#d99126',
      '--color-badge-tertiary': '#e07a5f',
    },
  },
  {
    id: 'pink',
    name: '云樱蔷薇',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(225, 92, 126)',
      font: 'rgb(34, 24, 29)',
      '--color-app-background': 'var(--color-primary-light-800-alpha-400)',
      '--color-main-background': 'rgba(255, 249, 251, 0.78)',
      '--color-nav-font': 'var(--color-primary-dark-200)',
      '--background-image': 'none',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#2ec4b6',
      '--color-btn-min': '#7ac74f',
      '--color-btn-close': '#f28482',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#ea8c55',
      '--color-badge-tertiary': '#c06c84',
    },
  },
  {
    id: 'purple',
    name: '暮霭紫晶',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(138, 86, 208)',
      font: 'rgb(28, 24, 36)',
      '--color-app-background': 'var(--color-primary-light-800-alpha-400)',
      '--color-main-background': 'rgba(251, 249, 255, 0.78)',
      '--color-nav-font': 'var(--color-primary-dark-200)',
      '--background-image': 'none',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#2ec4b6',
      '--color-btn-min': '#7ac74f',
      '--color-btn-close': '#f28482',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#ec6f8c',
      '--color-badge-tertiary': '#6366f1',
    },
  },
  {
    id: 'grey',
    name: '北欧冷灰',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(88, 108, 128)',
      font: 'rgb(24, 29, 36)',
      '--color-app-background': 'var(--color-primary-light-800-alpha-400)',
      '--color-main-background': 'rgba(248, 250, 252, 0.78)',
      '--color-nav-font': 'var(--color-primary-dark-200)',
      '--background-image': 'none',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#2ec4b6',
      '--color-btn-min': '#7ac74f',
      '--color-btn-close': '#f28482',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#0ea5e9',
      '--color-badge-tertiary': '#8b7e8d',
    },
  },
  {
    id: 'ming',
    name: '青出于黑',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(29, 116, 130)',
      font: 'rgb(21, 31, 34)',
      '--color-app-background': 'var(--color-primary-light-800-alpha-400)',
      '--color-main-background': 'rgba(247, 251, 252, 0.78)',
      '--color-nav-font': 'var(--color-primary-dark-100)',
      '--background-image': 'none',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#2ec4b6',
      '--color-btn-min': '#7ac74f',
      '--color-btn-close': '#f28482',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#4f6d9a',
      '--color-badge-tertiary': '#2a9d8f',
    },
  },
  {
    id: 'blue2',
    name: '鸢尾靛蓝',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(75, 96, 218)',
      font: 'rgb(23, 25, 38)',
      '--color-app-background': 'var(--color-primary-light-800-alpha-400)',
      '--color-main-background': 'rgba(248, 249, 255, 0.78)',
      '--color-nav-font': 'var(--color-primary-dark-200)',
      '--background-image': 'none',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#2ec4b6',
      '--color-btn-min': '#7ac74f',
      '--color-btn-close': '#f28482',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#9f6fe6',
      '--color-badge-tertiary': '#0ea5e9',
    },
  },
  {
    id: 'black',
    name: '黑灯瞎火',
    isDark: true,
    isDarkFont: false,
    config: {
      primary: 'rgb(148, 163, 184)',
      font: 'rgb(236, 240, 245)',
      '--color-app-background': 'rgba(8, 10, 14, 0.44)',
      '--color-main-background': 'rgba(16, 19, 24, 0.9)',
      '--color-nav-font': 'var(--color-primary)',
      '--background-image': 'url(./theme_images/landingMoon.png)',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#2ec4b6',
      '--color-btn-min': '#7ac74f',
      '--color-btn-close': '#f28482',

      '--color-badge-primary': '#38bdf8',
      '--color-badge-secondary': '#34d399',
      '--color-badge-tertiary': '#fbbf24',
    },
  },
  {
    id: 'mid_autumn',
    name: '月里嫦娥',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(96, 72, 122)',
      font: 'rgb(29, 25, 34)',
      '--color-app-background': 'rgba(255, 255, 255, 0)',
      '--color-main-background': 'rgba(253, 251, 254, 0.88)',
      '--color-nav-font': 'var(--color-primary)',
      '--background-image': 'url(./theme_images/jqbg.jpg)',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#2ec4b6',
      '--color-btn-min': '#7ac74f',
      '--color-btn-close': '#f28482',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#b68f68',
      '--color-badge-tertiary': '#9d79b3',
    },
  },
  {
    id: 'naruto',
    name: '木叶之村',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(68, 138, 166)',
      font: 'rgb(24, 31, 35)',
      '--color-app-background': 'rgba(255, 255, 255, 0.14)',
      '--color-main-background': 'rgba(250, 253, 255, 0.82)',
      '--color-nav-font': 'var(--color-primary)',
      '--background-image': 'url(./theme_images/myzcbg.jpg)',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#2ec4b6',
      '--color-btn-min': '#7ac74f',
      '--color-btn-close': '#f28482',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#e59224',
      '--color-badge-tertiary': 'var(--color-primary-light-100)',
    },
  },
  {
    id: 'china_ink',
    name: '近墨者黑',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(42, 46, 52)',
      font: 'rgb(24, 26, 30)',
      '--color-app-background': 'rgba(255, 255, 255, 0)',
      '--color-main-background': 'rgba(252, 252, 251, 0.82)',
      '--color-nav-font': 'var(--color-primary)',
      '--background-image': 'url(./theme_images/china_ink.jpg)',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': 'rgba(183, 212, 208, 1)',
      '--color-btn-min': 'rgba(200, 214, 183, 1)',
      '--color-btn-close': 'rgba(218, 195, 188, 1)',

      '--color-badge-primary': 'rgba(153, 72, 72, 1)',
      '--color-badge-secondary': 'rgba(58, 134, 88, 1)',
      '--color-badge-tertiary': 'rgba(138, 128, 56, 1)',
    },
  },
  {
    id: 'happy_new_year',
    name: '新年快乐',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(204, 48, 48)',
      font: 'rgb(34, 24, 24)',
      '--color-app-background': 'rgba(255, 255, 255, 0.14)',
      '--color-main-background': 'rgba(255, 251, 250, 0.82)',
      '--color-nav-font': 'var(--color-primary)',
      '--background-image': 'url(./theme_images/xnkl.png)',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#2ec4b6',
      '--color-btn-min': '#7ac74f',
      '--color-btn-close': '#f28482',

      '--color-badge-primary': '#5ba368',
      '--color-badge-secondary': '#d9a441',
      '--color-badge-tertiary': 'var(--color-primary-light-100)',
    },
  },
]

const themes = defaultThemes.map(({ config: { primary, font, ...extInfo }, ...themeInfo }) => {
  return {
    ...themeInfo,
    isCustom: false,
    config: {
      themeColors: createThemeColors(primary, font, themeInfo.isDark),
      extInfo,
    },
  }
})

fs.writeFileSync(path.join(__dirname, 'index.json'), JSON.stringify(themes, null, 2))
