import { useRef, useState } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import PagerView from 'react-native-pager-view'
import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import TransportButton from '@/components/player/TransportButton'
import PlayQueue, { type PlayQueueType } from '@/components/player/PlayQueue'
import { useCoverPlayScale } from '@/components/player/useCoverPlayScale'
import { useTrackChangeAnimation } from '@/components/player/useTrackChangeAnimation'
import { usePlayerMusicInfo, usePlayControlState } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { useLayout } from '@/utils/hooks'
import useAdaptiveLayout from '@/utils/hooks/useAdaptiveLayout'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { useNavigationComponentDidAppear } from '@/navigation'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import commonState from '@/store/common/state'
import Header from './Vertical/components/Header'
import Lyric from './Vertical/Lyric'
import PlayInfo from './Vertical/Player/components/PlayInfo'
import PlayModeBtn from './Vertical/Player/components/MoreBtn/PlayModeBtn'
import MusicAddBtn from './Vertical/Player/components/MoreBtn/MusicAddBtn'
import CommentBtn from './Vertical/Player/components/MoreBtn/CommentBtn'
import ImmersivePlayBg from './Vertical/ImmersivePlayBg'
import useKeepLyricsAwake from './useKeepLyricsAwake'
import { SongMetadata, SongMoreButton } from './components/SongActions'

// 独立编排 Apple 播放页，播放、队列和收藏仍复用现有功能。
const Artwork = ({ componentId }: { componentId: string }) => {
  const music = usePlayerMusicInfo()
  const { onLayout, width, height } = useLayout()
  const [ready, setReady] = useState(!!commonState.componentIds.playDetail)
  useNavigationComponentDidAppear(componentId, () => { setReady(true) })
  const scale = useCoverPlayScale(ready)
  const transition = useTrackChangeAnimation(music.pic, 0)
  const size = Math.max(0, Math.min(width - 12, height - 24, 420))
  return <View style={styles.artworkStage} onLayout={onLayout}>
    <Animated.View style={[styles.artworkShadow, { width: size, height: size, opacity: transition.opacity, transform: [{ scale }] }]}>
      <Image url={music.pic} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pic} style={{ width: size, height: size, borderRadius: 10 }} />
    </Animated.View>
  </View>
}

const TrackInfo = ({ compact }: { compact: boolean }) => {
  const music = usePlayerMusicInfo()
  const theme = useTheme()
  const transition = useTrackChangeAnimation(music.id)
  return <Animated.View style={[styles.trackInfo, transition]}>
    <View style={styles.trackText}>
      <Text size={compact ? 19 : 23} color={theme['q-text-primary']} style={styles.title} numberOfLines={1}>{music.name}</Text>
      <SongMetadata size={compact ? 14 : 17} />
    </View>
  </Animated.View>
}

const Controls = ({ compact }: { compact: boolean }) => {
  const playing = usePlayControlState()
  const { isCar } = useAdaptiveLayout()
  const queue = useRef<PlayQueueType>(null)
  const [availableWidth, setAvailableWidth] = useState(240)
  const size = Math.max(48, Math.min(isCar ? 64 : compact ? 56 : 68, (availableWidth - 96) / 3))
  return <>
    <View onLayout={event => { setAvailableWidth(event.nativeEvent.layout.width) }} style={[styles.transport, compact && { paddingVertical: 0 }]} >
      <MusicAddBtn iconOnly />
      <TransportButton icon="prevMusic" label={global.i18n.t('play_prev')} size={size} iconSize={isCar ? 32 : 30} onPress={() => { void playPrev() }} />
      <TransportButton icon={playing ? 'pause' : 'play'} label={global.i18n.t(playing ? 'pause' : 'play')} size={size} iconSize={compact ? 36 : 42} onPress={togglePlay} />
      <TransportButton icon="nextMusic" label={global.i18n.t('play_next')} size={size} iconSize={isCar ? 32 : 30} onPress={() => { void playNext() }} />
      <TransportButton icon="menu" label={global.i18n.t('play_queue_title')} size={48} iconSize={22} onPress={() => { queue.current?.show() }} />
    </View>
    <View style={styles.tools}>
      <PlayModeBtn />
      <CommentBtn iconOnly />
      <SongMoreButton />
    </View>
    <PlayQueue ref={queue} />
  </>
}

export default ({ componentId }: { componentId: string }) => {
  const { wide, height, isCar } = useAdaptiveLayout()
  const compact = height < (wide ? 640 : 700)
  const [page, setPage] = useState(0)
  const lyricActive = wide || page == 1
  useKeepLyricsAwake(lyricActive)
  return <>
    <ImmersivePlayBg lyricActive={lyricActive} />
    <Header />
    {wide ? <View style={[styles.wide, { paddingHorizontal: compact ? 24 : 48, gap: compact ? 28 : 64 }]}>
      <View style={[styles.left, isCar && { width: '42%' }]}>
        <Artwork componentId={componentId} />
        <TrackInfo compact={compact} />
        <View style={styles.progress}><PlayInfo /></View>
        <Controls compact={compact} />
      </View>
      <View style={styles.lyrics}><Lyric wide immersive /></View>
    </View> : <View style={styles.phone}>
      <PagerView style={styles.pages} initialPage={page} onPageSelected={({ nativeEvent }) => { setPage(nativeEvent.position) }}>
        <View key="cover" collapsable={false} style={styles.phoneArtwork}><Artwork componentId={componentId} /></View>
        <View key="lyrics" collapsable={false}><Lyric active={page == 1} immersive /></View>
      </PagerView>
      <View style={[styles.phoneFooter, { paddingHorizontal: compact ? 24 : 32 }]} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_player}>
        {page == 0 ? <TrackInfo compact={compact} /> : null}
        <View style={styles.progress}><PlayInfo /></View>
        <Controls compact={compact} />
      </View>
    </View>}
  </>
}

const styles = StyleSheet.create({
  wide: { flex: 1, flexDirection: 'row', width: '100%', maxWidth: 1440, alignSelf: 'center', paddingBottom: 12 },
  left: { width: '38%', maxWidth: 440, minWidth: 240 },
  lyrics: { flex: 1, minWidth: 0, paddingVertical: 8 },
  phone: { flex: 1 },
  pages: { flex: 1 },
  phoneArtwork: { paddingHorizontal: 32 },
  phoneFooter: { paddingBottom: 8 },
  artworkStage: { flex: 1, minHeight: 0, justifyContent: 'center', alignItems: 'center' },
  artworkShadow: { borderRadius: 10, backgroundColor: '#25252b', elevation: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 20 },
  trackInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  trackText: { flex: 1, minWidth: 0 },
  title: { fontWeight: '700', letterSpacing: -0.5 },
  progress: { height: 44, marginTop: 2 },
  transport: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', paddingVertical: 8 },
  tools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 4 },
})
