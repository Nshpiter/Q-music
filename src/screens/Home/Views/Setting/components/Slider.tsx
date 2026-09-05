
import { memo } from 'react'

import Slider, { type SliderProps } from '@react-native-community/slider'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

export type {
  SliderProps,
}

export default memo(({ value, minimumValue, maximumValue, onSlidingStart, onSlidingComplete, onValueChange, step, disabled, style, accessibilityLabel, accessibilityHint, testID }: SliderProps) => {
  const theme = useTheme()

  return (
    <Slider
      value={value}
      style={[styles.slider, style]}
      minimumValue={minimumValue}
      maximumValue={maximumValue}
      minimumTrackTintColor={theme['c-button-background-active']}
      maximumTrackTintColor={theme['c-button-background']}
      thumbTintColor={theme['c-primary-light-100']}
      disabled={disabled}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      onSlidingStart={onSlidingStart}
      onSlidingComplete={onSlidingComplete}
      onValueChange={onValueChange}
      step={step}
    />
  )
})


const styles = createStyle({
  slider: {
    flexShrink: 0,
    flexGrow: 1,
    // width: '100%',
    maxWidth: 300,
    minHeight: 48,
    height: 48,
  },
})
