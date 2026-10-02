import { AppState } from 'react-native'

export type PermissionResult = 'enabled' | 'unconfirmed' | 'unavailable'

// 厂商后台设置与 Android 白名单不是同一状态，不能把未确认当成用户拒绝。
export const createSettingsRequest = (check: () => Promise<boolean>, open: () => Promise<boolean>) => {
  let pending: Promise<PermissionResult> | undefined
  return async(): Promise<PermissionResult> => {
    if (pending) return pending
    pending = (async(): Promise<PermissionResult> => {
      try {
        if (await check()) return 'enabled'
      } catch { return 'unavailable' }
      return new Promise<PermissionResult>((resolve) => {
        let done = false
        let left = false
        let foreground = true
        let checking = false
        let timer: ReturnType<typeof setTimeout> | undefined
        const finish = (result: PermissionResult) => {
          if (done) return
          done = true
          subscription.remove()
          clearTimeout(timer)
          clearTimeout(deadline)
          resolve(result)
        }
        const verify = async(attempt = 0): Promise<void> => {
          if (done || checking || !foreground) return
          checking = true
          try {
            if (await check()) { finish('enabled'); return }
            if (!foreground) return
            if (attempt >= 3) { finish('unconfirmed'); return }
          } catch { finish('unavailable'); return } finally {
            // 同一请求只允许一次检查，后续重试由本次检查完成后调度。
            // eslint-disable-next-line require-atomic-updates
            checking = false
          }
          if (!done && foreground) timer = setTimeout(() => { void verify(attempt + 1) }, 600)
        }
        const subscription = AppState.addEventListener('change', (state) => {
          foreground = state == 'active'
          if (state != 'active') {
            left = true
            clearTimeout(timer)
          } else if (left) {
            clearTimeout(timer)
            timer = setTimeout(() => { void verify() }, 350)
          }
        })
        // 页面没有发出生命周期事件或用户长时间留在设置中，也必须释放监听。
        const deadline = setTimeout(() => { finish('unconfirmed') }, 120_000)
        void open().then((opened) => {
          if (done) return
          if (!opened) { finish('unavailable'); return }
          if (!left) timer = setTimeout(() => { void verify() }, 1800)
        }).catch(() => { finish('unavailable') })
      })
    })().finally(() => { pending = undefined })
    return pending
  }
}
