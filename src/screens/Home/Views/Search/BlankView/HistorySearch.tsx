import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import { type InitState } from '@/store/hotSearch/state'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { clearHistoryList, getSearchHistory, removeHistoryWord } from '@/core/search/search'
import { Icon } from '@/components/common/Icon'
import { qSurfaceShadow } from '@/theme/ui'


export type List = NonNullable<InitState['sourceList'][keyof InitState['sourceList']]>

const ListItem = ({ keyword, onSearch, onRemove }: {
  keyword: string
  onSearch: (keyword: string) => void
  onRemove: (keyword: string) => void
}) => {
  const theme = useTheme()
  return (
    <Button
      style={{
        ...styles.button,
        ...qSurfaceShadow,
        backgroundColor: theme['q-surface-tint'],
        borderColor: theme['c-primary-alpha-700'],
      }}
      onPress={() => { onSearch(keyword) }}
      onLongPress={() => { onRemove(keyword) }}
    >
      <Text color={theme['q-accent-text']} size={13}>{keyword}</Text>
    </Button>
  )
}


interface HistorySearchProps {
  onSearch: (keyword: string) => void
}
export interface HistorySearchType {
  show: () => void
}

export default forwardRef<HistorySearchType, HistorySearchProps>((props, ref) => {
  const [list, setList] = useState<List>([])
  const isUnmountedRef = useRef(false)
  const t = useI18n()
  const theme = useTheme()

  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])

  useImperativeHandle(ref, () => ({
    show() {
      void getSearchHistory().then((list) => {
        if (isUnmountedRef.current) return
        setList(list)
      })
    },
  }), [])

  const handleClear = () => {
    clearHistoryList()
    setList([])
  }

  const handleRemove = useCallback((keyword: string) => {
    setList(list => {
      list = [...list]
      const index = list.indexOf(keyword)
      list.splice(index, 1)
      removeHistoryWord(index)
      return list
    })
  }, [])

  return (
    list.length
      ? (
          <View>
            <View style={styles.titleContent}>
              <Text style={styles.title} color={theme['q-text-primary']} size={14}>{t('search_history_search')}</Text>
              <TouchableOpacity
                onPress={handleClear}
                style={{ ...styles.titleBtn, backgroundColor: theme['q-surface-base'] }}
              >
                <Icon name="eraser" color={theme['q-text-secondary']} size={14} />
              </TouchableOpacity>
            </View>
            <View style={styles.list}>
              {
                list.map(keyword => <ListItem keyword={keyword} key={keyword} onSearch={props.onSearch} onRemove={handleRemove} />)
              }
            </View>
          </View>
        )
      : null
  )
})


const styles = createStyle({
  titleContent: {
    paddingTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontWeight: '700',
  },
  titleBtn: {
    marginLeft: 8,
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  button: {
    textAlign: 'center',
    minHeight: 34,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 7,
    paddingBottom: 7,
    borderWidth: 1,
    borderRadius: 17,
    marginRight: 8,
    marginTop: 8,
    justifyContent: 'center',
  },
})
