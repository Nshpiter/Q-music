import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'

// 全局共享一份“减少动态效果”状态，列表中大量控件不会各自注册系统监听。
// 首次查询完成前视为已减少，避免违背系统“移除动画”的偏好。
let reduced = true
let initialized = false
const listeners = new Set<(value: boolean) => void>()

const setReduced = (value: boolean) => {
  if (reduced == value) return
  reduced = value
  for (const listener of listeners) listener(value)
}

const init = () => {
  if (initialized) return
  initialized = true
  let changed = false
  AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
    changed = true
    setReduced(value)
  })
  void AccessibilityInfo.isReduceMotionEnabled().then(value => {
    if (!changed) setReduced(value)
  }).catch(() => {})
}

export const useMotion = () => {
  const [value, setValue] = useState(reduced)
  const performanceMode = useSettingValue('theme.performanceMode')
  useEffect(() => {
    init()
    listeners.add(setValue)
    setValue(reduced)
    return () => { listeners.delete(setValue) }
  }, [])
  return !value && !performanceMode
}
