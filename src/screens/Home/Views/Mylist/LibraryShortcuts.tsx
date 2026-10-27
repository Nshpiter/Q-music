import { StyleSheet, useWindowDimensions, View } from 'react-native'
import LibraryShortcut from '@/components/LibraryShortcut'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { setActiveList } from '@/core/list'
import { setNavActiveId } from '@/core/common'
import { LIST_IDS } from '@/config/constant'
import { pushMusicAccountScreen } from '@/navigation/navigation'
import commonState from '@/store/common/state'
import DownloadEntry from '@/components/DownloadEntry'
import { selectSettingSection } from '@/store/setting/navigation'
import { useFontSize } from '@/store/common/hook'

export default ({ onOpenList }: { onOpenList?: (id: string) => void }) => {
  const theme = useTheme()
  const t = useI18n()
  const { width, fontScale } = useWindowDimensions()
  const fontSize = useFontSize()
  const cell = { flexGrow: 1, flexBasis: width < 400 && fontSize * fontScale > 1.15 ? '44%' as const : 0, minWidth: 0 }
  const openCloudLibrary = () => {
    selectSettingSection('cloud')
    setNavActiveId('nav_setting')
  }
  return (
      <View style={[styles.container, { backgroundColor: theme['q-surface-raised'], borderColor: theme['q-outline'] }]}>
        <View style={cell}><LibraryShortcut icon="love" label={t('list_name_love')} onPress={() => { onOpenList ? onOpenList(LIST_IDS.LOVE) : setActiveList(LIST_IDS.LOVE) }} /></View>
        <View style={cell}><DownloadEntry compact /></View>
        <View style={cell}><LibraryShortcut icon="platform-playlists" label={t('account_lists_entry')} onPress={() => { if (commonState.componentIds.home) pushMusicAccountScreen(commonState.componentIds.home) }} /></View>
        <View style={cell}><LibraryShortcut icon="cloud-library" label={t('setting_cloud')} onPress={openCloudLibrary} /></View>
      </View>
  )
}

const styles = StyleSheet.create({
  container: { flexShrink: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginHorizontal: 16, marginTop: 14, marginBottom: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
})
