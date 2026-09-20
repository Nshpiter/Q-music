import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { confirmDialog } from '@/utils/tools'
import { setActiveList } from '@/core/list'
import { setNavActiveId } from '@/core/common'
import { getAccountPlaylists, openPlaylistSession, type AccountPlaylist, type PlaylistSession } from '@/core/musicAccount/playlists'
import { findAccountList, syncAccountPlaylist } from '@/core/musicAccount/playlistSync'
import type { MusicAccountProvider } from '@/core/musicAccount'

export default ({ provider, onLogin, onOpenLibrary, onBusyChange }: {
  provider: MusicAccountProvider
  onLogin: () => void
  onOpenLibrary: () => void
  onBusyChange: (busy: boolean) => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  const [lists, setLists] = useState<AccountPlaylist[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | 'created' | 'favorite'>('all')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [lastListId, setLastListId] = useState('')
  const session = useRef<PlaylistSession>()
  const request = useRef<AbortController>()
  const running = useRef(false)
  const mounted = useRef(true)
  const errorText = useCallback((reason: unknown) => {
    const code = reason instanceof Error ? reason.message : ''
    return t(code == 'login_required' || code == 'account_changed' ? 'account_lists_login_expired' : code == 'incomplete' ? 'account_lists_incomplete' : 'account_lists_failed')
  }, [t])

  const load = useCallback(async() => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError('')
    setMessage('')
    setLists([])
    session.current = undefined
    setSelected(new Set())
    try {
      const account = await openPlaylistSession(provider, controller.signal)
      const playlists = await getAccountPlaylists(account, controller.signal)
      if (controller.signal.aborted || !mounted.current) return
      session.current = account
      setLists(playlists)
    } catch (reason) {
      if (!controller.signal.aborted && mounted.current) setError(errorText(reason))
    } finally {
      if (!controller.signal.aborted && mounted.current) setLoading(false)
    }
  }, [provider, errorText])

  useEffect(() => {
    mounted.current = true
    void load()
    return () => { mounted.current = false; request.current?.abort() }
  }, [load])

  const sync = async() => {
    const account = session.current
    if (!account || running.current || !selected.size) return
    running.current = true
    setBusy(true)
    onBusyChange(true)
    const controller = new AbortController()
    request.current = controller
    try {
      const targets = lists.filter(item => selected.has(item.id))
      if (targets.some(item => findAccountList(account, item.id))) {
        const confirmed = await confirmDialog({ message: t('account_lists_replace_confirm') })
        if (!confirmed || !mounted.current) return
      }
      setError('')
      let success = 0
      let failed = 0
      let failure = ''
      for (const [index, playlist] of targets.entries()) {
        if (controller.signal.aborted || !mounted.current) break
        setMessage(t('account_lists_progress', { current: index + 1, total: targets.length, name: playlist.name }))
        try {
          const result = await syncAccountPlaylist(account, playlist, controller.signal)
          success++
          if (mounted.current) {
            setLastListId(result.id)
            setSelected(current => { const next = new Set(current); next.delete(playlist.id); return next })
          }
        } catch (reason) {
          if (controller.signal.aborted) break
          failed++
          failure = errorText(reason)
        }
      }
      if (mounted.current) {
        setMessage(t('account_lists_result', { success, failed }))
        setError(failure)
      }
    } catch (reason) {
      if (mounted.current && !controller.signal.aborted) setError(errorText(reason))
    } finally {
      running.current = false
      if (mounted.current) { setBusy(false); onBusyChange(false) }
    }
  }
  const visible = lists.filter(item => filter == 'all' || item.kind == filter)
  const allSelected = visible.length > 0 && visible.every(item => selected.has(item.id))

  return <View style={styles.container}>
    <View style={styles.heading}>
      <View style={styles.copy}>
        <Text size={23} style={styles.title}>{t('account_lists_title')}</Text>
        <Text size={12} color={theme['q-text-secondary']} style={styles.subtitle}>{t('account_lists_tip')}</Text>
      </View>
      <Button disabled={busy || loading} accessibilityLabel={t('account_lists_refresh')} onPress={() => { void load() }} style={styles.iconButton}>
        <Icon name="available_updates" size={20} color={theme['q-accent-text']} />
      </Button>
    </View>
    <View style={styles.filters}>
      {(['all', 'created', 'favorite'] as const).map(kind => <Button key={kind} disabled={busy} accessibilityRole="tab" accessibilityState={{ selected: filter == kind }} onPress={() => { setFilter(kind) }} style={[styles.chip, { backgroundColor: filter == kind ? theme['q-surface-tint'] : 'transparent' }]}>
        <Text size={12} color={filter == kind ? theme['q-accent-text'] : theme['q-text-secondary']}>{t(`account_lists_${kind}`)}</Text>
      </Button>)}
      <Button disabled={busy || loading || !!error || !visible.length} style={styles.selectAll} onPress={() => { setSelected(current => { const next = new Set(current); visible.forEach(item => { if (allSelected) next.delete(item.id); else next.add(item.id) }); return next }) }}>
        <Text size={12} color={theme['q-accent-text']}>{t(allSelected ? 'account_lists_deselect' : 'account_lists_select_all')}</Text>
      </Button>
    </View>
    {loading ? <View style={styles.empty}><ActivityIndicator color={theme['q-accent']} /><Text size={13} style={styles.subtitle}>{t('account_lists_loading')}</Text></View> : <FlatList
      data={visible}
      keyExtractor={item => item.id}
      extraData={{ selected, busy, lastListId }}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<View style={styles.empty}><Icon name="album" size={36} color={theme['q-text-secondary']} /><Text size={13} style={styles.emptyText}>{error || t('account_lists_empty')}</Text></View>}
      renderItem={({ item }) => {
        const checked = selected.has(item.id)
        const imported = session.current && findAccountList(session.current, item.id)
        return <Button disabled={busy} ripple={null} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={`${item.name}，${item.count}`} onPress={() => { setSelected(current => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next }) }} style={[styles.row, { backgroundColor: checked ? theme['q-surface-tint'] : theme['q-surface-raised'], borderColor: checked ? theme['q-accent'] : theme['q-outline'] }]}>
          <Image url={item.cover} style={styles.cover} />
          <View style={styles.copy}>
            <Text size={14} numberOfLines={2} style={styles.rowTitle}>{item.name}</Text>
            <Text size={11} color={theme['q-text-secondary']} style={styles.subtitle}>{t(`account_lists_${item.kind}`)} · {t('account_lists_count', { count: item.count })}{imported ? ` · ${t('account_lists_imported')}` : ''}</Text>
          </View>
          <View style={[styles.checkbox, { backgroundColor: checked ? theme['q-accent'] : 'transparent', borderColor: checked ? theme['q-accent'] : theme['q-outline'] }]}>{checked ? <Icon name="check" size={14} color={theme['q-on-accent']} /> : null}</View>
        </Button>
      }}
    />}
    <View style={[styles.footer, { borderColor: theme['q-outline'], backgroundColor: theme['c-main-background'] }]}>
      {message ? <Text accessibilityLiveRegion="polite" size={12} style={styles.feedback}>{message}</Text> : null}
      {error ? <View><Text accessibilityLiveRegion="polite" size={12} color={theme['q-text-secondary']} style={styles.feedback}>{error}</Text><View style={styles.actions}><Button disabled={busy} onPress={() => { void load() }} style={styles.smallButton}><Text size={12} color={theme['q-accent-text']}>{t('list_retry')}</Text></Button><Button disabled={busy} onPress={onLogin} style={styles.smallButton}><Text size={12} color={theme['q-accent-text']}>{t('account_lists_relogin')}</Text></Button></View></View> : null}
      <View style={styles.actions}>
        {lastListId ? <Button disabled={busy} style={styles.library} onPress={() => { setActiveList(lastListId); setNavActiveId('nav_love'); onOpenLibrary() }}><Text size={13} color={theme['q-accent-text']}>{t('account_lists_view')}</Text></Button> : null}
        <Button disabled={busy || loading || !selected.size} onPress={() => { void sync() }} style={[styles.submit, { backgroundColor: theme['q-accent'] }]}>
          {busy ? <ActivityIndicator size="small" color={theme['q-on-accent']} /> : null}<Text size={14} color={theme['q-on-accent']} style={styles.rowTitle}>{t(busy ? 'account_lists_syncing' : 'account_lists_submit', { count: selected.size })}</Text>
        </Button>
      </View>
    </View>
  </View>
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heading: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, gap: 8 },
  copy: { flex: 1, minWidth: 0 },
  title: { fontWeight: '700' },
  subtitle: { marginTop: 5, lineHeight: 18 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  filters: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 2 },
  chip: { minHeight: 40, paddingHorizontal: 12, borderRadius: 20, justifyContent: 'center' },
  selectAll: { marginLeft: 'auto', minHeight: 44, paddingHorizontal: 10, justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 16, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, marginBottom: 10, overflow: 'hidden' },
  rowTitle: { fontWeight: '600' },
  cover: { width: 52, height: 52, borderRadius: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyText: { textAlign: 'center', lineHeight: 21, marginTop: 8 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, padding: 16, gap: 10 },
  feedback: { lineHeight: 18 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  smallButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 8 },
  library: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  submit: { flex: 1, minHeight: 48, paddingHorizontal: 12, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
})
