import { Icon } from '@/components/common/Icon'
import IconButton from '@/components/common/IconButton'
import { useTheme } from '@/store/theme/hook'
// import { useIsPlay } from '@/store/player/hook'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { useIsPlay } from '@/store/player/hook'
import { createStyle } from '@/utils/tools'
import { useWindowSize } from '@/utils/hooks'
import { BTN_WIDTH } from './MoreBtn/Btn'
import { useMemo } from 'react'
import { qFloatingShadow } from '@/theme/ui'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import ImageBackground from '@/components/common/ImageBackground'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const gradientPrimary = require('@/resources/images/gradient-primary.png')

const PrevBtn = ({ size }: { size: number }) => {
  const theme = useTheme()
  const handlePlayPrev = () => {
    void playPrev()
  }
  return (
    <IconButton
      accessibilityLabel={global.i18n.t('play_prev')}
      name="prevMusic"
      size={size}
      iconSize={size * 0.48}
      iconColor={theme['q-text-primary']}
      radius={999}
      style={styles.cotrolBtn}
      onPress={handlePlayPrev}
    />
  )
}
const NextBtn = ({ size }: { size: number }) => {
  const theme = useTheme()
  const handlePlayNext = () => {
    void playNext()
  }
  return (
    <IconButton
      accessibilityLabel={global.i18n.t('play_next')}
      name="nextMusic"
      size={size}
      iconSize={size * 0.48}
      iconColor={theme['q-text-primary']}
      radius={999}
      style={styles.cotrolBtn}
      onPress={handlePlayNext}
    />
  )
}

const TogglePlayBtn = ({ size }: { size: number }) => {
  const isPlay = useIsPlay()
  return (
    <TouchableOpacity
      accessibilityLabel={global.i18n.t(isPlay ? 'pause' : 'play')}
      activeOpacity={0.82}
      onPress={togglePlay}
      style={{ ...styles.cotrolBtn, width: size, height: size, borderRadius: size / 2, ...qFloatingShadow }}
    >
      <ImageBackground
        source={gradientPrimary}
        style={styles.primaryBg}
        imageStyle={{ borderRadius: size / 2 }}
      >
        <View style={styles.primaryInnerHighlight} />
        <View style={styles.primaryIconWrap}>
          <Icon name={isPlay ? 'pause' : 'play'} size={size * 0.46} color="#ffffff" />
        </View>
      </ImageBackground>
    </TouchableOpacity>
  )
}

const MAX_SIZE = BTN_WIDTH * 1.5
const MIN_SIZE = BTN_WIDTH * 1.15

export default () => {
  const winSize = useWindowSize()
  const maxHeight = Math.max(winSize.height * 0.11, MIN_SIZE)
  const containerStyle = useMemo(() => {
    return {
      ...styles.conatiner,
      maxHeight,
    }
  }, [maxHeight])
  const size = Math.min(Math.max(winSize.width * 0.33 * global.lx.fontSize * 0.4, MIN_SIZE), MAX_SIZE, maxHeight)

  return (
    <View style={containerStyle}>
      <PrevBtn size={size} />
      <TogglePlayBtn size={size}/>
      <NextBtn size={size} />
    </View>
  )
}


const styles = createStyle({
  conatiner: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    flexGrow: 1,
    flexShrink: 1,
    paddingHorizontal: '13%',
    paddingVertical: 14,
    // backgroundColor: 'rgba(0, 0, 0, .1)',
  },
  cotrolBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',

    // backgroundColor: '#ccc',
    borderRadius: 999,
  },
  primaryBg: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryInnerHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.42)',
    borderLeftColor: 'rgba(255, 255, 255, 0.18)',
    borderRightColor: 'rgba(255, 255, 255, 0.05)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
  },
  primaryIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2, // 播放三角视觉居中补偿
  },
})
