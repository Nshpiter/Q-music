import { SETTINGS_SEARCH_ITEMS } from './searchItems'
import Section from './components/Section'
import { useI18n } from '@/lang'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { selectSettingSection } from '@/store/setting/navigation'

export default ({ id }: { id: string }) => {
  const t = useI18n()
  const item = SETTINGS_SEARCH_ITEMS.find(item => item.id == id)
  if (!item) return null
  const Control = item.component
  return <>
    {item.standalone ? <Control /> : <Section title={t(`setting_${item.section}`)}><Control /></Section>}
    <Button style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 }} onPress={() => { selectSettingSection(item.section) }}><Text size={13}>{t('settings_search_more', { section: t(`setting_${item.section}`) })}</Text></Button>
  </>
}
