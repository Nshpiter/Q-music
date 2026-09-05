import { forwardRef, memo, useEffect, useImperativeHandle, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import ButtonBar from './ActionBar'
import { pop, useNavigationComponentDidAppear } from '@/navigation'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { useTheme } from '@/store/theme/hook'
import Text, { AnimatedText } from '@/components/common/Text'
import Image from '@/components/common/Image'
import { useListInfo } from './state'
import { useAnimateOnecNumber } from '@/utils/hooks/useAnimateNumber'
import { useStatusbarHeight } from '@/store/common/hook'
import commonState from '@/store/common/state'
import { useI18n } from '@/lang'
import IconButton from '@/components/common/IconButton'

const IMAGE_WIDTH = 76
const COVER_RADIUS = 4

const CountText = memo(({ count }: { count: string }) => {
  const [animFade] = useAnimateOnecNumber(0, 1, 250, false)
  const [animTranslateY] = useAnimateOnecNumber(10, 0, 250, false)
  return (
    <AnimatedText style={{
      ...styles.playCount,
      opacity: animFade,
      transform: [
        { translateY: animTranslateY },
      ],
    }} numberOfLines={ 1 }>{count}</AnimatedText>
  )
}, (prevProps, nextProps) => {
  return true
})

const Pic = ({ componentId, playCount, imgUrl }: {
  componentId: string
  playCount: string
  imgUrl?: string
}) => {
  const [pic, setPic] = useState(imgUrl)
  const [animated, setAnimated] = useState(false)
  const info = useListInfo()
  useEffect(() => {
    if (animated) setPic(imgUrl)
  }, [imgUrl, animated])

  useNavigationComponentDidAppear(componentId, () => {
    setAnimated(true)
  })

  return (
    <View style={{ ...styles.listItemImg, width: IMAGE_WIDTH, height: IMAGE_WIDTH }}>
      <Image nativeID={`${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_to_${info.id}`} url={pic} style={{ flex: 1, borderRadius: COVER_RADIUS }} />
      {
        playCount && animated ? <CountText count={playCount} /> : null
      }
    </View>
  )
}

export interface HeaderProps {
  componentId: string
}

export interface HeaderType {
  setInfo: (info: DetailInfo) => void
}
export interface DetailInfo {
  name: string
  desc: string
  playCount: string
  imgUrl?: string
}

export const FixedHeader = () => {
  const statusBarHeight = useStatusbarHeight()
  const theme = useTheme()
  const t = useI18n()

  return (
    <View
      style={{
        ...styles.fixedHeader,
        paddingTop: statusBarHeight,
        backgroundColor: theme['q-surface-base'],
        borderBottomColor: theme['q-outline'],
      }}
    >
      <View style={styles.topBar}>
        <IconButton
          accessibilityLabel={t('back')}
          name="chevron-left"
          iconSize={20}
          size={48}
          style={styles.backButton}
          onPress={() => { void pop(commonState.componentIds.songlistDetail!) }}
          iconColor={theme['q-text-primary']}
        />
        <Text style={styles.pageTitle} size={17} color={theme['q-text-primary']} numberOfLines={1}>
          {t('nav_songlist')}
        </Text>
      </View>
    </View>
  )
}

export default forwardRef<HeaderType, HeaderProps>(({ componentId }: { componentId: string }, ref) => {
  const theme = useTheme()
  const info = useListInfo()
  const [detailInfo, setDetailInfo] = useState<DetailInfo>({ name: '', desc: '', playCount: '', imgUrl: info.img })

  useImperativeHandle(ref, () => ({
    setInfo(info) {
      setDetailInfo(info)
    },
  }), [])

  return (
    <View
      style={{
        ...styles.container,
        backgroundColor: theme['q-surface-base'],
        borderBottomColor: theme['q-outline'],
      }}
    >
      <View style={styles.infoRow}>
        <Pic componentId={componentId} playCount={detailInfo.playCount} imgUrl={detailInfo.imgUrl} />
        <View style={styles.info} nativeID={NAV_SHEAR_NATIVE_IDS.songlistDetail_title}>
          <Text style={styles.title} size={16} color={theme['q-text-primary']} numberOfLines={2}>{detailInfo.name}</Text>
          <View style={{ flexGrow: 0, flexShrink: 1 }}>
            <Text style={styles.description} size={12} color={theme['q-text-secondary']} numberOfLines={3}>{detailInfo.desc}</Text>
          </View>
        </View>
      </View>
      <ButtonBar />
      {/* <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexGrow: 0, flexShrink: 1, paddingTop: 5, paddingRight: 5 }}>
              <Text style={{ fontSize: 12, color: AppColors.normal20 }} numberOfLines={ 1 }>{playCount || '-'}</Text>
              <Text style={{ fontSize: 12, color: AppColors.normal30 }} numberOfLines={ 1 }>{this.props.selectListInfo.author || this.props.listDetailData.info.author}</Text>
            </View>
      </View> */}
    </View>
  )
})

const styles = StyleSheet.create({
  fixedHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexGrow: 0,
    flexShrink: 0,
  },
  topBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    flex: 1,
    paddingRight: 48,
    textAlign: 'center',
    fontWeight: '700',
  },
  container: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoRow: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: 'row',
    flexGrow: 0,
    flexShrink: 0,
  },
  info: {
    minWidth: 0,
    flexDirection: 'column',
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: 10,
  },
  title: {
    paddingBottom: 5,
    fontWeight: '700',
  },
  description: {
    lineHeight: 17,
  },
  listItemImg: {
    // backgroundColor: '#eee',
    flexGrow: 0,
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: COVER_RADIUS,
    // width: 70,
    // height: 70,
    // ...Platform.select({
    //   ios: {
    //     shadowColor: '#000',
    //     shadowOffset: {
    //       width: 0,
    //       height: 1,
    //     },
    //     shadowOpacity: 0.20,
    //     shadowRadius: 1.41,
    //   },
    //   android: {
    //     elevation: 2,
    //   },
    // }),
  },
  playCount: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    fontSize: 12,
    paddingLeft: 3,
    paddingRight: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: '#fff',
    borderBottomLeftRadius: COVER_RADIUS,
    borderBottomRightRadius: COVER_RADIUS,
  },
})
