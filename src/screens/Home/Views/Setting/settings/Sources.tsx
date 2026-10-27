import Section from '../components/Section'
import Source from './Basic/Source'
import SourceName from './Basic/SourceName'
import { useI18n } from '@/lang'

export default () => {
  const t = useI18n()
  return <Section title={t('setting_sources')}><Source /><SourceName /></Section>
}
