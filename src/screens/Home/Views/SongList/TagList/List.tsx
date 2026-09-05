import { useCallback, useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react'
import { View, ScrollView } from 'react-native'

import { createStyle } from '@/utils/tools'
import TagGroup, { type TagGroupProps } from './TagGroup'
import { useI18n } from '@/lang'
import { type TagInfo, type Source } from '@/store/songlist/state'
import { getTags } from '@/core/songlist'
import ContentState, { type ContentStatus } from '@/components/common/ContentState'
// import { BorderWidths } from '@/theme'

export interface ListProps {
  onTagChange: TagGroupProps['onTagChange']
}

export interface ListType {
  loadTag: (source: Source, activeId: string) => void
}

export default forwardRef<ListType, ListProps>(({ onTagChange }, ref) => {
  // const theme = useTheme()
  const [activeId, setActiveId] = useState('')
  const [list, setList] = useState<TagInfo['tags']>([])
  const t = useI18n()
  const prevSource = useRef('')
  const sourceRef = useRef<Source>('kw')
  const requestIdRef = useRef(0)
  const [status, setStatus] = useState<ContentStatus | 'idle'>('idle')

  const isUnmountedRef = useRef(false)
  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])

  const loadTag = useCallback((source: Source, id: string, force = false) => {
    sourceRef.current = source
    setActiveId(id)
    if (!force && source == prevSource.current) return
    const requestId = ++requestIdRef.current
    setStatus('loading')
    setList([])
    void getTags(source).then(tagInfo => {
      if (isUnmountedRef.current || requestId != requestIdRef.current || sourceRef.current != source) return
      prevSource.current = source
      setList([
        { name: '', list: [{ name: t('songlist_tag_default'), id: '', parent_id: '', parent_name: '', source }] },
        { name: t('songlist_tag_hot'), list: [...tagInfo.hotTag] },
        ...tagInfo.tags,
      ].filter(item => item.list.length))
      setStatus('idle')
    }).catch((error) => {
      if (isUnmountedRef.current || requestId != requestIdRef.current) return
      console.warn('[songlist] tag load failed', source, error)
      setStatus('error')
    })
  }, [t])

  useImperativeHandle(ref, () => ({
    loadTag(source, id) {
      loadTag(source, id)
    },
  }), [loadTag])


  return (
    <ScrollView style={{ flexShrink: 1, flexGrow: 0 }} keyboardShouldPersistTaps={'always'}>
      <View style={styles.tagContainer}>
        {status == 'loading' ? <ContentState status="loading" /> : null}
        {status == 'error' ? <ContentState status="error" onRetry={() => { loadTag(sourceRef.current, activeId, true) }} /> : null}
        {
          status == 'idle' ? list.map((type, index) => (
            <TagGroup
              key={index}
              name={type.name}
              list={type.list}
              activeId={activeId}
              onTagChange={onTagChange}
            />
          )) : null
        }
      </View>
    </ScrollView>
  )
})


const styles = createStyle({
  tagContainer: {
    paddingTop: 15,
    paddingLeft: 15,
    paddingBottom: 15,
  },
})
