import { useCallback, useEffect, useRef, useState } from 'react'
import MusicList from './MusicList'
import MyList from './MyList'
import { useTheme } from '@/store/theme/hook'
import LibraryShortcuts from './LibraryShortcuts'
import { View } from 'react-native'
import useAdaptiveLayout from '@/utils/hooks/useAdaptiveLayout'
import { setActiveList } from '@/core/list'
import { getListPrevSelectId } from '@/utils/data'
import playerState from '@/store/player/state'

export default () => {
  const [opened, setOpened] = useState(false)
  const selectionMade = useRef(false)
  const theme = useTheme()
  const { splitLibrary, width, railWidth } = useAdaptiveLayout()
  const close = useCallback(() => { setOpened(false) }, [])
  const open = useCallback((id: string) => { selectionMade.current = true; setActiveList(id); setOpened(true) }, [])

  useEffect(() => {
    let cancelled = false
    const onSelection = () => { cancelled = true }
    global.state_event.on('mylistToggled', onSelection)
    void getListPrevSelectId().then(id => { if (!cancelled && !selectionMade.current && !global.lx.jumpMyListPosition) setActiveList(id) }).catch(() => {})
    return () => { cancelled = true; global.state_event.off('mylistToggled', onSelection) }
  }, [])

  useEffect(() => {
    const jump = () => {
      if (splitLibrary || opened) return
      const id = playerState.playMusicInfo.listId
      if (!id) return
      global.lx.jumpMyListPosition = true
      open(id)
    }
    global.app_event.on('jumpListPosition', jump)
    if (global.lx.jumpMyListPosition) jump()
    return () => { global.app_event.off('jumpListPosition', jump) }
  }, [open, opened, splitLibrary])

  useEffect(() => {
    const showCatalog = (visible: boolean) => { if (visible) close() }
    global.app_event.on('changeLoveListVisible', showCatalog)
    return () => { global.app_event.off('changeLoveListVisible', showCatalog) }
  }, [close])

  if (splitLibrary) {
    return <View style={{ flex: 1, flexDirection: 'row' }}>
      <View style={{ width: Math.min(280, (width - railWidth) * 0.3), borderRightWidth: 1, borderRightColor: theme['q-outline'] }}><MyList embedded /></View>
      <View style={{ flex: 1, minWidth: 0 }}><LibraryShortcuts /><MusicList /></View>
    </View>
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, display: opened ? 'none' : 'flex' }} importantForAccessibility={opened ? 'no-hide-descendants' : 'auto'}>
        <MyList catalog onSelect={open} />
      </View>
      {opened ? <MusicList onBack={close} /> : null}
    </View>
  )
}
