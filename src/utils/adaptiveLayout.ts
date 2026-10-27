export type NavigationPosition = 'left' | 'right' | 'bottom'

export type DisplayMode = 'auto' | 'phone' | 'tablet' | 'car'

// 按可用 dp 布局；屏幕横竖方向独立传入，软键盘缩短窗口不能触发横屏布局。
export const resolveAdaptiveLayout = (width: number, height: number, mode: DisplayMode, landscape: boolean, automotive = false, preferredPosition: NavigationPosition = 'left') => {
  const isCar = mode == 'car' || (mode == 'auto' && automotive)
  const wide = mode != 'phone' && (width >= 720 || (width >= 600 && (landscape || mode == 'tablet' || isCar)))
  const navigationPosition = wide ? preferredPosition : 'bottom'
  const railWidth = wide && navigationPosition != 'bottom' ? (isCar ? 104 : 88) : 0
  return {
    width,
    height,
    wide,
    navigationPosition,
    canSwipePages: !wide && !isCar,
    isCar,
    railWidth,
    splitLibrary: wide && width - railWidth >= 680,
    songRowHeight: isCar ? 72 : 54,
  }
}
