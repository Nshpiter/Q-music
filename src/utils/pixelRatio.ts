/**
 * Created by qianxin on 17/6/1.
 * 屏幕工具类
 * ui设计基准,iphone 6
 * width:375
 * height:667
 */
import { PixelRatio } from 'react-native'
import { windowSizeTools } from './windowSizeTools'

// 高保真的宽度和高度
const designWidth = 375.0
const designHeight = 667.0

// 获取屏幕的dp
const size = windowSizeTools.getSize()
// console.log('size', size)
let screenW = size.width
let screenH = size.height
if (screenW > screenH) {
  const temp = screenW
  screenW = screenH
  screenH = temp
}
const fontScale = PixelRatio.getFontScale()

/**
 * 移动端统一使用手机密度。
 *
 * 旧实现按物理像素计算缩放，高分辨率或自定义 DPI 的设备会把 54dp
 * 控件放大到接近 90dp，并间接触发平板式排版。这里按布局 dp 计算，
 * 只允许窄屏向下收缩，不在宽屏上放大手机组件。
 */
const phoneScale = Math.min(screenW / designWidth, screenH / designHeight, 1)

/**
 * 设置text
 * @param size  px
 * @returns dp
 */
export function getTextSize(size: number) {
  return Math.floor(size * phoneScale / fontScale)
}
export function setSpText(size: number) {
  return getTextSize(size) * global.lx.fontSize
}

/**
 * 设置高度
 * @param size  px
 * @returns dp
 */
export function scaleSizeH(size: number) {
  return Math.floor(size * phoneScale) * global.lx.fontSize
}

/**
 * 设置宽度
 * @param size  px
 * @returns dp
 */
export function scaleSizeW(size: number) {
  return Math.floor(size * phoneScale) * global.lx.fontSize
}


export const scaleSizeWR = (size: number) => {
  return size * 2 - scaleSizeW(size)
}

export const scaleSizeHR = (size: number) => {
  return size * 2 - scaleSizeH(size)
}

export const scaleSizeAbsHR = (size: number) => {
  return size * 2 - Math.floor(size * phoneScale)
}
