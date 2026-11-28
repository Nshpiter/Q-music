// 启动、切换主题和主题编辑预览共用材质，保持中性灰白/炭灰底板并压低深色边线。
export const buildThemeMaterial = (isDark: boolean): Record<string, string> => ({
  '--q-background-scrim': isDark ? 'rgba(10, 12, 14, .48)' : 'rgba(244, 242, 237, 0)',
  '--color-font-label': 'var(--color-650)',
  '--q-surface': `rgb(from var(--color-content-background) r g b / ${isDark ? '.88' : '.82'})`,
  '--q-surface-strong': `rgb(from var(--color-content-background) r g b / ${isDark ? '.96' : '.94'})`,
  '--q-surface-soft': `rgb(from var(--color-content-background) r g b / ${isDark ? '.72' : '.64'})`,
  '--q-border': isDark ? 'rgba(255, 255, 255, .07)' : 'rgba(255, 255, 255, .84)',
  '--q-panel-border': isDark ? 'rgba(255, 255, 255, .065)' : 'rgba(28, 30, 32, .065)',
  '--q-highlight': isDark ? 'rgba(255, 255, 255, .04)' : 'rgba(255, 255, 255, .64)',
  '--q-outline': isDark ? 'rgba(255, 255, 255, .08)' : 'rgba(28, 30, 32, .09)',
  '--q-list-selected-bg': isDark ? 'rgba(255, 255, 255, .075)' : 'rgba(28, 30, 32, .055)',
  '--q-menu-bg': 'rgb(from var(--color-content-background) r g b / .96)',
  '--q-menu-border': 'inset 0 0 0 1px var(--q-panel-border)',
  '--q-shadow-soft': `0 10px 28px rgba(0, 0, 0, ${isDark ? '.24' : '.05'})`,
  '--q-shadow-float': `0 24px 64px rgba(0, 0, 0, ${isDark ? '.42' : '.14'})`,
})
