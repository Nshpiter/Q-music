import { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
// import { useLayout } from '@/utils/hooks'
import { createStyle } from '@/utils/tools'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useWindowSize } from '@/utils/hooks'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { useNavigationComponentDidAppear } from '@/navigation'
import { HEADER_HEIGHT } from './components/Header'
import Image from '@/components/common/Image'
import { useStatusbarHeight } from '@/store/common/hook'
import commonState from '@/store/common/state'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { qSoftShadow } from '@/theme/ui'


export default ({ componentId }: { componentId: string }) => {
  const musicInfo = usePlayerMusicInfo()
  const { width: winWidth, height: winHeight } = useWindowSize()
  const statusBarHeight = useStatusbarHeight()
  const theme = useTheme()

  const [animated, setAnimated] = useState(!!commonState.componentIds.playDetail)
  const [pic, setPic] = useState(musicInfo.pic)
  useEffect(() => {
    if (animated) setPic(musicInfo.pic)
  }, [musicInfo.pic, animated])

  useNavigationComponentDidAppear(componentId, () => {
    setAnimated(true)
  })
  // console.log('render pic')

  const style = useMemo(() => {
    const imgWidth = Math.min(winWidth * 0.76, (winHeight - statusBarHeight - HEADER_HEIGHT) * 0.43)
    return {
      width: imgWidth,
      height: imgWidth,
      borderRadius: 24,
    }
  }, [statusBarHeight, winHeight, winWidth])

  return (
    <View style={styles.container}>
      <View style={{ ...styles.content, ...qSoftShadow, elevation: animated ? 5 : 0 }}>
        <Image url={pic} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pic} style={style} />
      </View>
      <View style={styles.trackInfo}>
        <Text size={22} style={styles.title} color={theme['q-text-primary']} numberOfLines={1}>{musicInfo.name}</Text>
        <Text size={14} color={theme['q-text-secondary']} numberOfLines={1}>{musicInfo.singer}</Text>
        {musicInfo.album
          ? <Text size={12} style={styles.album} color={theme['q-text-secondary']} numberOfLines={1}>{musicInfo.album}</Text>
          : null}
      </View>
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
    borderRadius: 24,
    overflow: 'hidden',
  },
  trackInfo: {
    width: '82%',
    alignItems: 'center',
    marginTop: 22,
  },
  title: {
    fontWeight: '700',
    marginBottom: 6,
  },
  album: {
    marginTop: 4,
  },
})
