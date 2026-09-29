import Section from '../../components/Section'
import CloudLibrary from '../Sync/CloudLibrary'
import { useI18n } from '@/lang'

export default () => {
  const t = useI18n()

  return <Section title={t('setting_cloud')}><CloudLibrary /></Section>
}
