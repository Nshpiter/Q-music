import Content from './Content'
import PlayerBar from '@/components/player/PlayerBar'
import BottomNav from './BottomNav'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { DockInsetContext } from '@/components/common/DockInset'
import Aside from '../Horizontal/Aside'
import useAdaptiveLayout from '@/utils/hooks/useAdaptiveLayout'

export default () => {
  const [dockHeight, setDockHeight] = useState(0)
  const { wide, navigationPosition } = useAdaptiveLayout()
  return (
    <DockInsetContext.Provider value={wide ? 0 : dockHeight}>
      <View style={styles.shell}>
        {navigationPosition == 'left' ? <Aside /> : null}
        <View style={styles.main}>
          <Content />
          <View pointerEvents="box-none" style={wide ? styles.wideDock : styles.dock} onLayout={event => { setDockHeight(event.nativeEvent.layout.height) }}>
            <PlayerBar isHome />
            {navigationPosition == 'bottom' ? <BottomNav /> : null}
          </View>
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
})
