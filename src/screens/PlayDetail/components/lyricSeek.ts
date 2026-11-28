// 虚拟列表远距离滚动时，前面的行可能还没有测量。此时保留浏览，不跳到猜测的时间。
export const lyricIndexAtOffset = (heights: readonly number[], count: number, offset: number): number | null => {
  let bottom = 0
  for (let i = 0; i < count; i++) {
    const height = heights[i]
    if (!Number.isFinite(height) || height <= 0) return null
    bottom += height
    if (bottom >= offset) return i
  }
  return count ? count - 1 : null
}
