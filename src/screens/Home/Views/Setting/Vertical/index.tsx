import { useRef } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

import Main, { type MainType } from '../Main'
import NavList from './NavList'
import { useTheme } from '@/store/theme/hook'

export default () => {
  const mainRef = useRef<MainType>(null)
  const scrollRef = useRef<ScrollView>(null)
  const theme = useTheme()

  const handleChangeId = (id: Parameters<MainType['setActiveId']>[0]) => {
    mainRef.current?.setActiveId(id)
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }

  return (
    <View style={styles.container}>
      <View style={{ ...styles.nav, backgroundColor: theme['q-surface-base'], borderBottomColor: theme['q-outline'] }}>
        <NavList onChangeId={handleChangeId} />
      </View>
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Main ref={mainRef} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  nav: {
    flexShrink: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 28,
  },
})
