import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Animated, Keyboard, Platform, ScrollView, StyleSheet, useWindowDimensions } from 'react-native'
import { SettingContent, type SettingScreenIds } from '../Main'
import { backToSettingOverview, setSettingTransitioning, useSettingSection, useSettingTarget } from '@/store/setting/navigation'
import { useDockInset } from '@/components/common/DockInset'
import { useTheme } from '@/store/theme/hook'
import { useComponentIds, useNavActiveId } from '@/store/common/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useInteractionMotion } from '@/utils/useMotion'
import { onSettingsBack } from '@/utils/nativeModules/settingsBack'
import { createSettingsBackGesture } from './backGesture'
import { SettingsPressContext } from '@/components/common/Button'
import ElasticScrollBoundary from '@/components/common/ElasticScrollBoundary'
import SettingsBackView from '@/components/common/SettingsBackView'
import { SettingHeader } from '@/screens/Home/Vertical/Header'

interface Scene { id: SettingScreenIds, target: string }

const SettingPage = memo(({ scene, offsets, compact }: { scene: Scene, offsets: Record<string, number>, compact: boolean }) => {
  const scrollRef = useRef<ScrollView>(null)
  const restored = useRef(false)
  const position = `${scene.id}:${scene.target}`
  const dockInset = useDockInset()
  const motion = useInteractionMotion()
  return <SettingsPressContext.Provider value={true}>{compact ? <SettingHeader section={scene.id} /> : null}<ElasticScrollBoundary><ScrollView
    ref={scrollRef}
    testID={`settings-page-${scene.id}`}
    // Android 的拉伸边缘效果与原生弹性位移互斥，不能叠加两套回弹。
    overScrollMode="never"
    bounces={motion}
    style={styles.scrollView}
    contentContainerStyle={[styles.content, { paddingBottom: 28 + dockInset }]}
    keyboardShouldPersistTaps="handled"
    onContentSizeChange={() => {
      if (restored.current) return
      restored.current = true
      scrollRef.current?.scrollTo({ y: offsets[position] ?? 0, animated: false })
    }}
    onScroll={event => { offsets[position] = event.nativeEvent.contentOffset.y }}
    scrollEventThrottle={32}
  >
    <SettingContent id={scene.id} target={scene.target} />
  </ScrollView></ElasticScrollBoundary></SettingsPressContext.Provider>
})

const overview: Scene = { id: 'overview', target: '' }

