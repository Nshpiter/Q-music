import { useState, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
import { Animated } from 'react-native'

import MultiSelectControls from '@/components/common/MultiSelectControls'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { BorderWidths } from '@/theme'

export type SelectMode = 'single' | 'range'

export interface MultipleModeBarProps {
  onSwitchMode: (mode: SelectMode) => void
  onSelectAll: (isAll: boolean) => void
  onExitSelectMode: () => void
}
export interface MultipleModeBarType {
  show: () => void
  setVisibleBar: (visible: boolean) => void
  setIsSelectAll: (isAll: boolean) => void
  setSwitchMode: (mode: SelectMode) => void
  exitSelectMode: () => void
}

export default forwardRef<MultipleModeBarType, MultipleModeBarProps>(({ onSelectAll, onSwitchMode, onExitSelectMode }, ref) => {
  // const isGetDetailFailedRef = useRef(false)
  const [visible, setVisible] = useState(false)
  const visibleRef = useRef(false)
  const [animatePlayed, setAnimatPlayed] = useState(true)
  const animFade = useRef(new Animated.Value(0)).current
  const animTranslateY = useRef(new Animated.Value(0)).current
  const [selectMode, setSelectMode] = useState<SelectMode>('single')
  const [isSelectAll, setIsSelectAll] = useState(false)
  const [visibleBar, setVisibleBar] = useState(true)
  const theme = useTheme()

  useImperativeHandle(ref, () => ({
    show() {
      handleShow()
    },
    setVisibleBar(visible) {
      setVisibleBar(visible)
    },
    setIsSelectAll(isAll) {
      setIsSelectAll(isAll)
    },
    setSwitchMode(mode: SelectMode) {
      setSelectMode(mode)
    },
    exitSelectMode() {
      handleHide()
    },
  }))

  const handleShow = useCallback(() => {
    visibleRef.current = true
    // console.log('show List')
    setVisible(true)
    setAnimatPlayed(false)
    requestAnimationFrame(() => {
      if (!visibleRef.current) return
      animTranslateY.setValue(-20)

      Animated.parallel([
        Animated.timing(animFade, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(animTranslateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return
        setAnimatPlayed(true)
      })
    })
  }, [animFade, animTranslateY])

  const handleHide = useCallback(() => {
    visibleRef.current = false
    setAnimatPlayed(false)
    Animated.parallel([
      Animated.timing(animFade, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(animTranslateY, {
        toValue: -20,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return
      setVisible(false)
      setAnimatPlayed(true)
    })
  }, [animFade, animTranslateY])


  const animaStyle = useMemo(() => ({
    ...styles.container,
    backgroundColor: theme['q-surface-base'],
    borderBottomColor: theme['q-outline'],
    opacity: visibleBar ? animFade : 0, // Bind opacity to animated value
    transform: [
      { translateY: animTranslateY },
    ],
  }), [animFade, animTranslateY, theme, visibleBar])

  const handleSelectAll = useCallback(() => {
    const selectAll = !isSelectAll
    setIsSelectAll(selectAll)
    onSelectAll(selectAll)
  }, [isSelectAll, onSelectAll])

  const component = useMemo(() => {
    return (
      <Animated.View
        pointerEvents={visibleBar ? 'auto' : 'none'}
        importantForAccessibility={visibleBar ? 'auto' : 'no-hide-descendants'}
        style={animaStyle}
      >
        <MultiSelectControls selectMode={selectMode} isSelectAll={isSelectAll} onSwitchMode={onSwitchMode} onSelectAll={handleSelectAll} onExitSelectMode={onExitSelectMode} />
      </Animated.View>
    )
  }, [animaStyle, selectMode, handleSelectAll, isSelectAll, onExitSelectMode, onSwitchMode, visibleBar])

  return !visible && animatePlayed ? null : component
})

const styles = createStyle({
  container: {
    flex: 1,
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: BorderWidths.normal,
  },
})
