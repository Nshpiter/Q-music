import { StyleSheet, useWindowDimensions, View } from 'react-native'
import LibraryShortcut from '@/components/LibraryShortcut'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { setActiveList } from '@/core/list'
import { setNavActiveId } from '@/core/common'
import { LIST_IDS } from '@/config/constant'
import { pushMusicAccountScreen, pushPlayHistoryScreen } from '@/navigation/navigation'
import commonState from '@/store/common/state'
import DownloadEntry from '@/components/DownloadEntry'
import { selectSettingSection } from '@/store/setting/navigation'
import { useFontSize } from '@/store/common/hook'

export default ({ onOpenList }: { onOpenList?: (id: string) => void }) => {
  const theme = useTheme()
  const t = useI18n()
  const { width, fontScale } = useWindowDimensions()
  const fontSize = useFontSize()
  const compactPhone = width < 600 && fontSize * fontScale <= 1.25
  const cell = { flex: 1, minWidth: 0 }
  const wideCell = { flexGrow: 1, flexBasis: width < 600 ? '44%' as const : 0, minWidth: 0 }
  const openFavorite = () => {
    if (onOpenList) onOpenList(LIST_IDS.LOVE)
    else setActiveList(LIST_IDS.LOVE)
  }
  const openHistory = () => { if (commonState.componentIds.home) pushPlayHistoryScreen(commonState.componentIds.home) }
  const openPlatforms = () => { if (commonState.componentIds.home) pushMusicAccountScreen(commonState.componentIds.home) }
  const openCloudLibrary = () => {
    selectSettingSection('cloud')
    setNavActiveId('nav_setting')
  }
  if (compactPhone) {
    return (
      <View style={styles.phoneStack}>
        <View style={[styles.primaryRow, { backgroundColor: theme['q-surface-raised'], borderColor: theme['q-outline'] }]}>
          <View style={cell}><LibraryShortcut icon="love" label={t('list_name_love')} onPress={openFavorite} /></View>
          <View style={cell}><DownloadEntry compact /></View>
          <View style={cell}><LibraryShortcut icon="music_time" label={t('play_history_title')} onPress={openHistory} /></View>
        </View>
        <View style={styles.secondaryRow}>
          <View style={cell}><LibraryShortcut variant="row" icon="platform-playlists" label={t('account_lists_entry')} onPress={openPlatforms} /></View>
          <View style={cell}><LibraryShortcut variant="row" icon="cloud-library" label={t('setting_cloud')} onPress={openCloudLibrary} /></View>
        </View>
      </View>
    )
  }
  return (
      <View style={[styles.container, { backgroundColor: theme['q-surface-raised'], borderColor: theme['q-outline'] }]}>
        <View style={wideCell}><LibraryShortcut icon="love" label={t('list_name_love')} onPress={openFavorite} /></View>
        <View style={wideCell}><DownloadEntry compact /></View>
        <View style={wideCell}><LibraryShortcut icon="music_time" label={t('play_history_title')} onPress={openHistory} /></View>
        <View style={wideCell}><LibraryShortcut icon="platform-playlists" label={t('account_lists_entry')} onPress={openPlatforms} /></View>
        <View style={wideCell}><LibraryShortcut icon="cloud-library" label={t('setting_cloud')} onPress={openCloudLibrary} /></View>
      </View>
  )
}

const styles = StyleSheet.create({
  phoneStack: { flexShrink: 0, gap: 8, marginHorizontal: 16, marginTop: 12, marginBottom: 8 },
  primaryRow: { flexDirection: 'row', alignItems: 'stretch', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  secondaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  container: { flexShrink: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginHorizontal: 16, marginTop: 12, marginBottom: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
})
