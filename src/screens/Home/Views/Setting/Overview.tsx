import { StyleSheet, View } from 'react-native'
import { useState } from 'react'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import DownloadLocationEntry from '@/components/DownloadLocationEntry'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { getSettingSearchQuery, setSettingSearchQuery, selectSettingSection } from '@/store/setting/navigation'
import SettingsSearch from './SettingsSearch'
import AccountEntry from './AccountEntry'
import type { SettingScreenIds } from './Main'

const groups = [
  { title: 'setting_group_personal', items: [['appearance', 'palette'], ['sources', 'slider'], ['basic', 'setting']] },
  { title: 'setting_group_listening', items: [['player', 'play-outline'], ['lyrics', 'lyric-on'], ['background', 'shield']] },
  { title: 'setting_group_library', items: [['search', 'search-2'], ['list', 'album'], ['cloud', 'cloud-library'], ['sync', 'available_updates'], ['backup', 'save']] },
  { title: 'setting_group_app', items: [['other', 'tool'], ['version', 'available_updates'], ['about', 'help']] },
] as const

export default () => {
  const theme = useTheme()
  const t = useI18n()
  const [query, setQuery] = useState(getSettingSearchQuery)
  return <>
    <SettingsSearch query={query} onChange={value => { setQuery(value); setSettingSearchQuery(value) }} />
    {!query.trim() ? <>
    <View style={styles.shortcuts}>
      <DownloadLocationEntry card />
      <AccountEntry />
    </View>
    {groups.map(group => <View key={group.title} style={styles.group}>
      <Text size={12} style={styles.groupTitle} color={theme['q-text-secondary']}>{t(group.title)}</Text>
      <View style={[styles.card, { backgroundColor: theme['q-surface-raised'], borderColor: theme['q-outline'] }]}>
        {group.items.map(([id, icon], index) => <Button key={id} pressScale={0.985} onPress={() => { selectSettingSection(id as SettingScreenIds) }} style={styles.row}>
          <Icon accessible={false} name={icon} rawSize={20} color={theme['q-text-secondary']} />
          <View style={[styles.rowContent, { borderTopWidth: index ? StyleSheet.hairlineWidth : 0, borderTopColor: theme['q-outline'] }]}>
            <View style={styles.label}>
              <Text size={14} color={theme['q-text-primary']}>{t(`setting_${id}`)}</Text>
              <Text size={11} color={theme['q-text-secondary']} style={styles.description}>{t(`setting_summary_${id}`)}</Text>
            </View>
            <Icon accessible={false} name="chevron-right" rawSize={16} color={theme['q-text-secondary']} />
          </View>
        </Button>)}
      </View>
    </View>)}
    </> : null}
  </>
}

const styles = StyleSheet.create({
  shortcuts: { gap: 10, marginBottom: 6 },
  group: { marginTop: 18 },
  groupTitle: { paddingHorizontal: 4, marginBottom: 8, fontWeight: '600' },
  card: { borderRadius: 16, padding: 4, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12, gap: 14 },
  rowContent: { flex: 1, minWidth: 0, minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingRight: 14 },
  label: { flex: 1, minWidth: 0, gap: 3 },
  description: { lineHeight: 17 },
})
