import { useEffect, useRef } from 'react'
import { View } from 'react-native'
import { createStyle, toast } from '@/utils/tools'

import MusicList, { type MusicListType } from '../MusicList'
import { getLeaderboardSetting, saveLeaderboardSetting } from '@/utils/data'
import DrawerLayoutFixed, { type DrawerLayoutFixedType } from '@/components/common/DrawerLayoutFixed'
import HeaderBar, { type HeaderBarType, type HeaderBarProps } from './HeaderBar'
import { scaleSizeW } from '@/utils/pixelRatio'
import { useTheme } from '@/store/theme/hook'
// import { BorderWidths } from '@/theme'
// import { useTheme } from '@/store/theme/hook'
import BoardsList, { type BoardsListType, type BoardsListProps } from '../BoardsList'
import type { InitState as CommonState } from '@/store/common/state'
import settingState from '@/store/setting/state'
import { getBoardsList } from '@/core/leaderboard'
import { COMPONENT_IDS } from '@/config/constant'
import { handleCollect, handlePlay } from '../listAction'
import boardState from '@/store/leaderboard/state'


const MAX_WIDTH = scaleSizeW(200)

export default () => {
  const drawer = useRef<DrawerLayoutFixedType>(null)
  const theme = useTheme()
  const musicListRef = useRef<MusicListType>(null)
  const isUnmountedRef = useRef(false)
  const boardsListRef = useRef<BoardsListType>(null)
  const headerBarRef = useRef<HeaderBarType>(null)
  const boundInfo = useRef<{ source: LX.OnlineSource, id: string, name: string }>({ source: 'kw', id: '', name: '' })
  const boardsRequestIdRef = useRef(0)
  // const [width, setWidth] = useState(0)

  const handleBoundChange = (source: LX.OnlineSource, id: string) => {
    musicListRef.current?.loadList(source, id)
    void saveLeaderboardSetting({
      source,
      boardId: id,
    })
  }
  const onBoundChange: BoardsListProps['onBoundChange'] = (id) => {
    boundInfo.current.id = id
    const source = boundInfo.current.source
    const requestId = ++boardsRequestIdRef.current
    void getBoardsList(source).then(list => {
      if (isUnmountedRef.current || requestId != boardsRequestIdRef.current || boundInfo.current.source != source || boundInfo.current.id != id) return
      requestAnimationFrame(() => {
        const bound = list.find(l => l.id == id)
        boundInfo.current.name = bound?.name ?? 'Unknown'
        headerBarRef.current?.setBound(source, id, boundInfo.current.name)
      })
    }).catch((error) => {
      if (isUnmountedRef.current || requestId != boardsRequestIdRef.current || boundInfo.current.source != source || boundInfo.current.id != id) return
      console.warn('[leaderboard] board name load failed', source, id, error)
      boundInfo.current.name = id
      headerBarRef.current?.setBound(source, id, id)
    })
    handleBoundChange(source, id)
    requestAnimationFrame(() => {
      drawer.current?.closeDrawer()
    })
  }
  const onPlay: BoardsListProps['onPlay'] = (id) => {
    boundInfo.current.id = id
    const currentList = boardState.listDetailInfo.id == id ? boardState.listDetailInfo.list : undefined
    void handlePlay(id, currentList)
  }
  const onCollect: BoardsListProps['onCollect'] = (id, name) => {
    boundInfo.current.id = id
    void handleCollect(id, name, boundInfo.current.source)
  }
  const onShowBound = () => {
    requestAnimationFrame(() => {
      drawer.current?.openDrawer()
    })
  }
  const onSourceChange: HeaderBarProps['onSourceChange'] = (source) => {
    if (source == boundInfo.current.source) return
    const previous = { ...boundInfo.current }
    const requestId = ++boardsRequestIdRef.current
    musicListRef.current?.showLoading()
    void getBoardsList(source).then(list => {
      if (isUnmountedRef.current || requestId != boardsRequestIdRef.current) return
      const firstBoard = list[0]
      if (!firstBoard) throw new Error('empty leaderboard list')
      const { id, name } = firstBoard
      boundInfo.current = { source, id, name: name ?? 'Unknown' }
      requestAnimationFrame(() => {
        boardsListRef.current?.setList(list, id)
        headerBarRef.current?.setBound(source, id, boundInfo.current.name)
        requestAnimationFrame(() => {
          handleBoundChange(source, id)
        })
      })
    }).catch((error) => {
      if (isUnmountedRef.current || requestId != boardsRequestIdRef.current) return
      console.warn('[leaderboard] source switch failed', source, error)
      boundInfo.current = previous
      if (previous.id) {
        headerBarRef.current?.setBound(previous.source, previous.id, previous.name)
        musicListRef.current?.loadList(previous.source, previous.id)
      } else {
        musicListRef.current?.showError()
      }
      toast(global.i18n.t('load_failed'))
    })
  }

  const navigationView = () => {
    return (
      <BoardsList
        ref={boardsListRef}
        onBoundChange={onBoundChange}
        onCollect={onCollect}
        onPlay={onPlay}
      />
    )
  }

  // const theme = useTheme()


  useEffect(() => {
    const handleFixDrawer = (id: CommonState['navActiveId']) => {
      if (id == 'nav_top') drawer.current?.fixWidth()
    }
    global.state_event.on('navActiveIdUpdated', handleFixDrawer)


    isUnmountedRef.current = false
    musicListRef.current?.showLoading()
    void getLeaderboardSetting().then(({ source, boardId }) => {
      const requestId = ++boardsRequestIdRef.current
      void getBoardsList(source).then(list => {
        if (isUnmountedRef.current || requestId != boardsRequestIdRef.current) return
        const bound = list.find(l => l.id == boardId) ?? list[0]
        if (!bound) throw new Error('empty leaderboard list')
        boundInfo.current = { source, id: bound.id, name: bound.name ?? 'Unknown' }
        boardsListRef.current?.setList(list, bound.id)
        headerBarRef.current?.setBound(source, bound.id, boundInfo.current.name)
        musicListRef.current?.loadList(source, bound.id)
      }).catch((error) => {
        if (isUnmountedRef.current || requestId != boardsRequestIdRef.current) return
        console.warn('[leaderboard] initial load failed', error)
        musicListRef.current?.showError()
      })
    }).catch((error) => {
      if (isUnmountedRef.current) return
      console.warn('[leaderboard] setting load failed', error)
      musicListRef.current?.showError()
    })

    return () => {
      global.state_event.off('navActiveIdUpdated', handleFixDrawer)
      isUnmountedRef.current = true
    }
  }, [])


  return (
    <DrawerLayoutFixed
      ref={drawer}
      visibleNavNames={[COMPONENT_IDS.home]}
      // drawerWidth={width}
      widthPercentage={0.82}
      widthPercentageMax={MAX_WIDTH}
      drawerPosition={settingState.setting['common.drawerLayoutPosition']}
      renderNavigationView={navigationView}
      drawerBackgroundColor={theme['c-content-background']}
      style={{ elevation: 1 }}
    >
      <View style={styles.container}>
        <HeaderBar ref={headerBarRef} onShowBound={onShowBound} onSourceChange={onSourceChange} />
        <MusicList ref={musicListRef} />
      </View>
    </DrawerLayoutFixed>
    // <View style={styles.container}>
    //   <LeftBar
    //     ref={leftBarRef}
    //     onChangeList={handleChangeBound}
    //   />
    //   <MusicList
    //     ref={musicListRef}
    //   />
    // </View>
  )
}

const styles = createStyle({
  container: {
    width: '100%',
    flex: 1,
    flexDirection: 'column',
    // borderTopWidth: BorderWidths.normal,
  },
  // content: {
  //   flex: 1,
  // },
})
