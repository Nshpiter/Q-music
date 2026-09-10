import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { useIsPlay } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { qSoftShadow } from '@/theme/ui'
import { useWindowSize } from '@/utils/hooks'

const SECONDARY_FACE_SIZE = 30
const PRIMARY_FACE_SIZE = 40
const TOUCH_SIZE = 44

const TransportButton = ({ icon, primary = false, onPress }: {
  icon: string
  primary?: boolean
  onPress: () => void
}) => {
  const theme = useTheme()
  return (
    <TouchableOpacity
      activeOpacity={0.65}
      style={styles.touchTarget}
      onPress={onPress}
    >
      <View
        style={[
          styles.buttonFace,
          primary ? styles.primaryFace : styles.secondaryFace,
          primary
            ? {
                ...qSoftShadow,
                backgroundColor: theme['c-primary-light-100'],
                borderColor: theme.isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.68)',
              }
            : null,
        ]}
      >
        <Icon
          name={icon}
          color={primary ? '#fff' : theme['q-text-primary']}
          size={primary ? 20 : 18}
        />
      </View>
    </TouchableOpacity>
  )
}

const PlayPrevBtn = () => (
  <TransportButton icon="prevMusic" onPress={() => { void playPrev() }} />
)

const PlayNextBtn = () => (
  <TransportButton icon="nextMusic" onPress={() => { void playNext() }} />
)

const TogglePlayBtn = () => {
  const isPlay = useIsPlay()
  return <TransportButton icon={isPlay ? 'pause' : 'play'} primary onPress={togglePlay} />
}

export default () => {
  const { width } = useWindowSize()
  const compact = width < 380

  return (
    <View style={styles.container}>
      {compact ? null : <PlayPrevBtn />}
      <TogglePlayBtn />
      <PlayNextBtn />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  touchTarget: {
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonFace: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 999,
  },
  secondaryFace: {
    width: SECONDARY_FACE_SIZE,
    height: SECONDARY_FACE_SIZE,
  },
  primaryFace: {
    width: PRIMARY_FACE_SIZE,
    height: PRIMARY_FACE_SIZE,
    borderWidth: StyleSheet.hairlineWidth,
  },
})
