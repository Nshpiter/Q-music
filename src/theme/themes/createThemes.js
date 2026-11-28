//! 更新默认主题配置后，需要执行 npm run build:theme 重新构建index.json

const fs = require('fs')
const path = require('path')
const { createThemeColors } = require('./utils')

const defaultThemes = [
  {
    id: 'green',
    name: '松烟暖白',
    isDark: false,
    config: {
      primary: 'rgb(31, 107, 82)',
      font: 'rgb(28, 30, 32)',
      'c-app-background': '#F4F2ED',
      'c-main-background': 'rgba(255, 255, 255, 0.90)',
      'bg-image': '',
      'bg-image-position': 'center',
      'bg-image-size': 'cover',

      'c-badge-primary': 'var(c-primary)',
      'c-badge-secondary': '#4b5563',
      'c-badge-tertiary': '#b45309',
    },
  },
  {
    id: 'blue',
    name: '海盐蔚蓝',
    isDark: false,
    config: {
      primary: 'rgb(37, 137, 229)',
      font: 'rgb(22, 29, 38)',
      'c-app-background': 'var(c-primary-light-800-alpha-400)',
      'c-main-background': 'rgba(248, 251, 255, 0.78)',
      'bg-image': '',
      'bg-image-position': 'center',
      'bg-image-size': 'cover',

      'c-badge-primary': 'var(c-primary)',
      'c-badge-secondary': '#14b8a6',
      'c-badge-tertiary': '#e59224',
    },
  },
  {
    id: 'blue_plus',
    name: '群青夜雾',
    isDark: false,
    config: {
      primary: 'rgb(59, 108, 168)',
      font: 'rgb(22, 27, 36)',
      'c-app-background': 'var(c-primary-light-700-alpha-400)',
      'c-main-background': 'rgba(247, 250, 254, 0.78)',
      'bg-image': '',
      'bg-image-position': 'center',
      'bg-image-size': 'cover',

      'c-badge-primary': 'var(c-primary)',
      'c-badge-secondary': '#0284c7',
      'c-badge-tertiary': '#2aa89b',
    },
  },
  {
    id: 'orange',
    name: '暖白陶土',
    isDark: false,
    config: {
      primary: 'rgb(198, 93, 52)',
      font: 'rgb(28, 30, 32)',
      'c-app-background': '#F4F2ED',
      'c-main-background': 'rgba(255, 255, 255, 0.90)',
      'bg-image': '',
      'bg-image-position': 'center',
      'bg-image-size': 'cover',

      'c-badge-primary': 'var(c-primary)',
      'c-badge-secondary': '#4b5563',
      'c-badge-tertiary': '#b45309',
    },
  },
  {
    id: 'brown',
    name: '泥牛入海',
    isDark: false,
    config: {
      primary: 'rgb(176, 114, 58)',
      font: 'rgb(34, 27, 22)',
      'c-app-background': 'var(c-primary-light-800-alpha-400)',
      'c-main-background': 'rgba(252, 249, 245, 0.78)',
      'bg-image': '',
      'bg-image-position': 'center',
      'bg-image-size': 'cover',

      'c-badge-primary': 'var(c-primary)',
      'c-badge-secondary': '#4f4680',
      'c-badge-tertiary': '#5f7c3b',
    },
  },
  {
    id: 'red',
    name: '丹霞绯红',
    isDark: false,
    config: {
      primary: 'rgb(217, 56, 72)',
      font: 'rgb(34, 24, 26)',
      'c-app-background': 'var(c-primary-light-800-alpha-400)',
      'c-main-background': 'rgba(255, 249, 250, 0.78)',
      'bg-image': '',
      'bg-image-position': 'center',
      'bg-image-size': 'cover',

      'c-badge-primary': 'var(c-primary)',
      'c-badge-secondary': '#d99126',
      'c-badge-tertiary': '#e07a5f',
    },
  },
  {
    id: 'pink',
    name: '云樱蔷薇',
    isDark: false,
    config: {
      primary: 'rgb(225, 92, 126)',
      font: 'rgb(34, 24, 29)',
      'c-app-background': 'var(c-primary-light-800-alpha-400)',
      'c-main-background': 'rgba(255, 249, 251, 0.78)',
      'bg-image': '',
      'bg-image-position': 'center',
      'bg-image-size': 'cover',

      'c-badge-primary': 'var(c-primary)',
      'c-badge-secondary': '#ea8c55',
      'c-badge-tertiary': '#c06c84',
    },
  },
  {
    id: 'purple',
    name: '暮霭紫晶',
    isDark: false,
    config: {
      primary: 'rgb(138, 86, 208)',
      font: 'rgb(28, 24, 36)',
      'c-app-background': 'var(c-primary-light-800-alpha-400)',
      'c-main-background': 'rgba(251, 249, 255, 0.78)',
      'bg-image': '',
      'bg-image-position': 'center',
      'bg-image-size': 'cover',

      'c-badge-primary': 'var(c-primary)',
      'c-badge-secondary': '#ec6f8c',
      'c-badge-tertiary': '#6366f1',
    },
  },
  {
    id: 'grey',
    name: '北欧冷灰',
    isDark: false,
    config: {
      primary: 'rgb(88, 108, 128)',
      font: 'rgb(24, 29, 36)',
      'c-app-background': 'var(c-primary-light-800-alpha-400)',
      'c-main-background': 'rgba(248, 250, 252, 0.78)',
      'bg-image': '',
      'bg-image-position': 'center',
      'bg-image-size': 'cover',

      'c-badge-primary': 'var(c-primary)',
      'c-badge-secondary': '#0ea5e9',
      'c-badge-tertiary': '#8b7e8d',
    },
  },
  {
    id: 'ming',
    name: '青出于黑',
    isDark: false,
    config: {
      primary: 'rgb(29, 116, 130)',
      font: 'rgb(21, 31, 34)',
      'c-app-background': 'var(c-primary-light-800-alpha-400)',
      'c-main-background': 'rgba(247, 251, 252, 0.78)',
      'bg-image': '',
      'bg-image-position': 'center',
      'bg-image-size': 'cover',

      'c-badge-primary': 'var(c-primary)',
      'c-badge-secondary': '#4f6d9a',
      'c-badge-tertiary': '#2a9d8f',
    },
  },
  {
    id: 'blue2',
    name: '鸢尾靛蓝',
    isDark: false,
    config: {
      primary: 'rgb(75, 96, 218)',
      font: 'rgb(23, 25, 38)',
      'c-app-background': 'var(c-primary-light-800-alpha-400)',
      'c-main-background': 'rgba(248, 249, 255, 0.78)',
      'bg-image': '',
      'bg-image-position': 'center',
      'bg-image-size': 'cover',

      'c-badge-primary': 'var(c-primary)',
      'c-badge-secondary': '#9f6fe6',
      'c-badge-tertiary': '#0ea5e9',
    },
  },
  {
    id: 'black',
    name: '黑灯瞎火',
    isDark: true,
    config: {
      primary: 'rgb(148, 163, 184)',
      font: 'rgb(236, 240, 245)',
      'c-app-background': 'rgba(8, 10, 14, 0.44)',
      'c-main-background': 'rgba(16, 19, 24, 0.9)',
      'bg-image': 'landingMoon.png',
      'bg-image-position': 'center',
      'bg-image-size': 'cover',

      'c-badge-primary': '#38bdf8',
      'c-badge-secondary': '#34d399',
      'c-badge-tertiary': '#fbbf24',
    },
  },
  {
    id: 'mid_autumn',
    name: '月里嫦娥',
    isDark: false,
    config: {
      primary: 'rgb(96, 72, 122)',
      font: 'rgb(29, 25, 34)',
      'c-app-background': 'rgba(255, 255, 255, 0)',
      'c-main-background': 'rgba(253, 251, 254, 0.88)',
      'bg-image': 'jqbg.jpg',
      'bg-image-position': 'center',
      'bg-image-size': 'cover',

      'c-badge-primary': 'var(c-primary)',
      'c-badge-secondary': '#b68f68',
      'c-badge-tertiary': '#9d79b3',
    },
  },
  {
    id: 'naruto',
    name: '木叶之村',
    isDark: false,
    config: {
      primary: 'rgb(68, 138, 166)',
      font: 'rgb(24, 31, 35)',
      'c-app-background': 'rgba(255, 255, 255, 0.14)',
      'c-main-background': 'rgba(250, 253, 255, 0.82)',
      'bg-image': 'myzcbg.jpg',
      'bg-image-position': 'center',
      'bg-image-size': 'cover',

      'c-badge-primary': 'var(c-primary)',
      'c-badge-secondary': '#e59224',
      'c-badge-tertiary': 'var(c-primary-light-100)',
    },
  },
  {
    id: 'china_ink',
    name: '近墨者黑',
    isDark: false,
    config: {
      primary: 'rgb(42, 46, 52)',
      font: 'rgb(24, 26, 30)',
      'c-app-background': 'rgba(255, 255, 255, 0)',
      'c-main-background': 'rgba(252, 252, 251, 0.82)',
      'bg-image': 'china_ink.jpg',
      'bg-image-position': 'center',
      'bg-image-size': 'cover',

      'c-badge-primary': 'rgba(153, 72, 72, 1)',
      'c-badge-secondary': 'rgba(58, 134, 88, 1)',
      'c-badge-tertiary': 'rgba(138, 128, 56, 1)',
    },
  },
  {
    id: 'happy_new_year',
    name: '新年快乐',
    isDark: false,
    config: {
      primary: 'rgb(204, 48, 48)',
      font: 'rgb(34, 24, 24)',
      'c-app-background': 'rgba(255, 255, 255, 0.14)',
      'c-main-background': 'rgba(255, 251, 250, 0.82)',
      'bg-image': 'xnkl.png',
      'bg-image-position': 'center',
      'bg-image-size': 'cover',

      'c-badge-primary': '#5ba368',
      'c-badge-secondary': '#d9a441',
      'c-badge-tertiary': 'var(c-primary-light-100)',
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

fs.writeFileSync(path.join(__dirname, 'themes.ts'), `/* eslint-disable */\n//! 此文件由 createThemes.js 生成\n\nexport default ${JSON.stringify(themes, null, 2)} as const`)
