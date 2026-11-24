import { useCallback, useEffect, useRef, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import Button from '@/components/common/Button'
import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import ContentState from '@/components/common/ContentState'
import { useDockInset } from '@/components/common/DockInset'
import { Icon } from '@/components/common/Icon'
import { firstAlbumPages, searchAlbumPages, type Album, type AlbumSource } from '@/core/search/albums'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'

const keyFor = (album: Album) => `${album.source}:${album.id}`

export default ({ text, source, onOpen }: { text: string, source: LX.OnlineSource | 'all', onOpen: (album: Album) => void }) => {
  const t = useI18n()
  const theme = useTheme()
  const bottom = useDockInset()
  const [albums, setAlbums] = useState<Album[]>([])
  const [failed, setFailed] = useState<AlbumSource[]>([])
  const [loading, setLoading] = useState(true)
  const pages = useRef(firstAlbumPages(source))
  const pending = useRef<symbol | null>(null)
  const load = useCallback(async() => {
    if (pending.current != null || !pages.current.length) return
    const current = Symbol('album-page')
    pending.current = current
    setLoading(true)
    try {
      const result = await searchAlbumPages(text, pages.current)
      if (current != pending.current) return
      pages.current = result.next
      setFailed(result.failed)
      setAlbums(previous => {
        const unique = new Map(previous.map(album => [keyFor(album), album]))
        for (const album of result.list) unique.set(keyFor(album), album)
        return [...unique.values()]
      })
    } finally {
      if (current == pending.current) {
        pending.current = null
        setLoading(false)
      }
    }
  }, [text])

  useEffect(() => {
    void load()
    return () => { pending.current = null }
  }, [load])

  if (!albums.length && (loading || failed.length || !pages.current.length)) {
    return <ContentState status={loading ? 'loading' : failed.length ? 'error' : 'empty'} onRetry={() => { void load() }} />
  }
  return <FlatList
    data={albums}
    keyExtractor={keyFor}
    contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: bottom + 12 }}
    renderItem={({ item }) => <Button accessibilityRole="button" style={styles.row} onPress={() => { onOpen(item) }}>
      <Image url={item.pic} style={styles.cover} />
      <View style={styles.copy}>
        <Text size={15} numberOfLines={1} style={styles.title}>{item.name}</Text>
        <Text size={12} numberOfLines={1} color={theme['q-text-secondary']}>{[item.singer, item.date?.slice(0, 4)].filter(Boolean).join(' · ')}</Text>
        <Text size={11} numberOfLines={1} color={theme['q-text-secondary']}>{[t(`source_real_${item.source}`), item.count > 0 ? t('album_track_count', { count: item.count }) : ''].filter(Boolean).join(' · ')}</Text>
      </View>
      <Icon accessible={false} name="chevron-right" rawSize={16} color={theme['q-text-secondary']} />
    </Button>}
    ListFooterComponent={pages.current.length ? <View style={styles.footer}>
      {failed.length ? <Text size={12} color={theme['q-text-secondary']}>{t('album_partial', { sources: failed.map(id => t(`source_real_${id}`)).join('、') })}</Text> : null}
      <Button accessibilityRole="button" disabled={loading} style={styles.more} onPress={() => { void load() }}>
        <Text size={13} color={theme['q-accent-text']}>{t(loading ? 'list_loading' : failed.length ? 'list_retry' : 'album_more')}</Text>
      </Button>
    </View> : null}
  />
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 7, gap: 12, borderRadius: 12 },
  cover: { width: 56, height: 56, borderRadius: 8 },
  copy: { flex: 1, gap: 2 },
  title: { fontWeight: '600' },
  footer: { alignItems: 'center', paddingTop: 6 },
  more: { justifyContent: 'center', minHeight: 44, paddingHorizontal: 20 },
})
