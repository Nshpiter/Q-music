import { NativeEventEmitter, NativeModules } from 'react-native'

export interface SettingsBackEvent {
  phase: 'start' | 'progress' | 'cancel' | 'commit'
  progress: number
  edge: number
}

const { UtilsModule } = NativeModules
export const onSettingsBack = (handler: (event: SettingsBackEvent) => void) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const emitter = new NativeEventEmitter(UtilsModule)
  const subscription = emitter.addListener('settings-back', handler)
  return () => { subscription.remove() }
}
