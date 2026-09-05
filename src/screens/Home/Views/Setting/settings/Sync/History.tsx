import { memo, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import { View, ScrollView } from 'react-native'
// import { gzip, ungzip } from 'pako'
import Button from '../../components/Button'
import { getSyncHostHistory, removeSyncHostHistory, setSyncHost } from '@/plugins/sync/data'
import Popup, { type PopupType } from '@/components/common/Popup'
import { BorderWidths } from '@/theme'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { createStyle } from '@/utils/tools'
import BaseButton from '@/components/common/Button'
import IconButton from '@/components/common/IconButton'
import { Q_UI } from '@/theme/ui'

type SyncHistoryItem = Awaited<ReturnType<typeof getSyncHostHistory>>[number]

const HistoryListItem = ({ item, index, onRemove, onSelect }: {
  item: SyncHistoryItem
  index: number
  onRemove: (index: number) => void
  onSelect: (index: number) => void
}) => {
  const theme = useTheme()
  const handleSetHost = () => {
    onSelect(index)
    // setHost({
    //   host: item.host,
    //   port: item.port,
    // })
    // setSyncHost({
    //   host: item.host,
    //   port: item.port,
    // })
  }
  const handleRemove = () => {
    onRemove(index)
  }

  return (
    <View style={{ ...styles.listItem, borderBottomColor: theme['c-border-background'] }}>
      <BaseButton
        accessibilityLabel={item}
        style={styles.listName}
        onPress={handleSetHost}
      >
        <Text numberOfLines={1}>{item}</Text>
      </BaseButton>
      <IconButton
        accessibilityLabel={`${global.i18n.t('delete')} ${item}`}
        name="remove"
        iconSize={16}
        iconColor={theme['c-font-label']}
        expandHitSlop={false}
        style={styles.listBtn}
        onPress={handleRemove}
      />
    </View>
  )
}

interface HistoryListProps {
  onSelect: (item: SyncHistoryItem) => void
}
interface HistoryListType {
  show: () => void
}
const HistoryList = forwardRef<HistoryListType, HistoryListProps>(({ onSelect }, ref) => {
  const popupRef = useRef<PopupType>(null)
  const [visible, setVisible] = useState(false)
  const [list, setList] = useState<SyncHistoryItem[]>([])
  // const isUnmountedRef = useRef(true)
  const theme = useTheme()
  const t = useI18n()

  const handleShow = () => {
    popupRef.current?.setVisible(true)
    requestAnimationFrame(() => {
      void getSyncHostHistory().then(historyList => {
        setList([...historyList])
      })
    })
  }
  useImperativeHandle(ref, () => ({
    show() {
      if (visible) handleShow()
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          handleShow()
        })
      }
    },
  }))

  const handleSelect = useCallback((index: number) => {
    popupRef.current?.setVisible(false)
    onSelect(list[index])
  }, [list, onSelect])

  const handleRemove = useCallback((index: number) => {
    void removeSyncHostHistory(index)
    const newList = [...list]
    newList.splice(index, 1)
    setList(newList)
  }, [list])


  return (
    visible
      ? (
          <Popup ref={popupRef} title={t('setting_sync_history_title')}>
            <ScrollView style={styles.list}>
              {
                list.length
                  ? list.map((item, index) => (
                      <HistoryListItem
                        item={item}
                        index={index}
                        onRemove={handleRemove}
                        key={item}
                        onSelect={handleSelect}
                      />
                  ))
                  : <Text style={styles.tipText} color={theme['c-font-label']}>{t('setting_sync_history_empty')}</Text>
              }
            </ScrollView>
          </Popup>
        )
      : null
  )
})

export default memo(({ setHost }: {
  setHost: (host: string) => void
}) => {
  const t = useI18n()
  const isEnableSync = useSettingValue('sync.enable')
  const listRef = useRef<HistoryListType>(null)

  const showPopup = () => {
    listRef.current?.show()
  }

  const handleSelect = (item: SyncHistoryItem) => {
    setHost(item)
    void setSyncHost(item)
  }

  return (
    <>
      <View style={styles.btn}>
        <Button disabled={isEnableSync} onPress={showPopup}>{t('setting_sync_history')}</Button>
      </View>
      <HistoryList ref={listRef} onSelect={handleSelect} />
    </>
  )
})

const styles = createStyle({
  btn: {
    flexDirection: 'row',
    marginLeft: 25,
    marginBottom: 15,
  },
  tipText: {
    textAlign: 'center',
    marginTop: 15,
  },
  list: {
    flexShrink: 1,
    flexGrow: 0,
    paddingLeft: 15,
    paddingRight: 15,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: Q_UI.touchSize,
    paddingVertical: 4,
    borderBottomWidth: BorderWidths.normal,
  },
  listName: {
    flex: 1,
    minHeight: Q_UI.touchSize,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 4,
  },
  listBtn: {
    width: Q_UI.touchSize,
    height: Q_UI.touchSize,
  },
})
