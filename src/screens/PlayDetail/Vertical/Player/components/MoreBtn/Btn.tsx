import IconButton from '@/components/common/IconButton'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { scaleSizeW } from '@/utils/pixelRatio'
import { Q_UI } from '@/theme/ui'

export const BTN_WIDTH = scaleSizeW(44)
export const BTN_ICON_SIZE = 24

export default ({ icon, color, onPress, onLongPress, accessibilityLabel, selected }: {
  icon: string
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
      accessibilityState={selected == null ? undefined : { selected }}
      selected={selected}
      name={icon}
      size={BTN_WIDTH}
      iconSize={scaleSizeW(BTN_ICON_SIZE)}
      iconColor={color ?? (selected ? theme['q-accent-text'] : theme['c-font-label'])}
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
    marginLeft: 5,
    justifyContent: 'center',
    alignItems: 'center',

    // backgroundColor: '#ccc',
    shadowOpacity: 1,
    textShadowRadius: 1,
  },
})
