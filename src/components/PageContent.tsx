// import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import ImageBackground from '@/components/common/ImageBackground'
import { useWindowSize } from '@/utils/hooks'
import { useMemo } from 'react'
import { scaleSizeAbsHR } from '@/utils/pixelRatio'
import { defaultHeaders } from './common/Image'
import SizeView from './SizeView'
import { useBgPic } from '@/store/common/hook'

interface Props {
  children: React.ReactNode
}

const BLUR_RADIUS = Math.max(scaleSizeAbsHR(18), 10)

export default ({ children }: Props) => {
  const theme = useTheme()
  const windowSize = useWindowSize()
  const pic = useBgPic()
  // const [wh, setWH] = useState<{ width: number | string, height: number | string }>({ width: '100%', height: Dimensions.get('screen').height })

  // 固定宽高度 防止弹窗键盘时大小改变导致背景被缩放
  // useEffect(() => {
  //   const onChange = () => {
  //     setWH({ width: '100%', height: '100%' })
  //   }

  //   const changeEvent = Dimensions.addEventListener('change', onChange)
  //   return () => {
  //     changeEvent.remove()
  //   }
  // }, [])
  // const handleLayout = (e: LayoutChangeEvent) => {
  //   // console.log('handleLayout', e.nativeEvent)
  //   // console.log(Dimensions.get('screen'))
  //   setWH({ width: e.nativeEvent.layout.width, height: Dimensions.get('screen').height })
  // }
  // console.log('render page content')

  const resizeMode = theme['bg-image-size'] == 'contain' ? 'contain' : 'cover'
  const themeOverlayColor = theme['bg-image']
    ? theme['q-surface-base']
    : theme['c-main-background']

  const themeComponent = useMemo(() => (
    <View style={{ flex: 1, overflow: 'hidden', backgroundColor: theme['c-content-background'] }}>
      <ImageBackground
        style={{ position: 'absolute', left: 0, top: 0, height: windowSize.height, width: windowSize.width, backgroundColor: theme['c-app-background'] }}
        source={theme['bg-image']}
        resizeMode={resizeMode}
      >
      </ImageBackground>
      <View style={{ flex: 1, flexDirection: 'column', backgroundColor: themeOverlayColor }}>
        <View style={styles.phoneFrame}>
          {children}
        </View>
      </View>
    </View>
  ), [children, resizeMode, theme, themeOverlayColor, windowSize.height, windowSize.width])
  const picComponent = useMemo(() => {
    return (
      <View style={{ flex: 1, overflow: 'hidden', backgroundColor: theme['c-content-background'] }}>
        <ImageBackground
          style={{ position: 'absolute', left: 0, top: 0, height: windowSize.height, width: windowSize.width, backgroundColor: theme['c-app-background'] }}
          source={{ uri: pic!, headers: defaultHeaders }}
          resizeMode="cover"
          blurRadius={BLUR_RADIUS}
        >
          <View style={{ flex: 1, flexDirection: 'column', backgroundColor: theme['q-surface-base'] }}></View>
        </ImageBackground>
        <View style={styles.phoneFrameHost}>
          <View style={{ ...styles.phoneFrame, backgroundColor: themeOverlayColor }}>
            {children}
          </View>
        </View>
      </View>
    )
  }, [children, pic, theme, themeOverlayColor, windowSize.height, windowSize.width])

  return (
    <>
      <SizeView />
      {pic ? picComponent : themeComponent}
    </>
  )
}

const styles = StyleSheet.create({
  phoneFrameHost: {
    flex: 1,
    alignItems: 'center',
  },
  phoneFrame: {
    width: '100%',
    flex: 1,
    alignSelf: 'center',
    overflow: 'hidden',
  },
})