export default ({ compact = true }: { compact?: boolean }) => {
  const section = useSettingSection()
  const target = useSettingTarget()
  const theme = useTheme()
  const motion = useInteractionMotion()
  const predictiveBack = useSettingValue('common.predictiveBack')
  const activeNav = useNavActiveId()
  const componentIds = useComponentIds()
  const front = activeNav == 'nav_setting' && Object.keys(componentIds).length == 1
  const detail = section != 'overview'
  const [retained, setRetained] = useState<Scene | null>(detail ? { id: section, target } : null)
  const selectedScene = useMemo(() => detail ? { id: section, target } : null, [detail, section, target])
  const scene = selectedScene ?? retained
  const offsets = useRef<Record<string, number>>({})
  const progress = useRef(new Animated.Value(detail ? 1 : 0)).current
  const previous = useRef(section)
  const [busy, setBusy] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const transitionId = useRef(0)
  const enterFrame = useRef<number | null>(null)
  const { width: windowWidth } = useWindowDimensions()
  const [pageWidth, setPageWidth] = useState(windowWidth)
  // 不能在 busy 更新时重建事件映射，否则开始侧滑的同一帧会拆掉原生进度监听。
  const onBackProgress = useMemo(() => Animated.event([{ nativeEvent: { progress } }], { useNativeDriver: true }), [progress])
  const scrimOpacity = useMemo(() => progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.16], extrapolate: 'clamp' }), [progress])
  const pageAnimation = useMemo(() => ({
    borderRadius: compact ? progress.interpolate({ inputRange: [0, 0.92, 1], outputRange: [24, 24, 0], extrapolate: 'clamp' }) : 0,
    transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [compact ? pageWidth : 0, 0], extrapolate: 'clamp' }) }],
  }), [compact, pageWidth, progress])

  const settle = useCallback((open: boolean) => {
    const id = ++transitionId.current
    if (enterFrame.current != null) { cancelAnimationFrame(enterFrame.current); enterFrame.current = null }
    progress.stopAnimation()
    setPreviewing(false)
    setSettingTransitioning(true)
    setBusy(true)
    const finish = () => {
      if (id != transitionId.current) return
      // 弹簧收敛后精确归位，避免亚像素位移在边缘留下底页细缝。
      progress.setValue(open ? 1 : 0)
      setSettingTransitioning(false)
      setBusy(false)
      if (!open) setRetained(null)
    }
    if (!motion || !front || !compact) { progress.setValue(open ? 1 : 0); finish(); return }
    const animate = () => {
      enterFrame.current = null
      if (id != transitionId.current) return
      Animated.spring(progress, { toValue: open ? 1 : 0, stiffness: 460, damping: 36, mass: 0.8, overshootClamping: true, restDisplacementThreshold: 0.001, restSpeedThreshold: 0.05, useNativeDriver: true }).start(({ finished }) => { if (finished) finish() })
    }
    // 先完成新页面的布局，再启动原生动画；不会一边入场一边补排大量设置控件。
    enterFrame.current = requestAnimationFrame(animate)
  }, [compact, front, motion, progress])

  useLayoutEffect(() => {
    if (front) Keyboard.dismiss()
    if (detail) {
      setRetained(selectedScene)
      if (previous.current == 'overview') progress.setValue(0)
    }
    previous.current = section
    settle(detail)
  }, [section, target, detail, selectedScene, settle, progress, predictiveBack, compact, front])

  useEffect(() => {
    if (!compact || !detail || !front || !motion || !predictiveBack) return
    let tracking = false
    const gesture = createSettingsBackGesture({
      preview: value => {
        if (!tracking) {
          tracking = true
          ++transitionId.current
          if (enterFrame.current != null) { cancelAnimationFrame(enterFrame.current); enterFrame.current = null }
          progress.stopAnimation()
          setPreviewing(true)
          setBusy(true)
          setSettingTransitioning(true)
        }
        // 逐帧只更新动画值，不重新渲染整页设置。
        // Android 的逐帧值由原生事件直接驱动；Web 预览沿用同一映射。
        if (Platform.OS != 'android') progress.setValue(1 - value)
      },
      cancel: () => { tracking = false; settle(true) },
      commit: () => {
        setSettingTransitioning(false)
        backToSettingOverview()
      },
    })
    const unsubscribe = onSettingsBack(event => { gesture.handle(event) })
    return () => {
      unsubscribe()
      gesture.reset(false)
    }
  }, [compact, detail, front, motion, predictiveBack, section, target, progress, settle])

  useEffect(() => () => {
    ++transitionId.current
    if (enterFrame.current != null) cancelAnimationFrame(enterFrame.current)
    progress.stopAnimation()
    setSettingTransitioning(false)
  }, [progress])

  return (
    <SettingsBackView onLayout={event => { setPageWidth(event.nativeEvent.layout.width) }} backEnabled={compact && detail && front && motion && predictiveBack} onBackProgress={onBackProgress} style={[styles.container, { backgroundColor: theme['c-content-background'] }]}>
      <Animated.View testID="settings-overview-layer" pointerEvents={!detail && !busy ? 'auto' : 'none'} accessibilityElementsHidden={detail || busy} importantForAccessibility={!detail && !busy ? 'auto' : 'no-hide-descendants'} style={[StyleSheet.absoluteFill, {
        backgroundColor: theme['c-content-background'],
        // 底页保留原位置，原生进度到达的第一帧就能露出，不等待 JS 开始事件。
      }]}>
        <SettingPage scene={overview} offsets={offsets.current} compact={compact} />
      </Animated.View>
      {compact && scene ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {
        backgroundColor: '#000',
        opacity: scrimOpacity,
      }]} /> : null}
      {scene ? <Animated.View testID="settings-detail-layer" pointerEvents={detail && !previewing ? 'auto' : 'none'} accessibilityElementsHidden={!detail} importantForAccessibility={detail ? 'auto' : 'no-hide-descendants'} style={[StyleSheet.absoluteFill, styles.detail, {
        // q-surface-base 是半透明玻璃色，不能用作两层页面之间的遮挡面。
        backgroundColor: theme['c-content-background'],
        elevation: compact && busy ? 10 : 0,
        shadowColor: '#000',
        shadowOpacity: compact && busy ? 0.16 : 0,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 18,
        // 按录屏的整页右移，左右边缘触发都向右返回；前页始终实色且不缩放。
      }, pageAnimation]}>
        <SettingPage key={`${scene.id}:${scene.target}`} scene={scene} offsets={offsets.current} compact={compact} />
      </Animated.View> : null}
    </SettingsBackView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  detail: { overflow: 'hidden' },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 28,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
  },
})
