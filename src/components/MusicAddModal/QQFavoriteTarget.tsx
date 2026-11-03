import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import SourceLogo from '@/components/SourceLogo'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { useTheme } from '@/store/theme/hook'
import { useI18n, type Message } from '@/lang'
import { addQQFavoriteSong } from '@/core/musicAccount/qqFavorite'
import { addNeteaseFavoriteSong } from '@/core/musicAccount/neteaseFavorite'
import { createKugouFavoriteAction } from '@/core/musicAccount/kugouFavorite'
import type { KugouFavoriteResult } from '@/utils/kugouFavorite'
import { useKugouVerification } from './useKugouVerification'
import { syncQQFavorites } from '@/core/musicAccount/autoSync'
import type { QQFavoriteResult } from '@/types/qqFavorite'
import PlaylistDestination from './PlaylistDestination'

export default ({ musicInfo, disabled, onBusy, onLogin }: {
  musicInfo: LX.Music.MusicInfo
  disabled: boolean
  onBusy: (busy: boolean) => void
  onLogin: (provider: 'tx' | 'wy' | 'kg') => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  const [result, setResult] = useState<QQFavoriteResult | KugouFavoriteResult>()
  const { present, dialog } = useKugouVerification()
  const addKugouFavoriteSong = useMemo(() => createKugouFavoriteAction(present), [present])
  const [working, setWorking] = useState(false)
  const [playlistId, setPlaylistId] = useState('')
  const results = useRef(new Map<string, QQFavoriteResult | KugouFavoriteResult | undefined>())
  const [syncMessage, setSyncMessage] = useState<keyof Message>()
  const mounted = useRef(true)
  const running = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const provider = musicInfo.source == 'wy' ? 'wy' : musicInfo.source == 'kg' ? 'kg' : 'tx'
  const prefix = provider == 'wy' ? 'wy_favorite' : provider == 'kg' ? 'kg_favorite' : 'qq_favorite'
  const supported = musicInfo.source == 'kg' ? /^[a-f0-9]{32}$/i.test(String(musicInfo.meta.hash)) : musicInfo.source == 'wy' ? /^[1-9]\d*$/.test(String(musicInfo.meta.songId)) : musicInfo.source == 'tx' && /^[a-zA-Z0-9]{1,64}$/.test(String(musicInfo.meta.songId))
  const checking = result?.status == 'unknown' || result?.status == 'unconfirmed' || result?.status == 'verification_expired'
  const needsVerify = provider == 'kg' && !!result?.status.startsWith('verification_') && result.status != 'verification_expired' && result.status != 'verification_unsupported'
  const needsLogin = result?.status == 'login_required' || result?.status == 'verification_unsupported'
  const actionLabel: keyof Message = working ? `${prefix}_working` : result?.status == 'added' ? 'favorite_action_added' : needsLogin ? `${prefix}_login` : needsVerify ? 'kg_favorite_verify' : checking ? `${prefix}_check` : 'favorite_action_add'
  const buttonLabel: keyof Message = working ? 'favorite_action_working' : needsLogin ? 'favorite_action_login' : needsVerify ? 'favorite_action_verify' : checking ? 'favorite_action_check' : 'favorite_action_add'
  const submit = async() => {
    if (running.current || disabled || !supported || result?.status == 'added') return
    if (needsLogin) { onLogin(provider); return }
    running.current = true
    setWorking(true)
    onBusy(true)
    try {
      const next = await (musicInfo.source == 'kg'
        ? addKugouFavoriteSong({ hash: musicInfo.meta.hash, name: [musicInfo.singer, musicInfo.name].filter(Boolean).join(' - '), albumId: musicInfo.meta.albumId === '' ? undefined : musicInfo.meta.albumId, playlistId: playlistId || undefined, action: needsVerify ? 'verify' : checking ? 'check' : 'add' })
        : provider == 'wy'
          ? addNeteaseFavoriteSong({ songId: String(musicInfo.meta.songId), playlistId: playlistId || undefined, action: checking ? 'check' : 'add' })
          : addQQFavoriteSong({ songMid: String(musicInfo.meta.songId), playlistId: playlistId || undefined, action: checking ? 'check' : 'add' }))
      if (mounted.current) setResult(checking && next.status == 'unavailable' ? { ...next, status: 'unknown' } : next)
      const qqResult = next as QQFavoriteResult
      if (provider == 'tx' && !playlistId && next.status == 'added' && qqResult.owner && qqResult.accountId) {
        if (mounted.current) setSyncMessage('list_sync_favorite_pending')
        void syncQQFavorites(qqResult.owner, qqResult.accountId).then(sync => {
          if (mounted.current) setSyncMessage(sync.failed ? 'list_sync_favorite_failed' : sync.total ? 'list_sync_favorite_done' : 'list_sync_favorite_unlinked')
        }).catch(() => { if (mounted.current) setSyncMessage('list_sync_favorite_failed') })
      }
    } catch { if (mounted.current) setResult({ status: 'unknown' }) } finally {
      running.current = false
      if (mounted.current) { setWorking(false); onBusy(false) }
    }
  }
  if (!['tx', 'wy', 'kg'].includes(musicInfo.source)) return null
  return <View style={{ marginHorizontal: 16, marginBottom: 22 }}>
    <Text size={11} color={theme['q-text-secondary']} style={{ marginBottom: 10, fontWeight: '600' }}>{t('favorite_platform_section')}</Text>
    <View style={{ padding: 14, borderRadius: 16, backgroundColor: theme['q-surface-raised'], borderWidth: 0.5, borderColor: theme['q-outline'], gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <SourceLogo source={provider} size={28} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text size={14} style={{ fontWeight: '600' }}>{t('favorite_destination_title')}</Text>
          <Text size={11} color={theme['q-text-secondary']} style={{ lineHeight: 17 }}>{t('favorite_destination_hint')}</Text>
        </View>
      {result?.status == 'added' ? <View accessible accessibilityLabel={t(actionLabel)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Icon accessible={false} name="check" rawSize={15} color={theme['q-accent-text']} /><Text size={12} color={theme['q-accent-text']}>{t('favorite_action_added')}</Text>
      </View> : <Button accessibilityLabel={t(actionLabel)} accessibilityState={{ busy: working }} disabled={disabled || working || !supported} onPress={() => { void submit() }} style={{ minHeight: 44, maxWidth: 112, flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, borderRadius: 12, backgroundColor: theme['q-surface-tint'] }}>
        {working ? <ActivityIndicator size="small" color={theme['q-accent-text']} /> : null}
        <Text size={12} color={theme['q-accent-text']} style={{ flexShrink: 1, textAlign: 'center' }}>{t(buttonLabel)}</Text>
      </Button>
      }
      </View>
      <PlaylistDestination provider={provider} selected={playlistId} disabled={disabled || working} onLogin={() => { onLogin(provider) }} onSelect={id => {
        results.current.set(playlistId, result)
        setPlaylistId(id); setResult(results.current.get(id)); setSyncMessage(undefined)
      }} />
      {result != null || !supported ? <View style={{ borderTopWidth: 0.5, borderTopColor: theme['q-outline'], paddingTop: 10 }}>
        <Text size={12} accessibilityLiveRegion="polite" style={{ lineHeight: 18 }} color={theme['q-text-secondary']}>{t(result ? `${['added', 'unconfirmed', 'not_found'].includes(result.status) ? 'favorite_destination' : result.status.startsWith('verification_') ? 'kg_favorite' : prefix}_${result.status}` as keyof Message : `${prefix}_supported`)}{result?.code != null ? ` ${t(`${prefix}_error_code`, { code: result.code })}` : ''}</Text>
        {syncMessage ? <Text size={11} accessibilityLiveRegion="polite" style={{ lineHeight: 17, marginTop: 6 }} color={theme['q-text-secondary']}>{t(syncMessage)}</Text> : null}
      </View> : null}
    </View>
    {dialog}
  </View>
}
