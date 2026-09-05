import { useRef, useImperativeHandle, forwardRef, useCallback } from 'react'
import { TextInput, View, StyleSheet, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native'
import { Icon } from '@/components/common/Icon'
import Button from '@/components/common/Button'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { setSpText } from '@/utils/pixelRatio'
import { Q_UI } from '@/theme/ui'

const styles = createStyle({
  content: {
    flexDirection: 'row',
    flexGrow: 1,
    flexShrink: 1,
    height: Q_UI.touchSize,
    minHeight: Q_UI.touchSize,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  input: {
    borderRadius: 12,
    paddingTop: 0,
    paddingBottom: 0,
    height: Q_UI.touchSize,
    paddingLeft: 14,
    paddingRight: 0,
    flexGrow: 1,
    flexShrink: 1,
    fontSize: 14,
  },
  clearBtnContent: {
    flexGrow: 0,
    flexShrink: 0,
    width: Q_UI.touchSize,
  },
  clearBtn: {
    width: Q_UI.touchSize,
    height: Q_UI.touchSize,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
})

export interface InputProps extends TextInputProps {
  onChangeText?: (value: string) => void
  onClearText?: () => void
  clearBtn?: boolean
  clearButtonAccessibilityLabel?: string
  actionIcon?: string
  onActionPress?: () => void
  actionAccessibilityLabel?: string
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
  clearButtonAccessibilityLabel,
  actionIcon,
  onActionPress,
  actionAccessibilityLabel,
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
              <Button
                accessibilityLabel={clearButtonAccessibilityLabel ?? global.i18n.t('delete')}
                style={styles.clearBtn}
                onPress={clearText}
              >
                <Icon accessible={false} name="remove" color={theme['q-text-secondary']} size={14} />
              </Button>
            </View>
          : null
        }
        {
          actionIcon
            ? <View style={styles.clearBtnContent}>
                <Button
                  accessibilityLabel={actionAccessibilityLabel ?? actionIcon}
                  disabled={!onActionPress}
                  style={styles.clearBtn}
                  onPress={onActionPress}
                >
                  <Icon accessible={false} name={actionIcon} color={theme['q-accent-text']} size={16} />
                </Button>
              </View>
            : null
        }
      {/* </Animated.View>
      </View> */}
    </View>
  )
})

