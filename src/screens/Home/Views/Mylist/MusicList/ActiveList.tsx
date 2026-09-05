import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import { BorderWidths } from '@/theme'
import { useTheme } from '@/store/theme/hook'
import { useActiveListId, useListFetching } from '@/store/list/hook'
import listState from '@/store/list/state'
import { createStyle } from '@/utils/tools'
import { getListPrevSelectId } from '@/utils/data'
import { setActiveList } from '@/core/list'
import Text from '@/components/common/Text'
import { LIST_IDS } from '@/config/constant'
import Loading from '@/components/common/Loading'
import { useSettingValue } from '@/store/setting/hook'
import Button from '@/components/common/Button'
import IconButton from '@/components/common/IconButton'

export interface ActiveListProps {
  onShowImport: () => void
  onShowSearchBar: () => void
  onScrollToTop: () => void
}
export interface ActiveListType {
  setVisibleBar: (visible: boolean) => void
}

export default forwardRef<ActiveListType, ActiveListProps>(({ onShowImport, onShowSearchBar, onScrollToTop }, ref) => {
  const theme = useTheme()
  const currentListId = useActiveListId()
  const fetching = useListFetching(currentListId)
  const langId = useSettingValue('common.langId')
  const currentListName = useMemo(() => {
    switch (currentListId) {
      case LIST_IDS.TEMP:
        return global.i18n.t('list_name_temp')
      case LIST_IDS.DEFAULT:
        return global.i18n.t('list_name_default')
      case LIST_IDS.LOVE:
        return global.i18n.t('list_name_love')
      default:
        return listState.allList.find(l => l.id === currentListId)?.name ?? ''
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentListId, langId])
  const [visibleBar, setVisibleBar] = useState(true)

  useImperativeHandle(ref, () => ({
    setVisibleBar(visible) {
      setVisibleBar(visible)
    },
  }))

  const showList = () => {
    global.app_event.changeLoveListVisible(true)
  }

  useEffect(() => {
    void getListPrevSelectId().then((id) => {
      setActiveList(id)
    })
  }, [])

  return (
    <View style={{ ...styles.currentList, opacity: visibleBar ? 1 : 0, borderBottomColor: theme['c-border-background'] }}>
      <Button
        accessibilityLabel={currentListName}
        onPress={showList}
        onLongPress={onScrollToTop}
        style={styles.currentListMain}
      >
        <Icon style={styles.currentListIcon} color={theme['c-button-font']} name="chevron-right" size={12} />
        { fetching ? <Loading color={theme['c-button-font']} style={styles.loading} /> : null }
        <Text style={styles.currentListText} numberOfLines={1} color={theme['c-button-font']}>{currentListName}</Text>
      </Button>
      <Button
        accessibilityLabel={global.i18n.t('playlist_import_modal__title')}
        style={{
          ...styles.importButton,
          backgroundColor: theme['q-surface-tint'],
          borderColor: theme['q-outline'],
        }}
        onPress={onShowImport}
      >
        <Icon accessible={false} color={theme['q-accent-text']} name="download-2" size={15} />
        <Text size={11} style={styles.importText} color={theme['q-accent-text']} numberOfLines={1}>
          {global.i18n.t('playlist_import_modal__title')}
        </Text>
      </Button>
      <IconButton
        accessibilityLabel={global.i18n.t('list_search')}
        name="search-2"
        iconSize={18}
        iconColor={theme['c-button-font']}
        style={styles.currentListBtns}
        onPress={onShowSearchBar}
      />
    </View>
  )
})


const styles = createStyle({
  currentList: {
    flexDirection: 'row',
    paddingRight: 2,
    minHeight: 48,
    height: 48,
    alignItems: 'center',
    borderBottomWidth: BorderWidths.normal,
    // backgroundColor: 'rgba(0,0,0,0.2)',
  },
  currentListMain: {
    flex: 1,
    minWidth: 0,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 0,
  },
  currentListIcon: {
    paddingLeft: 15,
    paddingRight: 10,
    // paddingTop: 10,
    // paddingBottom: 0,
  },
  currentListText: {
    flex: 1,
    // minWidth: 70,
    // paddingLeft: 10,
    paddingRight: 10,
    // paddingTop: 10,
    // paddingBottom: 10,
  },
  loading: {
    marginRight: 5,
  },
  currentListBtns: {
    width: 48,
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'center',
    height: 48,
    // backgroundColor: 'rgba(0,0,0,0.2)',
  },
  importButton: {
    minHeight: 48,
    height: 48,
    maxWidth: 144,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  importText: {
    marginLeft: 5,
    fontWeight: '600',
  },
})
