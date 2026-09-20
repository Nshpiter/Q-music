import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'

// 首次查询完成前不播放动效，避免违背系统“移除动画”的偏好。
export const useMotion = () => {
  const [reduced, setReduced] = useState(true)
  const performanceMode = useSettingValue('theme.performanceMode')
  useEffect(() => {
    let active = true
    let changed = false
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      changed = true
      setReduced(value)
    })
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (active && !changed) setReduced(value)
    }).catch(() => {})
    return () => { active = false; subscription.remove() }
  }, [])
  return !reduced && !performanceMode
}
