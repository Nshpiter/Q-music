import { memo, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { useKeyboard } from '@/utils/hooks'

import Pic from './components/Pic'
import Title from './components/Title'
import PlayInfo from './components/PlayInfo'
import ControlBtn from './components/ControlBtn'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { Q_UI, qSoftShadow } from '@/theme/ui'
import { usePlayerMusicInfo } from '@/store/player/hook'


export default memo(({ isHome = false }: { isHome?: boolean }) => {
  // const { onLayout, ...layout } = useLayout()
  const { keyboardShown } = useKeyboard()
  const theme = useTheme()
  const autoHidePlayBar = useSettingValue('common.autoHidePlayBar')
  const musicInfo = usePlayerMusicInfo()

  const playerComponent = useMemo(() => (
    <View
      style={{
        ...styles.container,
        ...qSoftShadow,
        backgroundColor: theme['q-surface-raised'],
        borderColor: theme['c-primary-alpha-800'],
      }}
    >
      <View
        pointerEvents="none"
        style={{
          ...styles.innerHighlight,
          borderTopColor: theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.72)',
        }}
      />
      <View style={styles.topRow}>
        <Pic isHome={isHome} />
        <View style={styles.trackInfo}>
          <Title isHome={isHome} />
        </View>
        <View style={styles.controls}>
          <ControlBtn />
        </View>
      </View>
      <PlayInfo isHome={isHome} />
    </View>
  ), [theme, isHome])

  // console.log('render pb')

  return !musicInfo.id || (autoHidePlayBar && keyboardShown) ? null : playerComponent
})


const styles = StyleSheet.create({
  container: {
    minHeight: 96,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 10,
    marginLeft: 12,
    marginRight: 12,
    marginBottom: 10,
    borderRadius: Q_UI.radius.player,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  innerHighlight: {
    position: 'absolute',
    top: 1,
    left: 18,
    right: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  topRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackInfo: {
    flex: 1,
    flexShrink: 1,
    paddingLeft: 10,
    paddingRight: 2,
    minWidth: 0,
  },
  controls: {
    flexShrink: 0,
    alignItems: 'center',
  },
})
