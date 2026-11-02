import { memo, useEffect, useLayoutEffect, useRef } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import useTrackArtwork from '@/utils/hooks/useTrackArtwork'
import { useTheme } from '@/store/theme/hook'
import { useMotion } from '@/utils/useMotion'

export default memo(({ item }: { item?: LX.Music.MusicInfoOnline }) => {
  const theme = useTheme()
  const motion = useMotion()
  const { url, onError } = useTrackArtwork(item)
  const opacity = useRef(new Animated.Value(0)).current
  useLayoutEffect(() => {
    opacity.stopAnimation()
    opacity.setValue(0)
  }, [opacity, url])
  useEffect(() => () => { opacity.stopAnimation() }, [opacity])
  const handleLoad = () => {
    if (!motion) { opacity.setValue(1); return }
    Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }).start()
  }
  return (
    <View style={{ ...styles.cover, backgroundColor: theme['q-surface-tint'] }}>
      <Icon accessible={false} name="album" color={theme['q-accent-text']} rawSize={26} />
      {url ? <Animated.Image source={{ uri: url }} style={[StyleSheet.absoluteFill, { opacity }]} onLoad={handleLoad} onError={onError} /> : null}
    </View>
  )
})

const styles = StyleSheet.create({
  cover: { width: '100%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
})
