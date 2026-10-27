import type { SettingsBackEvent } from '@/utils/nativeModules/settingsBack'

// 手势预览只改变展示状态；取消、失去前台和重复回调都不能提交导航。
export const createSettingsBackGesture = (handlers: {
  preview: (progress: number, edge: number) => void
  cancel: () => void
  commit: () => void
}) => {
  let tracking = false
  let committed = false
  return {
    reset(restore = true) {
      if (tracking && restore) handlers.cancel()
      tracking = false
      committed = false
    },
    handle(event: SettingsBackEvent) {
      switch (event.phase) {
        case 'start':
          tracking = true
          committed = false
          handlers.preview(0, event.edge)
          break
        case 'progress':
          if (tracking && Number.isFinite(event.progress)) handlers.preview(Math.max(0, Math.min(1, event.progress)), event.edge)
          break
        case 'cancel':
          if (tracking) handlers.cancel()
          tracking = false
          break
        case 'commit':
          // 三键导航没有 start/progress，同样只提交一次。
          if (!committed) { committed = true; tracking = false; handlers.commit() }
          break
      }
    },
  }
}
