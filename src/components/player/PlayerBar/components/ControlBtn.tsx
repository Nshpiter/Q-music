import { StyleSheet, View } from 'react-native'
import { useRef } from 'react'
import { usePlayControlState } from '@/store/player/hook'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import PlayQueue, { type PlayQueueType } from '@/components/player/PlayQueue'
import TransportButton from '@/components/player/TransportButton'
import { useGlassColors } from '@/components/common/GlassSurface'
import useAdaptiveLayout from '@/utils/hooks/useAdaptiveLayout'

export default ({ compact = false }: { compact?: boolean }) => {
  const isPlay = usePlayControlState()
  const colors = useGlassColors()
  const { isCar, wide } = useAdaptiveLayout()
  const targetSize = isCar ? 56 : wide ? 48 : 40
  const queueRef = useRef<PlayQueueType>(null)
  return <View style={styles.container}>
    {!compact ? <TransportButton color={colors.primary} icon="prevMusic" label={global.i18n.t('play_prev')} size={targetSize} iconSize={isCar ? 25 : wide ? 21 : 17} onPress={() => { void playPrev() }} /> : null}
    <View style={[styles.primaryTarget, wide && { width: 52, height: 56 }, isCar && { width: 64, height: 64 }]}>
      <TransportButton color={colors.primary} icon={isPlay ? 'pause' : 'play'} label={global.i18n.t(isPlay ? 'pause' : 'play')} primary size={isCar ? 64 : wide ? 52 : 44} faceSize={isCar ? 48 : wide ? 38 : 30} iconSize={isCar ? 23 : wide ? 19 : 15} onPress={togglePlay} />
    </View>
    <TransportButton color={colors.primary} icon="nextMusic" label={global.i18n.t('play_next')} size={targetSize} iconSize={isCar ? 25 : wide ? 21 : 17} onPress={() => { void playNext() }} />
    <TransportButton color={colors.primary} icon="menu" label={global.i18n.t('play_queue_title')} size={targetSize} iconSize={isCar ? 25 : wide ? 22 : 19} onPress={() => { queueRef.current?.show() }} />
    <PlayQueue ref={queueRef} />
  </View>
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center' },
  primaryTarget: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
})
