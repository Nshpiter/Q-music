import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, StyleSheet } from 'react-native'
import Search from '../Views/Search'
import SongList from '../Views/SongList'
import Mylist from '../Views/Mylist'
import Leaderboard from '../Views/Leaderboard'
import Download from '../Views/Download'
import Setting from '../Views/Setting'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import { useMotion } from '@/utils/useMotion'
import { Q_UI } from '@/theme/ui'


const Main = () => {
  const [id, setId] = useState(commonState.navActiveId)
  const motion = useMotion()
  const entrance = useRef(new Animated.Value(1)).current
  const mountedRef = useRef(false)

  useEffect(() => {
    const handleUpdate = (nextId: CommonState['navActiveId']) => {
      requestAnimationFrame(() => {
        setId(nextId)
      })
    }
    global.state_event.on('navActiveIdUpdated', handleUpdate)
    return () => {
      global.state_event.off('navActiveIdUpdated', handleUpdate)
    }
  }, [])

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    entrance.stopAnimation()
    if (!motion) {
      entrance.setValue(1)
      return
    }
    entrance.setValue(0)
    Animated.spring(entrance, {
      toValue: 1,
      ...Q_UI.motion.settle,
      overshootClamping: true,
      useNativeDriver: true,
    }).start()
    return () => { entrance.stopAnimation() }
  }, [entrance, id, motion])

  const component = useMemo(() => {
    switch (id) {
      case 'nav_songlist': return <SongList />
      case 'nav_top': return <Leaderboard />
      case 'nav_love': return <Mylist />
      case 'download': return <Download />
      case 'nav_setting': return <Setting />
      case 'nav_search':
      default: return <Search />
    }
  }, [id])

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.32, 1] }),
          transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
        },
      ]}
    >
      {component}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})

export default Main

