import { useRef, useImperativeHandle, forwardRef, useCallback } from 'react'
import { TextInput, View, TouchableOpacity, StyleSheet, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { setSpText } from '@/utils/pixelRatio'

const CONTROL_HIT_SLOP = { top: 6, right: 6, bottom: 6, left: 6 } as const

const styles = createStyle({
  content: {
    flexDirection: 'row',
    flexGrow: 1,
    flexShrink: 1,
    height: 44,
    minHeight: 44,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  input: {
    borderRadius: 12,
    paddingTop: 0,
    paddingBottom: 0,
    height: 44,
    paddingLeft: 14,
    paddingRight: 0,
    flexGrow: 1,
    flexShrink: 1,
    fontSize: 14,
  },
  clearBtnContent: {
    flexGrow: 0,
    flexShrink: 0,
    width: 44,
  },
  clearBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
})

export interface InputProps extends TextInputProps {
  onChangeText?: (value: string) => void
  onClearText?: () => void
  clearBtn?: boolean
  actionIcon?: string
  onActionPress?: () => void
  containerStyle?: StyleProp<ViewStyle>
  size?: number
}


export interface InputType {
  blur: () => void
  focus: () => void
  clear: () => void
  isFocused: () => boolean
}

export default forwardRef<InputType, InputProps>(({
  onChangeText,
  onClearText,
  clearBtn,
  actionIcon,
  onActionPress,
  containerStyle,
  style,
  size = 14,
  ...props
}, ref) => {
  const inputRef = useRef<TextInput>(null)
  const theme = useTheme()
  // const scaleClearBtn = useRef(new Animated.Value(0)).current

  useImperativeHandle(ref, () => ({
    blur() {
      inputRef.current?.blur()
    },
    focus() {
      inputRef.current?.focus()
    },
    clear() {
      inputRef.current?.clear()
    },
    isFocused() {
      return inputRef.current?.isFocused() ?? false
    },
  }))

  // const showClearBtn = useCallback(() => {
  //   Animated.timing(scaleClearBtn, {
  //     toValue: 1,
  //     duration: 200,
  //     useNativeDriver: true,
  //   }).start()
  // }, [scaleClearBtn])
  // const hideClearBtn = useCallback(() => {
  //   Animated.timing(scaleClearBtn, {
  //     toValue: 0,
  //     duration: 200,
  //     useNativeDriver: true,
  //   }).start()
  // }, [scaleClearBtn])

  const clearText = useCallback(() => {
    inputRef.current?.clear()
    // hideClearBtn()
    onChangeText?.('')
    onClearText?.()
  }, [onChangeText, onClearText])

  const changeText = useCallback((text: string) => {
    // if (text.length) {
    //   showClearBtn()
    // } else {
    //   hideClearBtn()
    // }
    onChangeText?.(text)
  }, [onChangeText])

  return (
    <View
      style={[
        styles.content,
        {
          backgroundColor: theme['q-surface-base'],
          borderColor: theme['q-outline'],
        },
        containerStyle,
      ]}
    >
      <TextInput
        autoCapitalize="none"
        onChangeText={changeText}
        autoComplete="off"
        style={StyleSheet.compose(
          StyleSheet.compose(styles.input, style),
          {
            backgroundColor: 'transparent',
            color: theme['q-text-primary'],
            fontSize: setSpText(size),
          },
        )}
        placeholderTextColor={theme['q-text-secondary']}
        selectionColor={theme['q-accent']}
        ref={inputRef} {...props} />
      {/* <View style={styles.clearBtnContent}>
      <Animated.View style={{ ...styles.clearBtnContent, transform: [{ scale: scaleClearBtn }] }}> */}
        {clearBtn && props.value
          ? <View style={styles.clearBtnContent}>
              <TouchableOpacity style={styles.clearBtn} hitSlop={CONTROL_HIT_SLOP} onPress={clearText}>
                <Icon name="remove" color={theme['q-text-secondary']} size={14} />
              </TouchableOpacity>
            </View>
          : null
        }
        {
          actionIcon
            ? <View style={styles.clearBtnContent}>
                <TouchableOpacity style={styles.clearBtn} hitSlop={CONTROL_HIT_SLOP} onPress={onActionPress}>
                  <Icon name={actionIcon} color={theme['q-accent-text']} size={16} />
                </TouchableOpacity>
              </View>
            : null
        }
      {/* </Animated.View>
      </View> */}
    </View>
  )
})

