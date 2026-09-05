import IconButton from '@/components/common/IconButton'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { scaleSizeW } from '@/utils/pixelRatio'
import { Q_UI } from '@/theme/ui'

import { HEADER_HEIGHT } from '@/config/constant'
export const BTN_WIDTH = scaleSizeW(HEADER_HEIGHT)
export const BTN_ICON_SIZE = 20

export default ({ icon, size, color, onPress, onLongPress, accessibilityLabel, selected }: {
  icon: string
  size?: number
  color?: string
  onPress: () => void
  onLongPress?: () => void
  accessibilityLabel: string
  selected?: boolean
}) => {
  const theme = useTheme()
  return (
    <IconButton
      accessibilityLabel={accessibilityLabel}
      selected={selected}
      name={icon}
      size={BTN_WIDTH}
      iconSize={scaleSizeW(size ?? BTN_ICON_SIZE)}
      iconColor={color ?? (selected ? theme['q-accent-text'] : theme['c-550'])}
      radius={Q_UI.radius.control}
      expandHitSlop={false}
      style={styles.cotrolBtn}
      onPress={onPress}
      onLongPress={onLongPress}
    />
  )
}

const styles = createStyle({
  cotrolBtn: {
    // marginLeft: 5,
    justifyContent: 'center',
    alignItems: 'center',

    // backgroundColor: '#ccc',
    shadowOpacity: 1,
    textShadowRadius: 1,
  },
})
