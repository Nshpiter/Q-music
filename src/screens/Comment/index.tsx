import { memo, useMemo, useEffect, useRef, useState, useCallback } from 'react'
import { View } from 'react-native'
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view'
import Header from './components/Header'
import CommentHot from './CommentHot'
import CommentNew from './CommentNew'
import { createStyle, toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { COMPONENT_IDS } from '@/config/constant'
import { setComponentId } from '@/core/common'
import PageContent from '@/components/PageContent'
import playerState from '@/store/player/state'
import { scaleSizeH } from '@/utils/pixelRatio'
import { BorderWidths } from '@/theme'
import Button from '@/components/common/Button'
import IconButton from '@/components/common/IconButton'
import { Q_UI, Q_TOUCH_HIT_SLOP } from '@/theme/ui'

type ActiveId = 'hot' | 'new'

const BAR_HEIGHT = Math.max(scaleSizeH(44), Q_UI.touchSize)

const HeaderItem = ({ id, label, isActive, onPress }: {
  id: ActiveId
  label: string
  isActive: boolean
  onPress: (id: ActiveId) => void
}) => {
  const theme = useTheme()
  // console.log(theme)
  const components = useMemo(() => (
    <Button
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isActive }}
      style={[styles.tabBtn, { borderBottomColor: isActive ? theme['c-primary-font-active'] : 'transparent' }]}
      onPress={() => { !isActive && onPress(id) }}
    >
      <Text color={isActive ? theme['c-primary-font-active'] : theme['c-font']}>{label}</Text>
    </Button>
  ), [isActive, theme, label, onPress, id])

  return components
}

const HotCommentPage = memo(({ activeId, musicInfo, onUpdateTotal }: {
  activeId: ActiveId
  musicInfo: LX.Music.MusicInfoOnline
  onUpdateTotal: (total: number) => void
}) => {
  const initedRef = useRef(false)
  const comment = useMemo(() => <CommentHot musicInfo={musicInfo} onUpdateTotal={onUpdateTotal} />, [musicInfo, onUpdateTotal])
  switch (activeId) {
    case 'hot':
      if (!initedRef.current) initedRef.current = true
      return comment
    default:
      return initedRef.current ? comment : null
  }
})

const NewCommentPage = memo(({ activeId, musicInfo, onUpdateTotal }: {
  activeId: ActiveId
  musicInfo: LX.Music.MusicInfoOnline
  onUpdateTotal: (total: number) => void
}) => {
  const initedRef = useRef(false)
  const comment = useMemo(() => <CommentNew musicInfo={musicInfo} onUpdateTotal={onUpdateTotal} />, [musicInfo, onUpdateTotal])
  switch (activeId) {
    case 'new':
      if (!initedRef.current) initedRef.current = true
      return comment
    default:
      return initedRef.current ? comment : null
  }
})

const TABS = [
  'hot',
  'new',
] as const
const getMusicInfo = (musicInfo: LX.Player.PlayMusic | null) => {
  if (!musicInfo) return null
  return 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
}
export default memo(({ componentId }: {
  componentId: string
}) => {
  const pagerViewRef = useRef<PagerView>(null)
  const [activeId, setActiveId] = useState<ActiveId>('hot')
  const [musicInfo, setMusicInfo] = useState<LX.Music.MusicInfo | null>(getMusicInfo(playerState.playMusicInfo.musicInfo))
  const t = useI18n()
  const theme = useTheme()
  const [total, setTotal] = useState({ hot: 0, new: 0 })

  useEffect(() => {
    setComponentId(COMPONENT_IDS.comment, componentId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tabs = useMemo(() => {
    return [
      { id: TABS[0], label: t('comment_tab_hot', { total: total.hot ? `(${total.hot})` : '' }) },
      { id: TABS[1], label: t('comment_tab_new', { total: total.new ? `(${total.new})` : '' }) },
    ] as const
  }, [total, t])

  const toggleTab = useCallback((id: ActiveId) => {
    setActiveId(id)
    pagerViewRef.current?.setPage(TABS.findIndex(tab => tab == id))
  }, [])

  const onPageSelected = useCallback(({ nativeEvent }: PagerViewOnPageSelectedEvent) => {
    setActiveId(TABS[nativeEvent.position])
  }, [])

  const refreshComment = useCallback(() => {
    if (!playerState.playMusicInfo.musicInfo) return
    let playerMusicInfo = playerState.playMusicInfo.musicInfo
    if ('progress' in playerMusicInfo) playerMusicInfo = playerMusicInfo.metadata.musicInfo

    if (musicInfo && musicInfo.id == playerMusicInfo.id) {
      toast(t('comment_refresh', { name: musicInfo.name }))
      return
    }
    setMusicInfo(playerMusicInfo)
  }, [musicInfo, t])

  const setHotTotal = useCallback((total: number) => {
    setTotal(totalInfo => ({ ...totalInfo, hot: total }))
  }, [])
  const setNewTotal = useCallback((total: number) => {
    setTotal(totalInfo => ({ ...totalInfo, new: total }))
  }, [])

  const commentComponent = useMemo(() => {
    return (
      <View style={styles.container}>
        <View style={{ ...styles.tabHeader, borderBottomColor: theme['c-border-background'], height: BAR_HEIGHT }}>
          <View style={styles.left}>
            {tabs.map(({ id, label }) => <HeaderItem id={id} label={label} key={id} isActive={activeId == id} onPress={toggleTab} />)}
          </View>
          <IconButton
            name="available_updates"
            accessibilityLabel={t('search_hot_search_refresh')}
            iconSize={20}
            iconColor={theme['c-600']}
            size={BAR_HEIGHT}
            variant="plain"
            expandHitSlop={false}
            hitSlop={Q_TOUCH_HIT_SLOP}
            onPress={refreshComment}
          />
        </View>
        <PagerView
          ref={pagerViewRef}
          onPageSelected={onPageSelected}
          // onPageScrollStateChanged={onPageScrollStateChanged}
          style={styles.pagerView}
        >
          <View collapsable={false} style={styles.pageStyle}>
            <HotCommentPage activeId={activeId} musicInfo={musicInfo as LX.Music.MusicInfoOnline} onUpdateTotal={setHotTotal} />
          </View>
          <View collapsable={false} style={styles.pageStyle}>
            <NewCommentPage activeId={activeId} musicInfo={musicInfo as LX.Music.MusicInfoOnline} onUpdateTotal={setNewTotal} />
          </View>
        </PagerView>
      </View>
    )
  }, [activeId, musicInfo, onPageSelected, refreshComment, setHotTotal, setNewTotal, tabs, theme, toggleTab, t])

  return (
    <PageContent>
      {
        musicInfo == null
          ? null
          : <>
            <Header musicInfo={musicInfo} />
            {
              musicInfo.source == 'local'
                ? (
                <View style={{ ...styles.container, alignItems: 'center', justifyContent: 'center' }}>
                  <Text>{t('comment_not support')}</Text>
                </View>
                  )
                : commentComponent
            }
        </>
      }

    </PageContent>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  tabHeader: {
    flexDirection: 'row',
    // paddingLeft: 10,
    paddingRight: 10,
    // justifyContent: 'center',
    borderBottomWidth: BorderWidths.normal,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    paddingLeft: 5,
  },
  tabBtn: {
    minWidth: 64,
    minHeight: Q_UI.touchSize,
    paddingLeft: 12,
    paddingRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
  },
  pagerView: {
    flex: 1,
  },
  pageStyle: {
    overflow: 'hidden',
  },
})
