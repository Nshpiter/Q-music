import '@common/error'
import { createApp } from 'vue'

import './core/globalData'

import '@renderer/event'

// Components
import mountComponents from './components'

// Plugins
import initPlugins from './plugins'
import { i18nPlugin } from './plugins/i18n'

import App from './App.vue'
import router from './router'
// import store from './store'
import { cleanupStaleModalClass, logRendererState } from './utils/debugLog'


import { getSetting, updateSetting } from './utils/ipc'
import { langList } from '@root/lang'
import type { I18n } from '@root/lang/i18n'

import { initSetting } from './store/setting'
// import { bubbleCursor } from './utils/cursor-effects/bubbleCursor'

import './worker'
import { saveViewPrevState } from './utils/data'
import { isShowLrcSelectContent, isShowPlayComment, isShowPlayerDetail } from './store/player/state'
import { setShowPlayerDetail } from './store/player/action'

// sync(store, router)

router.afterEach((to, from) => {
  if (to.path != '/songList/detail') {
    saveViewPrevState({
      url: to.path,
      query: { ...to.query },
    })
  }
  if (isShowPlayerDetail.value || isShowLrcSelectContent.value || isShowPlayComment.value) {
    setShowPlayerDetail(false)
    logRendererState('play-detail:reset-on-route', {
      from: from.fullPath,
      to: to.fullPath,
    })
  }
  queueMicrotask(() => {
    cleanupStaleModalClass()
    logRendererState('route:afterEach', {
      from: from.fullPath,
      to: to.fullPath,
    })
  })
  window.setTimeout(() => {
    cleanupStaleModalClass()
    logRendererState('route:afterEach:100ms', {
      from: from.fullPath,
      to: to.fullPath,
    })
  }, 100)
})

router.onError((error, to, from) => {
  logRendererState('router:error', {
    message: error.message,
    stack: error.stack,
    from: from.fullPath,
    to: to.fullPath,
  })
})

void getSetting().then(setting => {
  // window.lx.appSetting = setting
  // Set language automatically
  if (!setting['common.langId'] || !window.i18n.availableLocales.includes(setting['common.langId'])) {
    let langId: I18n['locale'] | null = null
    const locale = window.navigator.language.toLocaleLowerCase() as I18n['locale']
    if (window.i18n.availableLocales.includes(locale)) {
      langId = locale
    } else {
      for (const lang of langList) {
        if (lang.alternate == locale) {
          langId = lang.locale
          break
        }
      }
      langId ??= 'en-us'
    }
    setting['common.langId'] = langId
    void updateSetting({ 'common.langId': langId })
    console.log('Set lang', setting['common.langId'])
  }
  window.setLang(setting['common.langId'])
  window.i18n.setLanguage(setting['common.langId'])

  if (!setting['common.startInFullscreen'] && (document.body.clientHeight > window.screen.availHeight || document.body.clientWidth > window.screen.availWidth) && setting['common.windowSizeId'] > 1) {
    void updateSetting({ 'common.windowSizeId': 1 })
  }

  // store.commit('setSetting', setting)
  initSetting(setting)

  const app = createApp(App)
  app.config.errorHandler = (error, instance, info) => {
    logRendererState('vue:error', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      info,
      component: instance?.$options?.name,
    })
    console.error(error)
  }
  window.addEventListener('error', event => {
    logRendererState('window:error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error instanceof Error ? event.error.stack : String(event.error),
    })
  })
  window.addEventListener('unhandledrejection', event => {
    const reason = event.reason
    logRendererState('window:unhandledrejection', {
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    })
  })
  app
    .use(router)
    // .use(store)
    .use(i18nPlugin)
  initPlugins(app)
  mountComponents(app)
  app.mount('#root')
})

// bubbleCursor()
