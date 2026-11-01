export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(min, max), Math.max(min, Number.isFinite(value) ? value : min))

// 保存相对高度，旋转、分屏和导航展开时仍停在屏幕内。
export const floatingBounds = (width: number, height: number, panelWidth: number, panelHeight: number) => ({
  minX: 12,
  maxX: Math.max(12, width - panelWidth - 12),
  maxY: Math.max(0, height - panelHeight),
})

export const floatingPosition = (width: number, height: number, panelWidth: number, panelHeight: number, side: string, offset: number, anchorHeight = panelHeight) => {
  const bounds = floatingBounds(width, height, panelWidth, panelHeight)
  const anchorRange = Math.max(0, height - anchorHeight)
  return { x: side == 'left' ? bounds.minX : bounds.maxX, y: clamp(anchorRange * clamp(offset, 0, 1), 0, bounds.maxY) }
}

export const snapFloatingPosition = (x: number, y: number, width: number, height: number, panelWidth: number, panelHeight: number, anchorHeight = panelHeight) => {
  const bounds = floatingBounds(width, height, panelWidth, panelHeight)
  const side = x + panelWidth / 2 < width / 2 ? 'left' : 'right'
  const anchorRange = Math.max(0, height - anchorHeight)
  const offset = anchorRange ? clamp(y, 0, bounds.maxY) / anchorRange : 0.5
  return { side, offset, ...floatingPosition(width, height, panelWidth, panelHeight, side, offset, anchorHeight) } as const
}
