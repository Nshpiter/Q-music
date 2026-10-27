import Section from '../components/Section'
import BackgroundPlayback from './Player/BackgroundPlayback'
import IsShowNotificationImage from './Player/IsShowNotificationImage'
import IsHandleAudioFocus from './Player/IsHandleAudioFocus'
import IsEnableAudioOffload from './Player/IsEnableAudioOffload'
import { useI18n } from '@/lang'

export default () => {
  const t = useI18n()
  return <Section title={t('setting_background')}><BackgroundPlayback /><IsShowNotificationImage /><IsHandleAudioFocus /><IsEnableAudioOffload /></Section>
}
