import Section from '../components/Section'
import LyricFontSelector from '@/components/player/LyricFontSelector'
import IsShowLyricTranslation from './Player/IsShowLyricTranslation'
import IsShowLyricRoma from './Player/IsShowLyricRoma'
import IsS2T from './Player/IsS2T'
import StatusBarLyric from './Player/StatusBarLyric'
import IsShowBluetoothLyric from './Player/IsShowBluetoothLyric'
import IsShowBluetoothFullLyric from './Player/IsShowBluetoothFullLyric'
import LegacyOverlayLyric from './LegacyOverlayLyric'
import { useI18n } from '@/lang'

export default () => {
  const t = useI18n()
  return <>
    <Section title={t('setting_lyrics')}><LyricFontSelector /><IsShowLyricTranslation /><IsShowLyricRoma /><IsS2T /></Section>
    <Section title={t('setting_lyrics_external')}><StatusBarLyric /><IsShowBluetoothLyric /><IsShowBluetoothFullLyric /></Section>
    <LegacyOverlayLyric />
  </>
}
