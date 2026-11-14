import Content from './Content'
import PlayerBar from '@/components/player/PlayerBar'
import BottomNav from './BottomNav'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { DockInsetContext } from '@/components/common/DockInset'
import Aside from '../Horizontal/Aside'
import useAdaptiveLayout from '@/utils/hooks/useAdaptiveLayout'
import FloatingNav from './FloatingNav'
import { useKeyboard } from '@/utils/hooks'

export default () => {
  const [dockHeight, setDockHeight] = useState(0)
  const { wide, navigationPosition } = useAdaptiveLayout()
  const { keyboardShown } = useKeyboard()
  // 窗口随键盘缩放时，贴底的播放条和导航会被顶到键盘上方遮住搜索结果。
  const hideDock = !wide && keyboardShown
  return (
    <DockInsetContext.Provider value={wide || hideDock ? 0 : dockHeight}>
      <View style={styles.shell}>
        {navigationPosition == 'left' ? <Aside /> : null}
        <View style={styles.main}>
          <Content />
          <View pointerEvents={hideDock ? 'none' : 'box-none'} importantForAccessibility={hideDock ? 'no-hide-descendants' : 'auto'} style={[wide ? styles.wideDock : styles.dock, hideDock && styles.hidden]} onLayout={event => { setDockHeight(event.nativeEvent.layout.height) }}>
            <PlayerBar isHome />
            {navigationPosition == 'bottom' ? <BottomNav /> : null}
          </View>
          {navigationPosition == 'floating' ? <FloatingNav bottomInset={dockHeight} /> : null}
        </View>
        {navigationPosition == 'right' ? <Aside /> : null}
      </View>
    </DockInsetContext.Provider>
  )
}

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: 'row' },
  main: { flex: 1, minWidth: 0 },
  wideDock: { paddingTop: 8, flexShrink: 0 },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 8 },
  hidden: { opacity: 0 },
})
