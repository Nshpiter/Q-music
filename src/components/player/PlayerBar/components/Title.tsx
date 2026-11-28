import { useRef } from 'react'
import { Animated, PanResponder, StyleSheet } from 'react-native'
import { navigations } from '@/navigation'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useGlassColors } from '@/components/common/GlassSurface'
import commonState from '@/store/common/state'
import playerState from '@/store/player/state'
import Text from '@/components/common/Text'
import { LIST_IDS } from '@/config/constant'
import Button from '@/components/common/Button'
import { useTrackChangeAnimation } from '@/components/player/useTrackChangeAnimation'
import useAdaptiveLayout from '@/utils/hooks/useAdaptiveLayout'
import { playNext, playPrev } from '@/core/player/player'
import { useInteractionMotion } from '@/utils/useMotion'

const SWIPE_THRESHOLD = 44
const MAX_DRAG_OFFSET = 52

export default ({ isHome, onOpenDetail }: { isHome: boolean, onOpenDetail?: () => void }) => {
  const musicInfo = usePlayerMusicInfo()
  const colors = useGlassColors()
  const { isCar, wide } = useAdaptiveLayout()
  const motion = useInteractionMotion()
  const trackAnimation = useTrackChangeAnimation(musicInfo.id)
  const swipeX = useRef(new Animated.Value(0)).current
  const hasTrackRef = useRef(Boolean(musicInfo.id))
  hasTrackRef.current = Boolean(musicInfo.id)

  const snapBack = () => {
    if (!motion) {
      swipeX.setValue(0)
      return
    }
    Animated.spring(swipeX, {
      toValue: 0,
      speed: 22,
      bounciness: 5,
      useNativeDriver: true,
    }).start()
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        hasTrackRef.current && Math.abs(gesture.dx) > 14 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
      onPanResponderGrant: () => {
        swipeX.stopAnimation()
      },
      onPanResponderMove: (_, gesture) => {
        const clamped = Math.max(-MAX_DRAG_OFFSET, Math.min(MAX_DRAG_OFFSET, gesture.dx * 0.48))
        swipeX.setValue(clamped)
      },
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dx) >= SWIPE_THRESHOLD || Math.abs(gesture.vx) >= 0.65) {
          if (gesture.dx < 0) void playNext()
          else void playPrev()
        }
        snapBack()
      },
      onPanResponderTerminate: snapBack,
    }),
  ).current

  const handlePress = () => {
    if (!musicInfo.id) return
    if (onOpenDetail) { onOpenDetail(); return }
    navigations.pushPlayDetailScreen(commonState.componentIds.home!)
  }

  const handleLongPress = () => {
    if (!isHome) return
    const listId = playerState.playMusicInfo.listId
    if (!listId || listId == LIST_IDS.DOWNLOAD) return
    global.app_event.jumpListPosition()
  }

  const title = musicInfo.id ? musicInfo.name : ''
  const singer = musicInfo.id ? musicInfo.singer : ''

  return (
    <Animated.View style={styles.swipeWrap} {...panResponder.panHandlers}>
      <Button
        ripple={null}
        accessibilityLabel={musicInfo.id ? `${title} · ${singer}` : global.i18n.t('play_detail_setting_title')}
        style={[styles.container, wide && { height: 56 }, isCar && { height: 64 }]}
        onLongPress={handleLongPress}
        onPress={handlePress}
        disabled={!musicInfo.id}
      >
        <Animated.View
          style={{
            opacity: trackAnimation.opacity,
            transform: [
              ...trackAnimation.transform,
              { translateX: swipeX },
            ],
          }}
        >
          <Text style={styles.title} size={isCar ? 18 : wide ? 15 : 13} color={colors.primary} numberOfLines={1}>{title}</Text>
          <Text style={styles.singer} size={isCar ? 13 : wide ? 12 : 10} color={colors.secondary} numberOfLines={1}>{singer}</Text>
        </Animated.View>
      </Button>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  swipeWrap: {
    width: '100%',
    minWidth: 0,
  },
  container: {
    width: '100%',
    overflow: 'hidden',
    minWidth: 0,
    height: 48,
    justifyContent: 'center',
  },
  title: {
    fontWeight: '600',
  },
  singer: {
    marginTop: 3,
  },
})
