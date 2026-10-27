import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import { BorderWidths } from '@/theme'
import { useTheme } from '@/store/theme/hook'
import { useActiveListId, useListFetching, useMyList } from '@/store/list/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import PlaylistIdentity from '@/components/PlaylistIdentity'
import { LIST_IDS } from '@/config/constant'
import Loading from '@/components/common/Loading'
import { useSettingValue } from '@/store/setting/hook'
import Button from '@/components/common/Button'
import IconButton from '@/components/common/IconButton'
import useAdaptiveLayout from '@/utils/hooks/useAdaptiveLayout'

export interface ActiveListProps {
  onBack?: () => void
  onShowSync: () => void
  onShowImport: () => void
  onShowSearchBar: () => void
  onScrollToTop: () => void
}
export interface ActiveListType {
  setVisibleBar: (visible: boolean) => void
}

export default forwardRef<ActiveListType, ActiveListProps>(({ onBack, onShowSync, onShowImport, onShowSearchBar, onScrollToTop }, ref) => {
  const theme = useTheme()
  const currentListId = useActiveListId()
  const lists = useMyList()
  const fetching = useListFetching(currentListId)
  const currentList = lists.find(list => list.id == currentListId)
  const langId = useSettingValue('common.langId')
  const { splitLibrary } = useAdaptiveLayout()
  const currentListName = useMemo(() => {
    switch (currentListId) {
      case LIST_IDS.TEMP:
        return global.i18n.t('list_name_temp')
      case LIST_IDS.DEFAULT:
        return global.i18n.t('list_name_default')
      case LIST_IDS.LOVE:
        return global.i18n.t('list_name_love')
      default:
        return lists.find(l => l.id === currentListId)?.name ?? ''
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentListId, langId, lists])
  const [visibleBar, setVisibleBar] = useState(true)
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    global.app_event.on('changeLoveListVisible', setExpanded)
    return () => { global.app_event.off('changeLoveListVisible', setExpanded) }
  }, [])

  useImperativeHandle(ref, () => ({
    setVisibleBar(visible) {
      setVisibleBar(visible)
    },
  }))

  const showList = () => {
    global.app_event.changeLoveListVisible(!expanded)
  }

  const identity = <>
    {fetching ? <Loading color={theme['q-accent-text']} style={styles.loading} /> : null}
    {currentList ? <PlaylistIdentity list={currentList} name={currentListName} /> : <Text style={styles.currentListText} numberOfLines={1}>{currentListName}</Text>}
    {!splitLibrary && !onBack ? <Icon accessible={false} color={theme['q-text-secondary']} name={expanded ? 'chevron-up' : 'chevron-down'} rawSize={16} /> : null}
  </>
  return (
    <View pointerEvents={visibleBar ? 'auto' : 'none'} importantForAccessibility={visibleBar ? 'auto' : 'no-hide-descendants'} style={[styles.currentList, { opacity: visibleBar ? 1 : 0, borderBottomColor: theme['q-outline'] }]}>
      {!onBack ? <View style={styles.heading}>
        <Text size={16} style={styles.title}>{global.i18n.t('library_playlists')}</Text>
        <Button accessibilityLabel={global.i18n.t('playlist_import_modal__title')} style={styles.action} onPress={onShowImport}>
          <Icon accessible={false} color={theme['q-text-secondary']} name="download-2" rawSize={15} />
          <Text size={12} color={theme['q-text-secondary']}>{global.i18n.t('list_import')}</Text>
        </Button>
        <Button style={styles.action} onPress={onShowSync}>
          <Icon accessible={false} color={theme['q-text-secondary']} name="available_updates" rawSize={15} />
          <Text size={12} color={theme['q-text-secondary']}>{global.i18n.t('list_sync_entry')}</Text>
        </Button>
      </View> : null}
      <View style={styles.row}>
        {onBack ? <IconButton accessibilityLabel={global.i18n.t('library_back')} name="chevron-left" iconSize={22} style={styles.search} onPress={onBack} /> : null}
        {splitLibrary || onBack ? <View style={styles.currentListMain}>{identity}</View> : <Button accessibilityLabel={global.i18n.t('library_switch_playlist', { name: currentListName })} accessibilityState={{ expanded }} pressScale={0.985} onPress={showList} onLongPress={onScrollToTop} style={styles.currentListMain}>{identity}</Button>}
        <IconButton accessibilityLabel={global.i18n.t('list_search')} name="search-2" iconSize={18} iconColor={theme['q-text-secondary']} style={styles.search} onPress={onShowSearchBar} />
      </View>
    </View>
  )
})

const styles = createStyle({
  currentList: { paddingHorizontal: 16, paddingBottom: 6, borderBottomWidth: BorderWidths.normal },
  heading: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  title: { flex: 1, minWidth: 0, fontWeight: '600', paddingRight: 6 },
  action: { minHeight: 48, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currentListMain: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  currentListText: { flex: 1, minWidth: 0, fontWeight: '500' },
  loading: { marginRight: 5 },
  search: { width: 48, minWidth: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
})
