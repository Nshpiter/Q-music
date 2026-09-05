import { memo } from 'react'

import Slider, { type SliderProps as _SliderProps } from '@react-native-community/slider'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'

export type SliderProps = Pick<_SliderProps,
'value'
| 'minimumValue'
| 'maximumValue'
| 'onSlidingStart'
| 'onSlidingComplete'
| 'onValueChange'
| 'step'
| 'disabled'
| 'style'
| 'accessibilityLabel'
| 'accessibilityHint'
| 'testID'
>

export default memo(({ value, minimumValue, maximumValue, onSlidingStart, onSlidingComplete, onValueChange, step, disabled, style, accessibilityLabel, accessibilityHint, testID }: SliderProps) => {
  const theme = useTheme()

  const handleValueChange = (value: number) => {
    if (!onValueChange) return
    const min = minimumValue ?? value
    const max = maximumValue ?? value
    onValueChange(Math.min(Math.max(value, min), max))
  }

  return (
    <Slider
      value={value}
      style={[styles.slider, style]}
      minimumValue={minimumValue}
      maximumValue={maximumValue}
      minimumTrackTintColor={theme['q-accent']}
      maximumTrackTintColor={theme['q-outline']}
      thumbTintColor={theme['q-accent']}
      disabled={disabled}
      accessibilityRole="adjustable"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      onSlidingStart={onSlidingStart}
      onSlidingComplete={onSlidingComplete}
      onValueChange={handleValueChange}
      step={step}
    />
  )
})


const styles = createStyle({
  slider: {
    flexShrink: 0,
    flexGrow: 1,
    // width: '100%',
    // maxWidth: 300,
    minHeight: 48,
    height: 48,
    // backgroundColor: '#eee',
  },
})
