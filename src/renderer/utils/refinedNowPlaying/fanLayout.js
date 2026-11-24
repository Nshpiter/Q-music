/*!
 * MIT License
 *
 * Copyright (c) 2022 solstice23
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
// RefinedNowPlaying 2.19.5, src/lyrics.js (Lyrics & Line).
// https://github.com/solstice23/refined-now-playing-netease/blob/f3b3e2b38809e711d5c60cb2b7f8ce1eda318bda/src/lyrics.js#L255-L405
// 取自上游的旋转、排列和错峰延时。由 Q-music 提供实测行高与播放位置。
export function layoutFan({ heights, fontSize, anchor, currentLineForScrolling, previousLine, scrollingMode, lyricStagger, lyricZoom, RotateCurvature }) {
  const space = fontSize * 1.2
  const delayByOffset = (offset) => {
    if (currentLineForScrolling == previousLine || scrollingMode) {
      return 0
    }
    if (!lyricStagger) {
      return 0
    }
    const sign = currentLineForScrolling - previousLine > 0 ? 1 : -1
    offset = Math.max(-4, Math.min(4, offset)) * sign + 4
    return offset * 50
  }
  const scaleByOffset = offset => {
    if (!lyricZoom) return 1
    offset = Math.abs(offset)
    offset = Math.max(1 - offset * 0.2, 0)
    return offset * offset * offset * 0.3 + 0.7
  }
  const setRotateTransform = (line, yOffset, height) => {
    const origin = [-120 + (RotateCurvature - 25), -(yOffset + height / 2)]
    const len = Math.sqrt(origin[0] * origin[0] + origin[1] * origin[1])
    line.rotate = Math.min(yOffset / window.innerHeight * -RotateCurvature, 90)

    const deg = line.rotate + Math.atan2(origin[1], origin[0]) * 180 / Math.PI
    line.extraTop = Math.sin(deg * Math.PI / 180) * len - origin[1]
    line.left = Math.cos(deg * Math.PI / 180) * len - origin[0]

    const opacity = 1 - (1 * Math.abs(yOffset * 2 / window.innerHeight) ** 1.15 * 1.2)
    line.opacity = Math.max(opacity, 0)
    if (opacity <= -1.5) line.outOfRangeHidden = true
    else if (line.outOfRangeHidden) delete line.outOfRangeHidden
  }
  const current = currentLineForScrolling
  const transforms = heights.map(() => ({ top: 0, scale: 1, delay: 0 }))
  transforms[current].top = anchor - heights[current] / 2
  transforms[current].delay = delayByOffset(0)
  // all lines before current
  for (let i = current - 1; i >= 0; i--) {
    transforms[i].scale = scaleByOffset(current - i)
    const scaledHeight = heights[i] * transforms[i].scale
    transforms[i].top = transforms[i + 1].top - scaledHeight - space
    transforms[i].delay = delayByOffset(i - current)
    setRotateTransform(transforms[i], transforms[current].top - transforms[i].top, heights[i] * transforms[i].scale)
  }
  // all lines after current
  for (let i = current + 1; i < heights.length; i++) {
    transforms[i].scale = scaleByOffset(i - current)
    const previousScaledHeight = heights[i - 1] * transforms[i - 1].scale
    transforms[i].top = transforms[i - 1].top + previousScaledHeight + space
    transforms[i].delay = delayByOffset(i - current)
    setRotateTransform(transforms[i], transforms[current].top - transforms[i].top, heights[i] * transforms[i].scale)
  }
  return transforms
}
