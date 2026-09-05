import { StyleSheet, View } from 'react-native'
import Button from '@/components/common/Button'
import { Icon } from '@/components/common/Icon'
import { useIsPlay } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { qSoftShadow } from '@/theme/ui'
import { useWindowSize } from '@/utils/hooks'

const SECONDARY_FACE_SIZE = 32
const PRIMARY_FACE_SIZE = 44
const TOUCH_SIZE = 48

const TransportButton = ({ icon, accessibilityLabel, primary = false, onPress }: {
  icon: string
  accessibilityLabel: string
  primary?: boolean
  onPress: () => void
}) => {
  const theme = useTheme()
  return (
    <Button
      accessibilityLabel={accessibilityLabel}
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
                backgroundColor: theme.isDark ? '#f4f6f5' : '#252827',
                borderColor: theme.isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.68)',
              }
            : null,
        ]}
      >
        <Icon
          accessible={false}
          name={icon}
          color={primary ? (theme.isDark ? '#252827' : '#fff') : theme['q-text-primary']}
          size={primary ? 20 : 18}
        />
      </View>
    </Button>
  )
}

const PlayPrevBtn = () => (
  <TransportButton icon="prevMusic" accessibilityLabel={global.i18n.t('play_prev')} onPress={() => { void playPrev() }} />
)

const PlayNextBtn = () => (
  <TransportButton icon="nextMusic" accessibilityLabel={global.i18n.t('play_next')} onPress={() => { void playNext() }} />
)

const TogglePlayBtn = () => {
  const isPlay = useIsPlay()
  return <TransportButton icon={isPlay ? 'pause' : 'play'} accessibilityLabel={global.i18n.t(isPlay ? 'pause' : 'play')} primary onPress={togglePlay} />
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
    gap: 1,
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
