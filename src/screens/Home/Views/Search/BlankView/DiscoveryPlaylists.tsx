import { useEffect, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import Skeleton from '@/components/common/Skeleton'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { discoveryChoices, getDiscoveryPlaylists } from '@/core/discoveryPlaylists'
import type { DiscoveryPlaylist, DiscoveryProvider } from '@/utils/discoveryPlaylists'
import { pushSonglistDetailScreen } from '@/navigation/navigation'
import commonState from '@/store/common/state'

export default ({ provider }: { provider: DiscoveryProvider }) => {
  const theme = useTheme()
  const t = useI18n()
  const [choice, setChoice] = useState('hot')
  const [page, setPage] = useState(1)
  const [offset, setOffset] = useState(0)
  const [width, setWidth] = useState(0)
  const [list, setList] = useState<DiscoveryPlaylist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [hasNext, setHasNext] = useState(false)
  const [retry, setRetry] = useState(0)
  const lastOpen = useRef(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    setList([])
    void getDiscoveryPlaylists(provider, choice, page).then(result => {
      if (!active) return
      setList(result.list)
      setOffset(previous => previous < 0 ? Math.max(0, Math.floor((result.list.length - 1) / 6) * 6) : previous)
      setHasNext(result.list.length > 0 && page * result.limit < result.total)
    }).catch(() => { if (active) { setError(true); setHasNext(false) } }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [provider, choice, page, retry])
  const columns = width >= 900 ? 6 : width >= 560 ? 3 : 2
  const cardWidth = Math.max(0, (width - 12 * (columns - 1)) / columns)
  const open = (item: DiscoveryPlaylist) => {
    if (!commonState.componentIds.home || Date.now() - lastOpen.current < 800) return
    lastOpen.current = Date.now()
    pushSonglistDetailScreen(commonState.componentIds.home, item)
  }
  return <View style={styles.section} onLayout={event => { setWidth(event.nativeEvent.layout.width) }}>
    <View style={styles.heading}>
      <Text size={19} style={styles.title} color={theme['q-text-primary']}>{t('discovery_collections')}</Text>
      <View style={styles.paging}>
        <Button disabled={loading || (page == 1 && offset == 0)} style={styles.pageButton} onPress={() => { if (offset > 0) setOffset(offset - 6); else { setOffset(-1); setPage(page - 1) } }}><Text size={12} color={theme['q-accent-text']}>{t('discovery_previous')}</Text></Button>
        <Button disabled={loading || (!hasNext && offset + 6 >= list.length)} style={styles.pageButton} onPress={() => { if (offset + 6 < list.length) setOffset(offset + 6); else { setOffset(0); setPage(page + 1) } }}><Text size={12} color={theme['q-accent-text']}>{t('discovery_next')}</Text></Button>
      </View>
    </View>
    <Text size={12} style={styles.hint} color={theme['q-text-secondary']}>{t('discovery_collections_hint')}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choices}>
      {discoveryChoices[provider].map(option => <Button key={option.id} accessibilityRole="tab" accessibilityState={{ selected: choice == option.id }} style={[styles.choice, { backgroundColor: choice == option.id ? theme['q-surface-tint'] : theme['q-surface-raised'], borderColor: choice == option.id ? theme['q-accent'] : 'transparent' }]} onPress={() => { setChoice(option.id); setPage(1); setOffset(0) }}><Text size={12} color={choice == option.id ? theme['q-accent-text'] : theme['q-text-secondary']}>{t(option.label)}</Text></Button>)}
    </ScrollView>
    {loading ? <View key="loading" style={styles.grid} accessible accessibilityLabel={t('list_loading')}>
      {[0, 1, 2, 3, 4, 5].map(index => <View key={index} style={{ width: cardWidth }}><Skeleton width={cardWidth} height={cardWidth} radius={14} /><Skeleton width="85%" height={12} style={styles.skeletonText} /><Skeleton width="48%" height={10} style={styles.skeletonText} /></View>)}
    </View> : error || !list.length ? <View key="empty" style={styles.empty}>
      <Text size={13} color={theme['q-text-secondary']}>{t(error ? 'discovery_failed' : 'discovery_empty')}</Text>
      <Button style={[styles.retry, { backgroundColor: theme['q-surface-tint'] }]} onPress={() => { setRetry(retry + 1) }}><Text size={13} color={theme['q-accent-text']}>{t('list_retry')}</Text></Button>
    </View> : <View key="content" style={styles.grid}>{list.slice(offset, offset + 6).map(item => <Button key={`${item.source}:${item.id}`} accessibilityLabel={`${t('discovery_playlist')} · ${item.name}`} style={[styles.card, { width: cardWidth }]} onPress={() => { open(item) }}>
      <View><Image url={item.img} style={{ width: cardWidth, height: cardWidth, borderRadius: 14 }} /><View style={styles.chevron}><Icon name="chevron-right" rawSize={18} color="#fff" /></View></View>
      <Text numberOfLines={2} size={13} style={styles.name} color={theme['q-text-primary']}>{item.name}</Text>
      <Text numberOfLines={1} size={11} color={theme['q-text-secondary']}>{item.total ? t('discovery_track_count', { count: item.total }) : item.author || t('discovery_playlist')}</Text>
    </Button>)}</View>}
  </View>
}

const styles = createStyle({
  section: { marginTop: 22 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  title: { fontWeight: '700' },
  paging: { flexDirection: 'row', gap: 2 },
  pageButton: { minHeight: 44, paddingHorizontal: 8, borderRadius: 22, justifyContent: 'center' },
  hint: { marginBottom: 14, lineHeight: 19 },
  choices: { gap: 8, paddingBottom: 16 },
  choice: { minHeight: 40, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 20, borderWidth: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, rowGap: 20 },
  card: { borderRadius: 14, paddingBottom: 4, overflow: 'hidden' },
  chevron: { position: 'absolute', right: 8, bottom: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.28)', alignItems: 'center', justifyContent: 'center' },
  name: { fontWeight: '600', marginTop: 9, marginBottom: 5, lineHeight: 20 },
  empty: { minHeight: 180, gap: 16, alignItems: 'center', justifyContent: 'center' },
  retry: { minHeight: 44, paddingHorizontal: 20, borderRadius: 22, justifyContent: 'center' },
  skeletonText: { marginTop: 10 },
})
