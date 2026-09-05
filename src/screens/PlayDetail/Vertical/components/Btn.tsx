import IconButton from '@/components/common/IconButton'
import { createStyle } from '@/utils/tools'
import { scaleSizeH } from '@/utils/pixelRatio'
import { HEADER_HEIGHT as _HEADER_HEIGHT } from '@/config/constant'

export const HEADER_HEIGHT = scaleSizeH(_HEADER_HEIGHT)

export default ({ icon, color, onPress, accessibilityLabel, selected }: {
  icon: string
  color?: string
  onPress: () => void
  accessibilityLabel: string
  selected?: boolean
}) => {
  return (
    <IconButton
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected == null ? undefined : { selected }}
      selected={selected}
      name={icon}
      size={HEADER_HEIGHT}
      iconSize={18}
      iconColor={color}
      radius={12}
      expandHitSlop={false}
      style={styles.button}
      onPress={onPress}
    />
  )
}

const styles = createStyle({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    flex: 0,
  },
})
