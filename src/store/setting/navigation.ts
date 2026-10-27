import { useSyncExternalStore } from 'react'
import type { SettingScreenIds } from '@/screens/Home/Views/Setting/Main'

// 页头、系统返回键和横屏分类共享一份位置，避免内容切换后导航仍停在旧分类。
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const getSnapshot = () => global.lx.settingActiveId
let targetId = ''
let searchQuery = ''
let transitioning = false
export const setSettingTransitioning = (value: boolean) => { transitioning = value }
export const getSettingSearchQuery = () => searchQuery
export const setSettingSearchQuery = (query: string) => { searchQuery = query }
export const useSettingTarget = () => useSyncExternalStore(subscribe, () => targetId)

export const selectSettingSection = (id: SettingScreenIds, target = '') => {
  if (global.lx.settingActiveId == id && targetId == target) return
  targetId = target
  global.lx.settingActiveId = id
  for (const listener of listeners) listener()
}

export const backToSettingOverview = () => {
  // 快速重复返回先完成当前退场，不能越过设置总览直接退出。
  if (transitioning && global.lx.settingActiveId == 'overview') return true
  if (global.lx.settingActiveId == 'overview') return false
  selectSettingSection('overview')
  return true
}

export const useSettingSection = () => useSyncExternalStore(subscribe, getSnapshot)
