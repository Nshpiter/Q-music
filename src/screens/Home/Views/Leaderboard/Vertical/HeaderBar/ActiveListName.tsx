import { forwardRef, useImperativeHandle, useState } from 'react'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { Q_UI } from '@/theme/ui'

export interface ActiveListNameProps {
  onShowBound: () => void
}
export interface ActiveListNameType {
  setBound: (id: string, name: string) => void
}

export default forwardRef<ActiveListNameType, ActiveListNameProps>(({ onShowBound }, ref) => {
  const theme = useTheme()
  const [currentListName, setCurrentListName] = useState('')

  useImperativeHandle(ref, () => ({
    setBound(id, name) {
      setCurrentListName(name)
    },
  }), [])

  return (
    <Button
      accessibilityLabel={currentListName || global.i18n.t('songlist_open')}
      accessibilityHint={global.i18n.t('songlist_open')}
      onPress={onShowBound}
      style={styles.currentList}
    >
      <Text numberOfLines={1} style={styles.currentListText} color={theme['c-button-font']}>{currentListName}</Text>
    </Button>
  )
})


const styles = createStyle({
  currentList: {
    flex: 1,
    flexDirection: 'row',
    paddingRight: 2,
    minHeight: Q_UI.touchSize,
    height: Q_UI.touchSize,
    alignItems: 'center',
    borderRadius: Q_UI.radius.control,
    overflow: 'hidden',
    // backgroundColor: 'rgba(0,0,0,0.2)',
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
})
