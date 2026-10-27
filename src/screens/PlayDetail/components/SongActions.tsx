import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'
import BottomSheet from '@/components/common/BottomSheet'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { Icon } from '@/components/common/Icon'
import MusicAddModal, { type MusicAddModalType } from '@/components/MusicAddModal'
import SourceLogo from '@/components/SourceLogo'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { usePlayMusicInfo, usePlayerMusicInfo } from '@/store/player/hook'
import playerState from '@/store/player/state'
import { downloadSelection } from '@/core/download/selection'
import { songArtists, type SongBrowseKind } from '@/core/music/songBrowse'
import { openSongSearch } from '@/core/search/openSongSearch'
import { shareMusic, toast } from '@/utils/tools'
import settingState from '@/store/setting/state'

type Page = 'menu' | SongBrowseKind
const Context = createContext<(page?: Page) => void>(() => {})
export const useSongActions = () => useContext(Context)

export const SongMoreButton = () => {
  const open = useSongActions()
  const theme = useTheme()
  const { musicInfo } = usePlayMusicInfo()
  return <Button accessibilityLabel={global.i18n.t('song_actions_title')} disabled={!musicInfo} onPress={() => { open() }} style={styles.iconButton}>
    <Icon name="dots-horizontal" rawSize={23} color={theme['q-text-primary']} />
  </Button>
}

export const SongMetadata = ({ album = false, size = 14 }: { album?: boolean, size?: number }) => {
  const open = useSongActions()
  const music = usePlayerMusicInfo()
  const theme = useTheme()
  const text = album ? music.album : music.singer
  if (!text) return null
  return <Button accessibilityRole="button" accessibilityLabel={`${global.i18n.t(album ? 'song_actions_album' : 'song_actions_artist')} · ${text}`} onPress={() => { open(album ? 'album' : 'artist') }} style={styles.metadata}>
    <Text size={size} numberOfLines={1} color={theme['q-text-secondary']} style={{ flexShrink: 1 }}>{text}</Text>
    <Icon name="chevron-right" rawSize={13} color={theme['q-text-secondary']} />
  </Button>
}

