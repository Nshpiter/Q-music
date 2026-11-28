import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Animated, ScrollView, StyleSheet, View } from 'react-native'
import songlistState, { type SortInfo, type Source } from '@/store/songlist/state'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import Button from '@/components/common/Button'
import { useMotion } from '@/utils/useMotion'
import { Q_UI } from '@/theme/ui'

export interface SortTabProps {
  onSortChange: (id: string) => void
}

export interface SortTabType {
  setSource: (source: Source, activeTab: SortInfo['id']) => void
}


export default forwardRef<SortTabType, SortTabProps>(({ onSortChange }, ref) => {
  const [sortList, setSortList] = useState<SortInfo[]>([])
  const [activeId, setActiveId] = useState<SortInfo['id']>('')
  const [layouts, setLayouts] = useState<Record<string, { x: number, width: number }>>({})
  const t = useI18n()
  const theme = useTheme()
  const motion = useMotion()
  const scrollViewRef = useRef<ScrollView>(null)
  const pillLeft = useRef(new Animated.Value(0)).current
  const pillWidth = useRef(new Animated.Value(0)).current
  const hasMeasuredRef = useRef(false)

  useImperativeHandle(ref, () => ({
    setSource(source, activeTab) {
      scrollViewRef.current?.scrollTo({ x: 0 })
      hasMeasuredRef.current = false
      setLayouts({})
      setSortList(songlistState.sortList[source]!)
      setActiveId(activeTab)
    },
  }))

  const sorts = useMemo(() => {
    return sortList.map(s => ({ label: t(`songlist_${s.tid}`), id: s.id }))
  }, [sortList, t])

  const activeLayout = layouts[activeId]
  useEffect(() => {
    if (!activeLayout) return
    pillLeft.stopAnimation()
    pillWidth.stopAnimation()
    if (!motion || !hasMeasuredRef.current) {
      pillLeft.setValue(activeLayout.x)
      pillWidth.setValue(activeLayout.width)
      hasMeasuredRef.current = true
      return
    }
    Animated.parallel([
      Animated.spring(pillLeft, { toValue: activeLayout.x, ...Q_UI.motion.settle, overshootClamping: true, useNativeDriver: false }),
      Animated.spring(pillWidth, { toValue: activeLayout.width, ...Q_UI.motion.settle, overshootClamping: true, useNativeDriver: false }),
    ]).start()
    return () => {
      pillLeft.stopAnimation()
      pillWidth.stopAnimation()
    }
  }, [activeLayout, motion, pillLeft, pillWidth])

  const handleSortChange = (id: string) => {
    if (id == activeId) return
    onSortChange(id)
    setActiveId(id)
  }

  return (
    <ScrollView ref={scrollViewRef} style={styles.container} contentContainerStyle={styles.content} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps={'always'} horizontal>
      {activeLayout ? <Animated.View
        pointerEvents="none"
        style={[
          styles.activePill,
          {
            left: pillLeft,
            width: pillWidth,
            backgroundColor: theme['q-surface-tint'],
            borderColor: theme['q-outline'],
          },
        ]}
      /> : null}
      {
        sorts.map(s => (
          <View
            key={s.id}
            onLayout={event => {
              const { x, width } = event.nativeEvent.layout
              setLayouts(prev => (prev[s.id]?.x == x && prev[s.id]?.width == width) ? prev : { ...prev, [s.id]: { x, width } })
            }}
          >
            <Button
              accessibilityRole="tab"
              accessibilityLabel={s.label}
              accessibilityState={{ selected: activeId == s.id }}
              style={[styles.button, !activeLayout && activeId == s.id ? { backgroundColor: theme['q-surface-tint'] } : null]}
              onPress={() => { handleSortChange(s.id) }}
            >
              <Text style={[styles.buttonText, activeId == s.id && styles.activeText]} color={activeId == s.id ? theme['q-accent-text'] : theme['q-text-secondary']}>{s.label}</Text>
            </Button>
          </View>
        ))
      }
    </ScrollView>
  )
})


const styles = createStyle({
  container: {
    flexGrow: 1,
    flexShrink: 1,
  },
  content: {
    position: 'relative',
    alignItems: 'center',
  },
  activePill: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  button: {
    borderRadius: 12,
    marginRight: 4,
    minHeight: Q_UI.touchSize,
    justifyContent: 'center',
    paddingLeft: 14,
    paddingRight: 14,
  },
  buttonText: {
    textAlign: 'center',
    paddingHorizontal: 2,
    paddingVertical: 3,
  },
  activeText: {
    fontWeight: '700',
  },
})
