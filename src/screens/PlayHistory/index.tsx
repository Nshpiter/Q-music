import { useEffect, useRef, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import PageContent from '@/components/PageContent'
import StatusBar from '@/components/common/StatusBar'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { Icon } from '@/components/common/Icon'
import PlayerBar from '@/components/player/PlayerBar'
import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'
import MusicAddModal, { type MusicAddModalType } from '@/components/MusicAddModal'
import { playHistory } from '@/core/playHistory'
import { playFromPage, playAllFromPage } from '@/core/player/selection'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'
import { pop } from '@/navigation'
import { toast } from '@/utils/tools'

export default ({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const [entries, setEntries] = useState(playHistory.snapshot().entries)
  const confirmRef = useRef<ConfirmAlertType>(null)
  const addRef = useRef<MusicAddModalType>(null)
  const run = (action: Promise<void>) => { void action.catch(() => { toast(t('play_history_failed')) }) }
  useEffect(() => {
    const unsubscribe = playHistory.subscribe(() => { setEntries(playHistory.snapshot().entries) })
    run(playHistory.load())
    return unsubscribe
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <PageContent>
    <StatusBar />
    <View style={[styles.header, { paddingTop: statusBarHeight }]}>
      <Button accessibilityLabel={t('back')} onPress={() => { void pop(componentId) }} style={styles.icon}><Icon name="chevron-left" size={22} color={theme['q-text-primary']} /></Button>
      <Text size={20} style={{ flex: 1, fontWeight: '700' }}>{t('play_history_title')}</Text>
      <Button disabled={!entries.length} onPress={() => confirmRef.current?.setVisible(true)} style={styles.icon}><Text size={13}>{t('play_history_clear')}</Text></Button>
    </View>
    <View style={styles.actions}>
      <Button disabled={!entries.length} style={[styles.playAll, { backgroundColor: theme['q-surface-tint'] }]} onPress={() => { run(playAllFromPage('play-history', entries.map(item => item.track))) }}><Text color={theme['q-accent-text']}>{t('play_all')} · {entries.length}</Text></Button>
    </View>
    <FlatList data={entries} keyExtractor={item => `${item.track.source}:${item.track.id}`} contentContainerStyle={{ paddingBottom: 24 }}
      ListEmptyComponent={<Text style={{ padding: 24 }} color={theme['q-text-secondary']}>{t('play_history_empty')}</Text>}
      renderItem={({ item, index }) => <View style={[styles.row, { borderBottomColor: theme['q-outline'] }]}>
        <Button style={styles.track} onPress={() => { run(playFromPage('play-history', entries.map(row => row.track), index)) }} onLongPress={() => addRef.current?.show({ musicInfo: item.track, listId: '', isMove: false })}>
          <Text size={15} numberOfLines={1}>{item.track.name}</Text>
          <Text size={12} color={theme['q-text-secondary']} numberOfLines={1}>{item.track.singer} · {t(item.track.source == 'local' ? 'history_source_local' : `source_real_${item.track.source}`)}</Text>
          <Text size={10} color={theme['q-text-secondary']}>{new Date(item.playedAt).toLocaleString()}</Text>
        </Button>
        <Button style={styles.icon} accessibilityLabel={t('play_history_remove', { name: item.track.name })} onPress={() => { run(playHistory.remove(item.track)) }}><Icon name="close" size={18} color={theme['q-text-secondary']} /></Button>
      </View>} />
    <PlayerBar />
    <MusicAddModal ref={addRef} />
    <ConfirmAlert ref={confirmRef} text={t('play_history_clear_confirm')} onConfirm={() => { confirmRef.current?.setVisible(false); run(playHistory.clear()) }} />
  </PageContent>
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, minHeight: 56, gap: 8 },
  icon: { minWidth: 48, minHeight: 48, paddingHorizontal: 10, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actions: { paddingHorizontal: 16, paddingBottom: 12 },
  playAll: { padding: 16, borderRadius: 16, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  track: { flex: 1, minWidth: 0, padding: 12, gap: 5, borderRadius: 14 },
})