const ActionRow = ({ icon, label, value, onPress }: { icon: string, label: string, value?: string, onPress: () => void }) => {
  const theme = useTheme()
  return <Button style={styles.actionRow} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}${value ? ` · ${value}` : ''}`}>
    <Icon name={icon} rawSize={22} color={theme['q-text-primary']} />
    <View style={styles.rowText}>
      <Text size={15} color={theme['q-text-primary']}>{label}</Text>
      {value ? <Text size={12} numberOfLines={1} color={theme['q-text-secondary']} style={{ marginTop: 4 }}>{value}</Text> : null}
    </View>
    <Icon name="chevron-right" rawSize={17} color={theme['q-text-secondary']} />
  </Button>
}

const QuickAction = ({ icon, label, busy = false, onPress }: { icon: string, label: string, busy?: boolean, onPress: () => void }) => {
  const theme = useTheme()
  return <Button style={styles.quick} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy }} disabled={busy} onPress={onPress}>
    <View style={[styles.quickIcon, { backgroundColor: theme['q-surface-tint'] }]}>{busy ? <ActivityIndicator color={theme['q-accent-text']} /> : <Icon name={icon} rawSize={25} color={theme['q-text-primary']} />}</View>
    <Text size={13} color={theme['q-text-primary']} style={{ marginTop: 9 }}>{label}</Text>
  </Button>
}

export const SongActionsProvider = ({ children }: { children: React.ReactNode }) => {
  const theme = useTheme()
  const t = useI18n()
  const [song, setSong] = useState<LX.Music.MusicInfo | null>(null)
  const [visible, setVisible] = useState(false)
  const [page, setPage] = useState<'menu' | 'artist'>('menu')
  const [downloading, setDownloading] = useState(false)
  const collection = useRef<MusicAddModalType>(null)
  const pendingSearch = useRef<Parameters<typeof openSongSearch> | null>(null)
  const navigating = useRef(false)
  const navigate = useCallback((...args: Parameters<typeof openSongSearch>) => {
    if (navigating.current) return
    navigating.current = true
    void openSongSearch(...args).catch(() => { toast(global.i18n.t('load_failed')) }).finally(() => { navigating.current = false })
  }, [])
  const searchAfterClose = (...args: Parameters<typeof openSongSearch>) => {
    if (pendingSearch.current) return
    pendingSearch.current = args
    setVisible(false)
  }
  const open = useCallback((next: Page = 'menu') => {
    const info = playerState.playMusicInfo.musicInfo
    if (!info) return
    const original = 'progress' in info ? info.metadata.musicInfo : info
    const snapshot: LX.Music.MusicInfo = { ...original }
    snapshot.meta = { ...original.meta, picUrl: playerState.musicInfo.pic ? playerState.musicInfo.pic : original.meta.picUrl }
    if (next == 'album') { navigate(snapshot, next); return }
    const artists = songArtists(snapshot.singer)
    if (next == 'artist' && artists.length <= 1) { navigate(snapshot, 'artist', artists[0]); return }
    pendingSearch.current = null
    setSong(snapshot)
    setPage(next)
    setVisible(true)
  }, [navigate])
  const close = useCallback(() => { setVisible(false) }, [])
  const back = () => { if (page == 'menu') close(); else setPage('menu') }
  return <Context.Provider value={open}>
    {children}
    <BottomSheet visible={visible} maxHeight={page == 'menu' ? 464 : 190 + Math.min(songArtists(song?.singer ?? '').length, 5) * 68} onClose={close} onBack={back} onClosed={() => {
      const request = pendingSearch.current
      pendingSearch.current = null
      // 先让原生弹窗收到隐藏更新，再收起播放器，避免残留遮罩。
      if (request) requestAnimationFrame(() => { navigate(...request) })
    }} testID="song-actions-sheet">
      {song ? <View style={{ flex: 1, backgroundColor: theme['c-content-background'] }}>
        <View style={styles.sheetHeader}>
          {page != 'menu' ? <Button accessibilityLabel={t('back')} style={styles.iconButton} onPress={back}><Icon name="chevron-left" rawSize={22} color={theme['q-text-primary']} /></Button> : null}
          <Text size={15} color={theme['q-text-primary']} style={styles.sheetTitle} numberOfLines={1}>{t(page == 'menu' ? 'song_actions_title' : `song_actions_${page}`)}</Text>
          <Button accessibilityLabel={t('close')} onPress={close} style={styles.iconButton}><Icon name="close" rawSize={21} color={theme['q-text-secondary']} /></Button>
        </View>
        <View style={[styles.summary, { borderBottomColor: theme['q-outline'] }]}>
          <Image url={song.meta.picUrl ?? ''} style={styles.cover} />
          <Button accessibilityLabel={`${t('song_browse_search_keyword')} · ${song.name}`} onPress={() => { searchAfterClose(song, 'song') }} style={{ flex: 1, minWidth: 0, paddingVertical: 8, borderRadius: 8 }}><Text size={17} color={theme['q-text-primary']} numberOfLines={1} style={{ fontWeight: '600' }}>{song.name}</Text><Text size={13} color={theme['q-text-secondary']} numberOfLines={1} style={{ marginTop: 6 }}>{song.singer}</Text></Button>
          {song.source != 'local' ? <SourceLogo source={song.source} size={22} /> : null}
        </View>
        {page == 'menu' ? <ScrollView contentContainerStyle={styles.menuContent}>
          <View style={styles.quickActions}>
            <QuickAction icon="love" label={t('mobile_collect')} onPress={() => { collection.current?.show({ musicInfo: song, listId: '', isMove: false }) }} />
            {song.source != 'local' ? <QuickAction icon="download-2" label={t('download')} busy={downloading} onPress={() => {
              if (downloading) return
              setDownloading(true)
              void downloadSelection([song]).catch(() => { toast(t('load_failed')) }).finally(() => { setDownloading(false) })
            }} /> : null}
            <QuickAction icon="share" label={t('song_actions_share')} onPress={() => { shareMusic(settingState.setting['common.shareType'], settingState.setting['download.fileName'], song) }} />
          </View>
          {song.meta.albumName ? <ActionRow icon="disc" label={t('song_actions_album')} value={song.meta.albumName} onPress={() => { searchAfterClose(song, 'album') }} /> : null}
          {song.singer ? <ActionRow icon="user" label={t('song_actions_artist')} value={song.singer} onPress={() => {
            const artists = songArtists(song.singer)
            if (artists.length > 1) setPage('artist')
            else searchAfterClose(song, 'artist', artists[0])
          }} /> : null}
        </ScrollView> : <ScrollView contentContainerStyle={styles.menuContent}>
          {songArtists(song.singer).map(artist => <ActionRow key={artist} icon="user" label={artist} onPress={() => { searchAfterClose(song, 'artist', artist) }} />)}
        </ScrollView>}
      </View> : null}
    </BottomSheet>
    <MusicAddModal ref={collection} />
  </Context.Provider>
}

const styles = StyleSheet.create({
  iconButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  metadata: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 8, maxWidth: '100%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  sheetTitle: { flex: 1, fontWeight: '600', paddingHorizontal: 10 },
  summary: { flexDirection: 'row', gap: 14, alignItems: 'center', marginHorizontal: 22, paddingTop: 4, paddingBottom: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  cover: { width: 54, height: 54, borderRadius: 10 },
  menuContent: { paddingHorizontal: 14, paddingBottom: 16 },
  quickActions: { flexDirection: 'row', paddingVertical: 18 },
  quick: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 18 },
  quickIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  actionRow: { minHeight: 68, paddingVertical: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16 },
  rowText: { flex: 1, minWidth: 0 },
})
