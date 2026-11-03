import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, View } from 'react-native'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { type AccountPlaylist } from '@/core/musicAccount/playlists'
import { getWritablePlaylists } from '@/core/musicAccount/playlistTargets'
import type { MusicAccountProvider } from '@/core/musicAccount/types'
import KugouVerifyButton from '@/components/KugouVerifyButton'

export default ({ provider, selected, disabled, onSelect, onLogin }: {
  provider: MusicAccountProvider
  selected: string
  disabled: boolean
  onSelect: (id: string) => void
  onLogin: () => void
}) => {
  const t = useI18n()
  const theme = useTheme()
  const [expanded, setExpanded] = useState(false)
  const [lists, setLists] = useState<AccountPlaylist[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<'login' | 'error' | 'verification'>()
  const revision = useRef(0)
  const controller = useRef<AbortController>()
  useEffect(() => () => { revision.current++; controller.current?.abort() }, [provider])
  const load = async() => {
    const current = ++revision.current
    controller.current?.abort()
    const request = controller.current = new AbortController()
    setLoading(true); setError(undefined)
    try {
      const next = await getWritablePlaylists(provider, request.signal)
      if (current == revision.current) {
        setLists(next)
        if (selected && !next.some(item => item.id == selected)) onSelect('')
      }
    } catch (err) {
      if (current == revision.current) setError(err instanceof Error && err.message == 'verification_required' ? 'verification' : err instanceof Error && err.message == 'login_required' ? 'login' : 'error')
    } finally { if (current == revision.current) setLoading(false) }
  }
  const select = (id: string) => { onSelect(id); setExpanded(false) }
  const row = (id: string, name: string) => <Button key={id} disabled={disabled || loading} accessibilityState={{ selected: selected == id }} onPress={() => { select(id) }} style={{ minHeight: 44, padding: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: selected == id ? theme['q-surface-tint'] : 'transparent' }}>
    <Text size={13} style={{ flex: 1 }}>{name}</Text>
    {selected == id ? <Icon name="check" rawSize={16} color={theme['q-accent-text']} /> : null}
  </Button>
  return <View style={{ gap: 6 }}>
    <Button disabled={disabled || loading} accessibilityState={{ expanded }} onPress={() => { setExpanded(!expanded); if (!expanded) void load() }} style={{ minHeight: 44, padding: 10, borderRadius: 10, borderWidth: 0.5, borderColor: theme['q-outline'], flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text size={13} numberOfLines={1} style={{ flex: 1 }}>{selected ? lists.find(list => list.id == selected)?.name ?? t('favorite_destination_retry') : t('favorite_destination_liked')}</Text>
      {loading ? <ActivityIndicator size="small" color={theme['q-accent-text']} /> : <Text size={14}>{expanded ? '⌃' : '⌄'}</Text>}
    </Button>
    {expanded ? <ScrollView nestedScrollEnabled style={{ maxHeight: 200, borderRadius: 10, borderWidth: 0.5, borderColor: theme['q-outline'] }} contentContainerStyle={{ padding: 4 }}>
      <Button disabled={disabled || loading} onPress={() => { void load() }} style={{ padding: 12, borderRadius: 10 }}><Text size={12} color={theme['q-accent-text']}>{loading ? t('bili_loading') : t('favorite_destination_retry')}</Text></Button>
      {row('', t('favorite_destination_liked'))}
      {lists.map(list => row(list.id, list.name))}
      {error ? <View style={{ padding: 8, gap: 6 }}><Text size={12} color={theme['q-text-secondary']}>{t(error == 'verification' ? 'list_sync_verification_required' : `favorite_destination_${error}`)}</Text><Button onPress={() => { if (error == 'login') onLogin(); else void load() }} style={{ padding: 10, borderRadius: 10 }}><Text size={13} color={theme['q-accent-text']}>{t(error == 'login' ? 'favorite_action_login' : 'favorite_destination_retry')}</Text></Button></View> : !loading && !lists.length ? <Text size={12} style={{ padding: 10 }} color={theme['q-text-secondary']}>{t('favorite_destination_empty')}</Text> : null}
    </ScrollView> : null}
    {expanded && provider == 'kg' && error == 'verification' ? <KugouVerifyButton disabled={disabled || loading} onVerified={() => { void load() }} /> : null}
  </View>
}
