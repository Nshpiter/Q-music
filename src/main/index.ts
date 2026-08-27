import { app } from 'electron'
import './utils/logInit'
import '@common/error'
import {
  initGlobalData,
  initSingleInstanceHandle,
  applyElectronEnvParams,
  setUserDataPath,
  registerDeeplink,
  listenerAppEvent,
} from './app'
import { isLinux, log } from '@common/utils'
import { initAppSetting } from '@main/app'
import registerModules from '@main/modules'

// 初始化应用
const init = () => {
  console.log('init')
  void initAppSetting().then(() => {
    registerModules()
    global.lx.event_app.app_inited()
  })
}

initGlobalData()
initSingleInstanceHandle()
applyElectronEnvParams()
setUserDataPath()
registerDeeplink(init)
listenerAppEvent(init)

if (isLinux) {
  app.once('gpu-info-update', () => {
    const status = app.getGPUFeatureStatus()
    const gpuCompositing = status.gpu_compositing ?? 'unknown'
    const rasterization = status.rasterization ?? 'unknown'
    log.info(
      `[Linux graphics] hardwareAcceleration=${app.isHardwareAccelerationEnabled()}, ` +
      `gpuCompositing=${gpuCompositing}, rasterization=${rasterization}`,
    )
    if (gpuCompositing.includes('software') || gpuCompositing.includes('disabled')) {
      log.warn('[Linux graphics] GPU compositing is unavailable; try --use-gl=desktop or --ozone-platform=x11')
    }
  })
}


// https://github.com/electron/electron/issues/16809
void app.whenReady().then(() => {
  isLinux ? setTimeout(init, 300) : init()
})
