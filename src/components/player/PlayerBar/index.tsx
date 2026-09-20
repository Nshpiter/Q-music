import { memo, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useKeyboard } from '@/utils/hooks'

import Pic from './components/Pic'
import Title from './components/Title'
import PlayInfo from './components/PlayInfo'
import ControlBtn from './components/ControlBtn'
import { useSettingValue } from '@/store/setting/hook'
import { Q_UI } from '@/theme/ui'
import { usePlayerMusicInfo } from '@/store/player/hook'
import GlassSurface from '@/components/common/GlassSurface'


export default memo(({ isHome = false }: { isHome?: boolean }) => {
  // const { onLayout, ...layout } = useLayout()
  const { keyboardShown } = useKeyboard()
  const autoHidePlayBar = useSettingValue('common.autoHidePlayBar')
  const musicInfo = usePlayerMusicInfo()
  const [compact, setCompact] = useState(false)

  const playerComponent = useMemo(() => (
    <GlassSurface
      radius={Q_UI.radius.miniPlayer}
      onLayout={event => { setCompact(event.nativeEvent.layout.width < 330) }}
      style={styles.container}
    >
      <View style={styles.topRow}>
        {!compact ? <Pic isHome={isHome} /> : null}
        <View style={[styles.trackInfo, compact && styles.compactInfo]}>
          <Title isHome={isHome} />
        </View>
        <View style={styles.controls}>
          <ControlBtn />
        </View>
      </View>
      <PlayInfo isHome={isHome} />
    </GlassSurface>
  ), [isHome, compact])

  // console.log('render pb')

  return !musicInfo.id || (autoHidePlayBar && keyboardShown) ? null : playerComponent
})


const styles = StyleSheet.create({
  container: {
    minHeight: 58,
    paddingTop: 2,
    paddingBottom: 0,
    paddingHorizontal: 8,
    marginLeft: 14,
    marginRight: 14,
    marginBottom: 8,
    borderRadius: Q_UI.radius.miniPlayer,
    overflow: 'hidden',
  },
  topRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackInfo: {
    flex: 1,
    flexBasis: 0,
    flexShrink: 1,
    paddingLeft: 10,
    paddingRight: 2,
    minWidth: 0,
    overflow: 'hidden',
  },
  compactInfo: { paddingLeft: 2 },
  controls: {
    width: 176,
    flexShrink: 0,
    alignItems: 'center',
  },
})
