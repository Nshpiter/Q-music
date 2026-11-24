import { onMounted, watch } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'

export default () => {
  onMounted(() => {
    const surface = document.getElementById('root')!
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    watch(() => [
      appSetting['theme.customBgImage'], appSetting['theme.backgroundMotion'], appSetting['theme.dimActiveBackground'],
      appSetting['theme.backgroundIdleSeconds'], appSetting['theme.backgroundActiveOpacity'],
      appSetting['common.performanceMode'], appSetting['common.isShowAnimation'],
      appSetting['theme.desktopLayout'], appSetting['theme.layoutOptions'],
    ], (_, __, onCleanup) => {
      const layout = appSetting['theme.layoutOptions']?.[appSetting['theme.desktopLayout']]
      if (!layout?.background && !appSetting['theme.customBgImage']) return
      const motion = appSetting['theme.backgroundMotion'] && appSetting['common.isShowAnimation'] &&
        !appSetting['common.performanceMode'] && !document.documentElement.classList.contains('nativeWayland')
      const dim = appSetting['theme.dimActiveBackground']
      const blur = appSetting['theme.desktopLayout'] === 'Transmission' && !!layout?.backgroundBlur && !appSetting['common.performanceMode']
      if (!motion && !dim && !blur) return
      const idleDelay = Math.max(0.25, Math.min(30, appSetting['theme.backgroundIdleSeconds'])) * 1000
      surface.style.setProperty('--q-active-bg-opacity', String(Math.max(0, Math.min(100, appSetting['theme.backgroundActiveOpacity'])) / 100))

      let frame = 0
      let idleTimer: ReturnType<typeof setTimeout>
      let x = 0
      let y = 0
      const reset = () => {
        cancelAnimationFrame(frame)
        frame = 0
        clearTimeout(idleTimer)
        surface.style.removeProperty('--q-bg-x')
        surface.style.removeProperty('--q-bg-y')
        surface.classList.remove('dimBackground')
      }
      const syncMotion = () => {
        reset()
        surface.classList.toggle('movingBackground', motion && !reducedMotion.matches)
        surface.classList.toggle('backgroundEffects', blur || dim || (motion && !reducedMotion.matches))
      }
      const active = () => {
        if (!dim) return
        surface.classList.add('dimBackground')
        clearTimeout(idleTimer)
        idleTimer = setTimeout(() => { surface.classList.remove('dimBackground') }, idleDelay)
      }
      const move = (event: PointerEvent) => {
        active()
        if (!motion || reducedMotion.matches || event.pointerType == 'touch') return
        x = (0.5 - event.clientX / window.innerWidth) * 16
        y = (0.5 - event.clientY / window.innerHeight) * 16
        if (frame) return
        frame = requestAnimationFrame(() => {
          surface.style.setProperty('--q-bg-x', x + 'px')
          surface.style.setProperty('--q-bg-y', y + 'px')
          frame = 0
        })
      }
      syncMotion()
      reducedMotion.addEventListener('change', syncMotion)
      surface.addEventListener('pointermove', move)
      surface.addEventListener('pointerleave', reset)
      window.addEventListener('blur', reset)
      if (dim) window.addEventListener('keydown', active)
      onCleanup(() => {
        reducedMotion.removeEventListener('change', syncMotion)
        surface.removeEventListener('pointermove', move)
        surface.removeEventListener('pointerleave', reset)
        window.removeEventListener('blur', reset)
        window.removeEventListener('keydown', active)
        reset()
        surface.classList.remove('movingBackground', 'backgroundEffects')
        surface.style.removeProperty('--q-active-bg-opacity')
      })
    }, { immediate: true })
  })
}
