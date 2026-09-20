import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { type InitState } from '@/store/hotSearch/state'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { clearHistoryList, getSearchHistory, removeHistoryWord } from '@/core/search/search'
import IconButton from '@/components/common/IconButton'
import { Q_TOUCH_HIT_SLOP } from '@/theme/ui'


export type List = NonNullable<InitState['sourceList'][keyof InitState['sourceList']]>

const ListItem = ({ keyword, onSearch, onRemove }: {
  keyword: string
  onSearch: (keyword: string) => void
  onRemove: (keyword: string) => void
}) => {
  const theme = useTheme()
  return (
    <Button
      accessibilityLabel={keyword}
      hitSlop={Q_TOUCH_HIT_SLOP}
      style={{
        ...styles.button,
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
      }).catch(() => { if (!isUnmountedRef.current) setList([]) })
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
      if (index < 0) return list
      list.splice(index, 1)
      removeHistoryWord(index)
      return list
    })
  }, [])

  return (
    <View
      style={{
        ...styles.card,
        backgroundColor: theme['q-surface-raised'],
        borderColor: theme['q-outline'],
      }}
    >
      <View style={styles.titleContent}>
        <Text style={styles.title} color={theme['q-text-primary']} size={14}>{t('search_history_search')}</Text>
        {list.length ? <IconButton
          accessibilityLabel={`${t('delete')} ${t('search_history_search')}`}
          name="eraser"
          size={40}
          iconSize={16}
          iconColor={theme['q-text-secondary']}
          variant="tonal"
          onPress={handleClear}
          style={styles.titleBtn}
        /> : null}
      </View>
      {!list.length ? <Text size={12} color={theme['q-text-secondary']} style={{ lineHeight: 20, paddingVertical: 8 }}>{t('search_history_empty')}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}>
        {
          list.map(keyword => <ListItem keyword={keyword} key={keyword} onSearch={props.onSearch} onRemove={handleRemove} />)
        }
      </ScrollView>
    </View>
  )
})


const styles = createStyle({
  card: {
    paddingTop: 10,
    paddingBottom: 12,
    paddingLeft: 16,
    paddingRight: 16,
    borderWidth: 1,
    borderRadius: 20,
  },
  titleContent: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontWeight: '700',
  },
  titleBtn: {
    borderRadius: 12,
  },
  list: {
    flexDirection: 'row',
  },
  button: {
    textAlign: 'center',
    minHeight: 40,
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 9,
    paddingBottom: 9,
    borderWidth: 1,
    borderRadius: 20,
    marginRight: 8,
    marginTop: 8,
    justifyContent: 'center',
  },
})
