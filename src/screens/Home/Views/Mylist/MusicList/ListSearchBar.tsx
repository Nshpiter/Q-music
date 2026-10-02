import { useState, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
import { Animated, View } from 'react-native'

import Text from '@/components/common/Text'
import Input, { type InputType } from '@/components/common/Input'

import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { BorderWidths } from '@/theme'
import Button from '@/components/common/Button'

interface SearchInputProps {
  onSearch: (keywork: string) => void
}
type SearchInputType = InputType

const SearchInput = forwardRef<SearchInputType, SearchInputProps>(({ onSearch }, ref) => {
  const [text, setText] = useState('')
  const t = useI18n()

  const handleChangeText = (text: string) => {
    setText(text)
    onSearch(text.trim())
  }

  return (
    <Input
      onChangeText={handleChangeText}
      placeholder={t('list_search')}
      accessibilityLabel={t('list_search')}
      value={text}
      style={styles.input}
      containerStyle={styles.inputContainer}
      returnKeyType="search"
      onSubmitEditing={() => { onSearch(text.trim()) }}
      clearBtn
      ref={ref}
    />
  )
})


export interface ListSearchBarProps {
  onSearch: (keywork: string) => void
  onExitSearch: () => void
}
export interface ListSearchBarType {
  show: () => void
  hide: () => void
}

export default forwardRef<ListSearchBarType, ListSearchBarProps>(({ onSearch, onExitSearch }, ref) => {
  const t = useI18n()
  // const isGetDetailFailedRef = useRef(false)
  const [visible, setVisible] = useState(false)
  const visibleRef = useRef(false)
  const [animatePlayed, setAnimatPlayed] = useState(true)
  const animFade = useRef(new Animated.Value(0)).current
  const animTranslateY = useRef(new Animated.Value(0)).current
  const searchInputRef = useRef<SearchInputType>(null)

  const theme = useTheme()

  useImperativeHandle(ref, () => ({
    show() {
      handleShow()
      requestAnimationFrame(() => {
        if (!visibleRef.current) return
        searchInputRef.current?.focus()
      })
    },
    hide() {
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
    searchInputRef.current?.blur()
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
    opacity: animFade, // Bind opacity to animated value
    transform: [
      { translateY: animTranslateY },
    ],
  }), [animFade, animTranslateY, theme])

  const component = useMemo(() => {
    return (
      <Animated.View style={animaStyle}>
        <View style={styles.content}>
          <SearchInput ref={searchInputRef} onSearch={onSearch} />
        </View>
        <Button accessibilityLabel={t('list_select_cancel')} onPress={onExitSearch} style={styles.btn}>
          <Text color={theme['q-accent-text']}>{t('list_select_cancel')}</Text>
        </Button>
      </Animated.View>
    )
  }, [animaStyle, onSearch, onExitSearch, theme, t])

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
    paddingLeft: 10,
    borderBottomWidth: BorderWidths.normal,
  },
  content: {
    flexDirection: 'row',
    flex: 1,
    minWidth: 0,
  },
  input: {
    minWidth: 0,
  },
  inputContainer: {
    borderRadius: 22,
  },
  btn: {
    minWidth: 64,
    minHeight: 48,
    paddingLeft: 12,
    paddingRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
