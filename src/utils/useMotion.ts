import { useEffect, useState } from 'react'
import { AccessibilityInfo, AppState } from 'react-native'
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
  let revision = 0
  const refresh = () => {
    const current = ++revision
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (current == revision) setReduced(value)
    }).catch(() => {})
  }
  AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
    ++revision
    setReduced(value)
  })
  // 部分系统在后台修改动画设置时不派发事件，回到前台后重新确认。
  AppState.addEventListener('change', state => { if (state == 'active') refresh() })
  refresh()
}

/** 跟手、按压和滚动反馈只遵循系统减少动画，不随玻璃性能模式关闭。 */
export const useInteractionMotion = () => {
  const [value, setValue] = useState(reduced)
  useEffect(() => {
    init()
    listeners.add(setValue)
    setValue(reduced)
    return () => { listeners.delete(setValue) }
  }, [])
  return !value
}

/** 封面、背景和玻璃等装饰动效仍受流畅模式限制。 */
export const useMotion = () => {
  const interactionMotion = useInteractionMotion()
  const performanceMode = useSettingValue('theme.performanceMode')
  return interactionMotion && !performanceMode
}
