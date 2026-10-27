import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Button from './common/Button'
import Text from './common/Text'
import { Icon } from './common/Icon'
import { getDownloadTasks, subscribeDownloadTasks } from '@/core/download/store'
import { setNavActiveId } from '@/core/common'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import LibraryShortcut from './LibraryShortcut'

const summarize = (tasks: ReturnType<typeof getDownloadTasks>) => ({
  active: tasks.filter(task => task.status == 'run' || task.status == 'waiting').length,
  completed: tasks.filter(task => task.status == 'completed').length,
  error: tasks.filter(task => task.status == 'error').length,
})

export default ({ compact = false }: { compact?: boolean }) => {
  const t = useI18n()
  const theme = useTheme()
  const [counts, setCounts] = useState(() => summarize(getDownloadTasks()))
  useEffect(() => subscribeDownloadTasks(tasks => {
    const next = summarize(tasks)
    setCounts(current => current.active == next.active && current.completed == next.completed && current.error == next.error ? current : next)
  }), [])
  const status = counts.active ? t('download_entry_active', { count: counts.active })
    : counts.error ? t('download_entry_error', { count: counts.error })
      : counts.completed ? t('download_entry_completed', { count: counts.completed }) : t('download_entry_hint')

  if (compact) return <LibraryShortcut icon="download-2" label={t('download_entry')} accessibilityLabel={`${t('download_entry')}，${status}`} badge={counts.active ? counts.active > 99 ? '99+' : String(counts.active) : counts.error ? '!' : undefined} onPress={() => { setNavActiveId('download') }} />

  return <Button accessibilityLabel={`${t('download_entry')}，${status}`} onPress={() => { setNavActiveId('download') }} style={[styles.entry, { backgroundColor: theme['q-surface-raised'], borderColor: theme['q-outline'] }]}>
    <View style={[styles.icon, { backgroundColor: theme['q-surface-tint'] }]}><Icon accessible={false} name="download-2" rawSize={21} color={theme['q-accent-text']} /></View>
    <View style={styles.text}>
      <Text size={14} color={theme['q-text-primary']} style={{ fontWeight: '600' }}>{t('download_entry')}</Text>
      <Text size={11} color={theme['q-text-secondary']} numberOfLines={2}>{status}</Text>
    </View>
    <Icon accessible={false} name="chevron-right" rawSize={17} color={theme['q-text-secondary']} />
  </Button>
}

const styles = StyleSheet.create({
  entry: { minHeight: 66, paddingHorizontal: 14, paddingVertical: 10, gap: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center' },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 3 },
})
