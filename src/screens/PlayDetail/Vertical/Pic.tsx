import { useEffect, useMemo, useState } from 'react'
import { Animated, View } from 'react-native'
// import { useLayout } from '@/utils/hooks'
import { createStyle } from '@/utils/tools'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useLayout, useWindowSize } from '@/utils/hooks'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { useNavigationComponentDidAppear } from '@/navigation'
import { HEADER_HEIGHT } from './components/Header'
import Image from '@/components/common/Image'
import { useStatusbarHeight } from '@/store/common/hook'
import commonState from '@/store/common/state'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useTrackChangeAnimation } from '@/components/player/useTrackChangeAnimation'
import { useCoverPlayScale } from '@/components/player/useCoverPlayScale'

export default ({ componentId }: { componentId: string }) => {
  const musicInfo = usePlayerMusicInfo()
  const { width: winWidth, height: winHeight } = useWindowSize()
  const statusBarHeight = useStatusbarHeight()
  const theme = useTheme()
  const { onLayout, height: availableHeight } = useLayout()

  const [animated, setAnimated] = useState(!!commonState.componentIds.playDetail)
  const [pic, setPic] = useState(musicInfo.pic)
  useEffect(() => {
    if (animated) setPic(musicInfo.pic)
  }, [musicInfo.pic, animated])

  useNavigationComponentDidAppear(componentId, () => {
    setAnimated(true)
  })

  const coverAnimation = useTrackChangeAnimation(pic, 0)
  const infoAnimation = useTrackChangeAnimation(musicInfo.id)
  const coverScale = useCoverPlayScale(animated)
  // console.log('render pic')

  const style = useMemo(() => {
    const imageSpace = availableHeight > 0 ? Math.max(72, availableHeight - Math.max(108, 100 * global.lx.fontSize)) : winHeight
    const imgWidth = Math.min(winWidth * 0.76, (winHeight - statusBarHeight - HEADER_HEIGHT) * 0.43, imageSpace)
    return {
      width: imgWidth,
      height: imgWidth,
      borderRadius: 18,
    }
  }, [availableHeight, statusBarHeight, winHeight, winWidth])

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Animated.View style={[styles.content, { opacity: coverAnimation.opacity, transform: [{ scale: coverScale }] }]}>
        <Image url={pic} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pic} style={style} />
      </Animated.View>
      <Animated.View style={[styles.trackInfo, infoAnimation]}>
        <Text size={20} style={styles.title} color={theme['q-text-primary']} numberOfLines={1}>{musicInfo.name}</Text>
        <Text size={13} color={theme['q-text-secondary']} numberOfLines={1}>{musicInfo.singer}</Text>
        {musicInfo.album && musicInfo.album != musicInfo.name
          ? <Text size={12} style={styles.album} color={theme['q-text-secondary']} numberOfLines={1}>{musicInfo.album}</Text>
          : null}
      </Animated.View>
    </View>
  )
}

const styles = createStyle({
  container: {
    flexGrow: 1,
    flexShrink: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
  content: {
    // elevation: 3,
    backgroundColor: 'rgba(0,0,0,0)',
    borderRadius: 18,
    overflow: 'hidden',
  },
  trackInfo: {
    width: '76%',
    alignItems: 'flex-start',
    marginTop: 20,
  },
  title: {
    fontWeight: '700',
    marginBottom: 6,
  },
  album: {
    marginTop: 4,
  },
})
