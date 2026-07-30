import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { type Source, type InitState } from '@/store/hotSearch/state'
import Button from '@/components/common/Button'
import { getList } from '@/core/hotSearch'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { qSurfaceShadow } from '@/theme/ui'


interface ListProps {
  onSearch: (keyword: string) => void
}
export interface HotSearchType {
  show: (source: Source) => void
}


export type List = NonNullable<InitState['sourceList'][keyof InitState['sourceList']]>

const ListItem = ({ keyword, onSearch }: {
  keyword: string
  onSearch: (keyword: string) => void
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
    >
      <Text color={theme['q-accent-text']} size={13}>{keyword}</Text>
    </Button>
  )
}

export default forwardRef<HotSearchType, ListProps>((props, ref) => {
  // const [listType, setListType] = useState<SearchState['searchType']>('music')
  // const listRef = useRef<MusicListType>(null)
  const [list, setList] = useState<List>([])
  const t = useI18n()
  const theme = useTheme()

  const isUnmountedRef = useRef(false)
  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])

  useImperativeHandle(ref, () => ({
    show(source) {
      void getList(source).then((list) => {
        if (isUnmountedRef.current) return
        setList(list)
      })
    },
  }), [])

  return (
    list.length
      ? (
          <ScrollView>
            <Text style={styles.title} color={theme['q-text-primary']} size={14}>{t('search_hot_search')}</Text>
            <View style={styles.list}>
              {
                list.map(keyword => <ListItem keyword={keyword} key={keyword} onSearch={props.onSearch} />)
              }
            </View>
          </ScrollView>
        )
      : null
  )
})


const styles = createStyle({
  title: {
    paddingTop: 15,
    fontWeight: '700',
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
