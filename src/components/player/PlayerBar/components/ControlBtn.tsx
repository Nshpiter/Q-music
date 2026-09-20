import { StyleSheet, View } from 'react-native'
import { useRef } from 'react'
import { useIsPlay } from '@/store/player/hook'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import PlayQueue, { type PlayQueueType } from '@/components/player/PlayQueue'
import TransportButton from '@/components/player/TransportButton'
import { useGlassColors } from '@/components/common/GlassSurface'

export default () => {
  const isPlay = useIsPlay()
  const colors = useGlassColors()
  const queueRef = useRef<PlayQueueType>(null)
  return <View style={styles.container}>
    <TransportButton color={colors.primary} icon="prevMusic" label={global.i18n.t('play_prev')} size={44} iconSize={17} onPress={() => { void playPrev() }} />
    <View style={styles.primaryTarget}>
      <TransportButton color={colors.primary} icon={isPlay ? 'pause' : 'play'} label={global.i18n.t(isPlay ? 'pause' : 'play')} primary size={44} faceSize={30} iconSize={15} onPress={togglePlay} />
    </View>
    <TransportButton color={colors.primary} icon="nextMusic" label={global.i18n.t('play_next')} size={44} iconSize={17} onPress={() => { void playNext() }} />
    <TransportButton color={colors.primary} icon="menu" label={global.i18n.t('play_queue_title')} size={44} iconSize={19} onPress={() => { queueRef.current?.show() }} />
    <PlayQueue ref={queueRef} />
  </View>
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center' },
  primaryTarget: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
})
