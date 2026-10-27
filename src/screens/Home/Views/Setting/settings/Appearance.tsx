import Section from '../components/Section'
import Theme from './Theme'
import FontSize from './Basic/FontSize'
import PredictiveBack from './Basic/PredictiveBack'
import DisplayMode from './Basic/DisplayMode'
import LargeScreenNavigation from './Basic/LargeScreenNavigation'
import { useI18n } from '@/lang'

export default () => {
  const t = useI18n()
  return <Section title={t('setting_appearance')}><DisplayMode /><LargeScreenNavigation /><PredictiveBack /><Theme /><FontSize /></Section>
}
