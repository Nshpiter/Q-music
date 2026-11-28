import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { View } from 'react-native'

import SourceSelector, {
  type SourceSelectorType as _SourceSelectorType,
  // type SourceSelectorProps as _SourceSelectorProps,
} from '@/components/SourceSelector'
import BoardsList, { type BoardsListType, type BoardsListProps } from '../BoardsList'
import { BorderWidths } from '@/theme'
import { createStyle, toast } from '@/utils/tools'
import { handleCollect, handlePlay } from '../listAction'
import boardState, { type InitState } from '@/store/leaderboard/state'
import { useTheme } from '@/store/theme/hook'
import { getBoardsList } from '@/core/leaderboard'

type Sources = Readonly<InitState['sources']>
// type SourceSelectorProps = _SourceSelectorProps<Sources>
type SourceSelectorType = _SourceSelectorType<Sources>

export interface LeftBarProps {
  onChangeList: (source: LX.OnlineSource, id: string) => void
  onLoadError: (retry: () => void) => void
}

export interface LeftBarType {
  setBound: (source: LX.OnlineSource, id: string) => void
}

export default forwardRef<LeftBarType, LeftBarProps>(({ onChangeList, onLoadError }, ref) => {
  const theme = useTheme()
  const sourceSelectorRef = useRef<SourceSelectorType>(null)
  const boardsListRef = useRef<BoardsListType>(null)
  const boundInfo = useRef<{ source: LX.OnlineSource, id: string } | null>(null)
  const requestId = useRef(0)
  const manuallySelected = useRef(false)
  useEffect(() => () => { requestId.current++ }, [])

  const loadBoards = (source: LX.OnlineSource, preferredId?: string) => {
    const request = ++requestId.current
    sourceSelectorRef.current?.setSourceList(boardState.sources, source)
    void getBoardsList(source).then(list => {
      if (request !== requestId.current) return
      const board = list.find(item => item.id == preferredId) ?? list[0]
      if (!board) throw new Error('empty leaderboard list')
      boundInfo.current = { source, id: board.id }
      boardsListRef.current?.setList(list, board.id)
      onChangeList(source, board.id)
    }).catch(() => {
      if (request !== requestId.current) return
      const previous = boundInfo.current
      if (previous) {
        sourceSelectorRef.current?.setSourceList(boardState.sources, previous.source)
        toast(global.i18n.t('load_failed'))
      } else {
        onLoadError(() => { loadBoards(source, preferredId) })
      }
    })
  }
  useImperativeHandle(ref, () => ({
    setBound(source, listId) {
      if (!manuallySelected.current) loadBoards(source, listId)
    },
  }))


  const onSourceChange = (source: LX.OnlineSource) => {
    manuallySelected.current = true
    loadBoards(source, boundInfo.current?.source == source ? boundInfo.current.id : undefined)
  }
  const onBoundChange: BoardsListProps['onBoundChange'] = (id) => {
    const current = boundInfo.current
    if (!current) return
    requestId.current++
    manuallySelected.current = true
    current.id = id
    sourceSelectorRef.current?.setSourceList(boardState.sources, current.source)
    onChangeList(current.source, id)
  }
  const onPlay: BoardsListProps['onPlay'] = (id) => {
    const current = boardState.listDetailInfo
    void handlePlay(id, current.id == id ? current.list : undefined)
  }
  const onCollect: BoardsListProps['onCollect'] = (id, name) => {
    const [source] = id.split('__') as [LX.OnlineSource, string]
    void handleCollect(id, name, source).catch(() => { toast(global.i18n.t('load_failed')) })
  }

  return (
    <View style={{ ...styles.container, borderRightColor: theme['c-list-header-border-bottom'] }}>
      <View style={styles.selector}>
        <SourceSelector ref={sourceSelectorRef} onSourceChange={onSourceChange} />
      </View>
      <BoardsList
        ref={boardsListRef}
        onBoundChange={onBoundChange}
        onPlay={onPlay}
        onCollect={onCollect}
      />
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'column',
    width: '26%',
    maxWidth: 180,
    minWidth: 110,
    flexGrow: 0,
    flexShrink: 0,
    borderRightWidth: BorderWidths.normal,
  },
  selector: {
    height: 48,
  },
})

