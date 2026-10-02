import { useState, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
import { Animated } from 'react-native'

import MultiSelectControls from '@/components/common/MultiSelectControls'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { BorderWidths } from '@/theme'
import { scaleSizeH } from '@/utils/pixelRatio'
import { Q_UI } from '@/theme/ui'

export type SelectMode = 'single' | 'range'

export const MULTI_SELECT_BAR_HEIGHT = Math.max(Q_UI.touchSize + 4, Math.round(scaleSizeH(40)))

export interface MultipleModeBarProps {
  onSwitchMode: (mode: SelectMode) => void
  onSelectAll: (isAll: boolean) => void
  onExitSelectMode: () => void
}
export interface MultipleModeBarType {
  show: () => void
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
  const theme = useTheme()

  useImperativeHandle(ref, () => ({
    show() {
      handleShow()
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
      animTranslateY.setValue(20)

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
        toValue: 20,
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
    height: MULTI_SELECT_BAR_HEIGHT,
    backgroundColor: theme['q-surface-base'],
    borderTopColor: theme['q-outline'],
    opacity: animFade, // Bind opacity to animated value
    transform: [
      { translateY: animTranslateY },
    ],
  }), [animFade, animTranslateY, theme])

  const handleSelectAll = useCallback(() => {
    const selectAll = !isSelectAll
    setIsSelectAll(selectAll)
    onSelectAll(selectAll)
  }, [isSelectAll, onSelectAll])

  const component = useMemo(() => {
    return (
      <Animated.View pointerEvents={visible && animatePlayed ? 'auto' : 'none'} importantForAccessibility={visible && animatePlayed ? 'auto' : 'no-hide-descendants'} style={animaStyle}>
        <MultiSelectControls selectMode={selectMode} isSelectAll={isSelectAll} onSwitchMode={onSwitchMode} onSelectAll={handleSelectAll} onExitSelectMode={onExitSelectMode} />
      </Animated.View>
    )
  }, [animaStyle, selectMode, handleSelectAll, isSelectAll, onExitSelectMode, onSwitchMode, visible, animatePlayed])

  return !visible && animatePlayed ? null : component
})

const styles = createStyle({
  container: {
    flex: 1,
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: '100%',
    // height: 40,
    flexDirection: 'row',
    borderTopWidth: BorderWidths.normal,
    alignItems: 'center',
  },
})
