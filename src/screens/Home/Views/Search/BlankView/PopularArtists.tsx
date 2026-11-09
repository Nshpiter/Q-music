import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { getPopularArtists } from '@/core/popularArtists'
import type { PopularArtist } from '@/utils/popularArtists'

export default ({ onSearch }: { onSearch: (keyword: string) => void }) => {
  const theme = useTheme()
  const t = useI18n()
  const [artists, setArtists] = useState<PopularArtist[]>([])
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    void getPopularArtists().then(list => { if (active) setArtists(list) }).catch(() => {}).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [retry])
  return <View style={{ marginTop: 22, gap: 12 }}>
    <Text size={19} style={{ fontWeight: '700' }}>{t('home_hot_artists')}</Text>
    <Text size={12} color={theme['q-text-secondary']}>{t('home_hot_artists_source')}</Text>
    {artists.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 10 }}>
      {artists.map(artist => <Button key={artist.id} onPress={() => { onSearch(artist.name) }} style={{ width: 88, padding: 4, borderRadius: 16, alignItems: 'center', gap: 10 }}>
        <Image url={artist.picture} style={{ width: 80, height: 80, borderRadius: 40 }} />
        <Text size={12} numberOfLines={1}>{artist.name}</Text>
      </Button>)}
    </ScrollView> : loading ? <Text size={12} color={theme['q-text-secondary']}>{t('loading')}</Text> : <Button onPress={() => { setRetry(value => value + 1) }} style={{ minHeight: 44, justifyContent: 'center', borderRadius: 12, paddingHorizontal: 14, backgroundColor: theme['q-surface-tint'] }}><Text size={12} color={theme['q-accent-text']}>{t('discovery_failed')} · {t('list_retry')}</Text></Button>}
  </View>
}
