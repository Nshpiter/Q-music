import { useEffect, useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity } from 'react-native'

import { createStyle } from '@/utils/tools'
import { type SearchType } from '@/store/search/state'
import { useI18n } from '@/lang'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { getSearchSetting } from '@/utils/data'

const SEARCH_TYPE_LIST = [
  'music',
  'songlist',
] as const

export default () => {
  const t = useI18n()
  const theme = useTheme()
  const [type, setType] = useState<SearchType>('music')

  useEffect(() => {
    void getSearchSetting().then(info => {
      setType(info.type)
    })
  }, [])

  const list = useMemo(() => {
    return SEARCH_TYPE_LIST.map(type => ({ label: t(`search_type_${type}`), id: type }))
  }, [t])

  const handleTypeChange = (type: SearchType) => {
    setType(type)
    global.app_event.searchTypeChanged(type)
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps={'always'}
      showsHorizontalScrollIndicator={false}
      horizontal={true}
    >
      {
        list.map(t => (
          <TouchableOpacity
            activeOpacity={0.7}
            style={{
              ...styles.button,
              borderBottomColor: type == t.id ? theme['c-primary-alpha-300'] : 'transparent',
            }}
            onPress={() => { handleTypeChange(t.id) }}
            key={t.id}
          >
            <Text
              style={styles.buttonText}
              size={12}
              color={type == t.id ? theme['q-accent-text'] : theme['q-text-secondary']}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))
      }
    </ScrollView>
  )
}

const styles = createStyle({
  container: {
    height: '100%',
    flexGrow: 0,
    flexShrink: 1,
  },
  content: {
    alignItems: 'center',
    paddingLeft: 4,
    paddingRight: 4,
  },
  button: {
    height: '100%',
    justifyContent: 'center',
    paddingLeft: 14,
    paddingRight: 14,
    borderBottomWidth: 2,
  },
  buttonText: {
    textAlign: 'center',
    fontWeight: '600',
  },
})
