import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import Popup, { type PopupType, type PopupProps } from '@/components/common/Popup'
import { useI18n } from '@/lang'

import SettingLyricProgress from './settings/SettingLyricProgress'
import SettingVolume from './settings/SettingVolume'
import SettingPlaybackRate from './settings/SettingPlaybackRate'
import SettingLrcFontSize from './settings/SettingLrcFontSize'
import SettingLrcAlign from './settings/SettingLrcAlign'
import SettingPlayQuality from './settings/SettingPlayQuality'
import PlayerStyleSelector from '@/components/player/PlayerStyleSelector'
import LyricFontSelector from '@/components/player/LyricFontSelector'

export interface SettingPopupProps extends Omit<PopupProps, 'children'> {
  direction: 'vertical' | 'horizontal'
}

export interface SettingPopupType {
  show: () => void
}

export default forwardRef<SettingPopupType, SettingPopupProps>(({ direction, ...props }, ref) => {
  const [visible, setVisible] = useState(false)
  const popupRef = useRef<PopupType>(null)
  // console.log('render import export')
  const t = useI18n()

  useImperativeHandle(ref, () => ({
    show() { setVisible(true) },
  }))
  useEffect(() => { popupRef.current?.setVisible(visible) }, [visible])

  return (
    visible
      ? (
        <Popup ref={popupRef} title={t('play_detail_setting_title')} {...props} transient onHide={() => { setVisible(false); props.onHide?.() }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View>
              <PlayerStyleSelector />
              <SettingLyricProgress />
              <SettingVolume />
              <SettingPlaybackRate />
              <SettingPlayQuality />
              <SettingLrcFontSize direction={direction} />
              <LyricFontSelector />
              <SettingLrcAlign />
            </View>
          </ScrollView>
        </Popup>
        )
      : null
  )
})
