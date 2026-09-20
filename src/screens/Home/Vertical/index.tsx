import Content from './Content'
import PlayerBar from '@/components/player/PlayerBar'
import BottomNav from './BottomNav'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { DockInsetContext } from '@/components/common/DockInset'

export default () => {
  const [dockHeight, setDockHeight] = useState(0)
  return (
    <DockInsetContext.Provider value={dockHeight}>
      <Content />
      <View pointerEvents="box-none" style={styles.dock} onLayout={event => { setDockHeight(event.nativeEvent.layout.height) }}>
        <PlayerBar isHome />
        <BottomNav />
      </View>
    </DockInsetContext.Provider>
  )
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 8 },
})
