import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'

import Popup, { type PopupType } from '@/components/common/Popup'
import Text from '@/components/common/Text'
import { usePlayMusicInfo, usePlayerMusicInfo } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { QUALITY_BADGE } from '@/config/constant'
import { Q_UI } from '@/theme/ui'
import { createStyle } from '@/utils/tools'
import { setPlayQuality } from '@/core/player/player'
import { useI18n } from '@/lang'

const QUALITY_ORDER: LX.Quality[] = ['flac24bit', 'flac', '320k', '128k']
type QualityNameKey = 'play_detail_quality_standard' | 'play_detail_quality_high' | 'play_detail_quality_lossless' | 'play_detail_quality_lossless_hires'
const QUALITY_NAME_KEY: Record<LX.Quality, QualityNameKey> = {
  '128k': 'play_detail_quality_standard',
  '192k': 'play_detail_quality_high',
  '320k': 'play_detail_quality_high',
  flac: 'play_detail_quality_lossless',
  ape: 'play_detail_quality_lossless',
  wav: 'play_detail_quality_lossless',
  flac24bit: 'play_detail_quality_lossless_hires',
}

export interface QualityBadgeType {
  show: () => void
}

const useQualityOptions = () => {
  const playMusicInfo = usePlayMusicInfo()
  return useMemo(() => {
    const musicInfo = playMusicInfo.musicInfo
    if (!musicInfo || 'progress' in musicInfo || musicInfo.source == 'local') return []
    const sourceList = global.lx.qualityList[musicInfo.source]
    return QUALITY_ORDER.filter(q => musicInfo.meta._qualitys[q] && sourceList?.includes(q))
  }, [playMusicInfo.musicInfo])
}

const QualityBadge = forwardRef<QualityBadgeType>((_, ref) => {
  const theme = useTheme()
  const t = useI18n()
  const musicInfo = usePlayerMusicInfo()
  const playQuality = useSettingValue('player.playQuality')
  const qualityOptions = useQualityOptions()
  const [visible, setVisible] = useState(false)
  const popupRef = useRef<PopupType>(null)

  const currentQuality = musicInfo.quality ?? playQuality

  const openPopup = () => {
    if (visible) {
      popupRef.current?.setVisible(true)
      return
    }
    setVisible(true)
    requestAnimationFrame(() => {
      popupRef.current?.setVisible(true)
    })
  }

  useImperativeHandle(ref, () => ({ show: openPopup }))

  const handleChange = (quality: LX.Quality) => {
    popupRef.current?.setVisible(false)
    setPlayQuality(quality)
  }

  return (
    <>
      {
        qualityOptions.length
          ? (
            <TouchableOpacity activeOpacity={0.7} onPress={openPopup}>
              <View style={{ ...styles.badge, backgroundColor: theme['q-accent'] }}>
                <Text style={{ ...styles.badgeText, color: theme['q-on-accent'] }}>
                  {QUALITY_BADGE[currentQuality] ?? currentQuality}
                </Text>
              </View>
            </TouchableOpacity>
            )
          : null
      }
      {
        visible
          ? (
            <Popup ref={popupRef} title={t('play_detail_quality_title')}>
              <ScrollView style={styles.popupList}>
                <View onStartShouldSetResponder={() => true}>
                  {
                    qualityOptions.map(quality => {
                      const isActive = quality == currentQuality
                      return (
                        <TouchableOpacity
                          key={quality}
                          style={{ ...styles.option, borderColor: isActive ? theme['q-accent'] : theme['q-outline'] }}
                          onPress={() => { handleChange(quality) }}
                        >
                          <Text style={{ ...styles.optionBadge, color: isActive ? theme['q-accent'] : theme['c-font-label'] }}>
                            {QUALITY_BADGE[quality]}
                          </Text>
                          <Text color={isActive ? theme['c-font'] : theme['c-font-label']}>
                            {t(QUALITY_NAME_KEY[quality])}
                          </Text>
                        </TouchableOpacity>
                      )
                    })
                  }
                </View>
              </ScrollView>
            </Popup>
            )
          : null
      }
    </>
  )
})

const styles = createStyle({
  badge: {
    minWidth: 42,
    paddingHorizontal: 6,
    height: 22,
    borderRadius: Q_UI.radius.item,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  popupList: {
    maxHeight: 320,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginVertical: 2,
    borderRadius: Q_UI.radius.control,
    borderWidth: 1,
  },
  optionBadge: {
    fontSize: 12,
    fontWeight: '700',
    width: 62,
  },
})

export default QualityBadge
