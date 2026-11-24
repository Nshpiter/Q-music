import { useState } from 'react'

import { View } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import Slider, { type SliderProps } from '@/components/common/Slider'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import styles from './style'


const LrcFontSize = ({ direction }: {
  direction: 'horizontal' | 'vertical'
}) => {
  const theme = useTheme()
  const settingKey = direction == 'horizontal' ? 'playDetail.horizontal.style.lrcFontSize' : 'playDetail.vertical.style.lrcFontSize'
  const lrcFontSize = useSettingValue(settingKey)
  const [sliderSize, setSliderSize] = useState(lrcFontSize)
  const [isSliding, setSliding] = useState(false)
  const edgeFade = useSettingValue('playDetail.lyricEdgeFade')
  const [dragFade, setDragFade] = useState<number | null>(null)
  const dimming = useSettingValue('playDetail.lyricDimming')
  const [dragDimming, setDragDimming] = useState<number | null>(null)
  const t = useI18n()

  const handleSlidingStart: SliderProps['onSlidingStart'] = value => {
    setSliding(true)
  }
  const handleValueChange: SliderProps['onValueChange'] = value => {
    setSliderSize(value)
  }
  const handleSlidingComplete: SliderProps['onSlidingComplete'] = value => {
    setSliding(false)
    if (lrcFontSize == value) return
    updateSetting({ [settingKey]: value })
  }

  return (
    <View style={styles.container}>
      <Text>{t('play_detail_setting_lrc_font_size')}</Text>
      <View style={styles.content}>
        <Text style={styles.label} color={theme['c-font-label']}>{isSliding ? sliderSize : lrcFontSize}</Text>
        <Slider
          minimumValue={100}
          maximumValue={300}
          onSlidingComplete={handleSlidingComplete}
          onValueChange={handleValueChange}
          onSlidingStart={handleSlidingStart}
          step={2}
          value={lrcFontSize}
        />
      </View>
      <Text>{t('lyric_edge_fade')}</Text>
      <View style={styles.content}>
        <Text style={styles.label} color={theme['c-font-label']}>{dragFade ?? edgeFade}%</Text>
        <Slider accessibilityLabel={t('lyric_edge_fade')} minimumValue={0} maximumValue={36} step={1} value={edgeFade} onValueChange={setDragFade}
          onSlidingComplete={value => { updateSetting({ 'playDetail.lyricEdgeFade': value }); setDragFade(null) }} />
      </View>
      <Text>{t('lyric_background_dimming')}</Text>
      <View style={styles.content}>
        <Text style={styles.label} color={theme['c-font-label']}>{dragDimming ?? dimming}%</Text>
        <Slider accessibilityLabel={t('lyric_background_dimming')} minimumValue={0} maximumValue={60} step={5} value={dimming} onValueChange={setDragDimming}
          onSlidingComplete={value => { updateSetting({ 'playDetail.lyricDimming': value }); setDragDimming(null) }} />
      </View>
    </View>
  )
}

export default LrcFontSize
