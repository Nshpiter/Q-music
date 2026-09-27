import { useCallback, useRef, forwardRef, useImperativeHandle, useState } from 'react'
import { StyleSheet } from 'react-native'
import Input, { type InputType, type InputProps } from '@/components/common/Input'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useWindowSize } from '@/utils/hooks'

export interface SearchInputProps {
  onChangeText: (text: string) => void
  onSubmit: (text: string) => void
  onBlur: () => void
  onFocusText: (text: string) => void
}

export interface SearchInputType {
  setText: (text: string) => void
  // getText: () => string
  focus: () => void
  blur: () => void
}

export default forwardRef<SearchInputType, SearchInputProps>(({ onChangeText, onSubmit, onBlur, onFocusText }, ref) => {
  const theme = useTheme()
  const t = useI18n()
  const { width } = useWindowSize()
  const [text, setText] = useState('')
  const inputRef = useRef<InputType>(null)

  useImperativeHandle(ref, () => ({
    // getText() {
    //   return text.trim()
    // },
    setText(text) {
      setText(text)
    },
    focus() {
      inputRef.current?.focus()
    },
    blur() {
      inputRef.current?.blur()
    },
  }))

  const handleChangeText = (text: string) => {
    setText(text)
    onChangeText(text.trim())
  }

  const handleClearText = useCallback(() => {
    setText('')
    onChangeText('')
    onSubmit('')
  }, [onChangeText, onSubmit])

  const handleSubmit = useCallback<NonNullable<InputProps['onSubmitEditing']>>(({ nativeEvent: { text } }) => {
    onSubmit(text)
  }, [onSubmit])
  const handleSubmitPress = useCallback(() => {
    onSubmit(text)
  }, [onSubmit, text])

  return (
    <Input
      ref={inputRef}
      placeholder={t(width < 360 ? 'mobile_search' : 'mobile_search_hint')}
      accessibilityLabel={t('mobile_search_hint')}
      numberOfLines={1}
      multiline={false}
      returnKeyType="search"
      blurOnSubmit
      value={text}
      onChangeText={handleChangeText}
      // style={{ ...styles.input, backgroundColor: theme['c-primary-input-background'] }}
      onBlur={onBlur}
      onSubmitEditing={handleSubmit}
      onClearText={handleClearText}
      onFocus={() => { onFocusText(text) }}
      clearBtn
      clearButtonAccessibilityLabel={`${t('delete')} ${t('mobile_search')}`}
      actionIcon="search-2"
      actionAccessibilityLabel={t('mobile_search')}
      onActionPress={handleSubmitPress}
      containerStyle={{
        ...styles.container,
        backgroundColor: 'transparent',
        borderColor: theme['q-outline'],
      }}
    />
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderWidth: 0,
    borderRadius: 999,
    minHeight: 44,
  },
})
