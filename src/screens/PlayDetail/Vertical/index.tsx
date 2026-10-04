import { memo, useState, useRef, useEffect } from 'react'
import { Animated, View, AppState } from 'react-native'

import Header from './components/Header'
// import Aside from './components/Aside'
// import Main from './components/Main'
import Player from './Player'
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view'
import Pic from './Pic'
import Lyric from './Lyric'
import PlayBg from './PlayBg'
import { screenkeepAwake, screenUnkeepAwake } from '@/utils/nativeModules/utils'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import Button from '@/components/common/Button'
import { useMotion } from '@/utils/useMotion'
import { Q_UI } from '@/theme/ui'

const LyricPage = ({ activeIndex }: { activeIndex: number }) => {
  const initedRef = useRef(false)
  switch (activeIndex) {
    // case 3:
    case 1:
      if (!initedRef.current) initedRef.current = true
      return <Lyric active />
    default:
      return initedRef.current ? <Lyric active={false} /> : null
  }
  // return activeIndex == 0 || activeIndex == 1 ? setting : null
}

const PageDot = ({ active }: { active: boolean }) => {
  const theme = useTheme()
  const motion = useMotion()
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current
  useEffect(() => {
    progress.stopAnimation()
    if (motion) Animated.spring(progress, { toValue: active ? 1 : 0, ...Q_UI.motion.settle, useNativeDriver: false }).start()
    else progress.setValue(active ? 1 : 0)
    return () => { progress.stopAnimation() }
  }, [active, motion, progress])
  return <Animated.View style={{
    width: progress.interpolate({ inputRange: [0, 1], outputRange: [4, 14], extrapolate: 'clamp' }),
    height: 4,
    borderRadius: 2,
    backgroundColor: progress.interpolate({ inputRange: [0, 1], outputRange: [String(theme['q-outline']), String(theme['q-text-primary'])], extrapolate: 'clamp' }),
  }} />
}

// global.iskeep = false
export default memo(({ componentId }: { componentId: string }) => {
  const t = useI18n()
  const [pageIndex, setPageIndex] = useState(0)
  const showLyricRef = useRef(false)
  const pagerViewRef = useRef<PagerView>(null)

  const onPageSelected = ({ nativeEvent }: PagerViewOnPageSelectedEvent) => {
    setPageIndex(nativeEvent.position)
    showLyricRef.current = nativeEvent.position == 1
    if (showLyricRef.current) {
      screenkeepAwake()
    } else {
      screenUnkeepAwake()
    }
  }

  useEffect(() => {
    let appstateListener = AppState.addEventListener('change', (state) => {
      switch (state) {
        case 'active':
          if (showLyricRef.current && !commonState.componentIds.comment) screenkeepAwake()
          break
        case 'background':
          screenUnkeepAwake()
          break
      }
    })

    const handleComponentIdsChange = (ids: CommonState['componentIds']) => {
      if (ids.comment) screenUnkeepAwake()
      else if (showLyricRef.current && AppState.currentState == 'active') screenkeepAwake()
    }

    global.state_event.on('componentIdsUpdated', handleComponentIdsChange)

    return () => {
      global.state_event.off('componentIdsUpdated', handleComponentIdsChange)
      appstateListener.remove()
      screenUnkeepAwake()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <PlayBg lyricActive={pageIndex == 1} />
      <Header />
      <View style={styles.container}>
        <PagerView
          ref={pagerViewRef}
          onPageSelected={onPageSelected}
          // onPageScrollStateChanged={onPageScrollStateChanged}
          style={styles.pagerView}
        >
          <View collapsable={false}>
            <Pic componentId={componentId} />
          </View>
          <View collapsable={false}>
            <LyricPage activeIndex={pageIndex} />
          </View>
        </PagerView>
        <View style={styles.pageIndicator}>
          {[t('play_detail_page_cover'), t('play_detail_page_lyric')].map((label, index) => {
            const active = pageIndex == index
            return (
              <Button
                key={label}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: active }}
                style={styles.pageIndicatorItem}
                ripple={null}
                onPress={() => { pagerViewRef.current?.setPage(index) }}
              >
                <PageDot active={active} />
              </Button>
            )
          })}
        </View>
        <Player />
      </View>
    </>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  pagerView: {
    flex: 1,
  },
  pageIndicator: {
    height: 24,
    alignSelf: 'center',
    flexDirection: 'row',
  },
  pageIndicatorItem: {
    width: 36,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
