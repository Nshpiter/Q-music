import { memo, useRef } from 'react'

import { View, StyleSheet } from 'react-native'

import { pop } from '@/navigation'
import StatusBar from '@/components/common/StatusBar'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { scaleSizeH } from '@/utils/pixelRatio'
import { HEADER_HEIGHT as _HEADER_HEIGHT, NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import commonState from '@/store/common/state'
import SettingPopup, { type SettingPopupType } from '../../components/SettingPopup'
import { useStatusbarHeight } from '@/store/common/hook'
import Btn from './Btn'
import TimeoutExitBtn from './TimeoutExitBtn'

export const HEADER_HEIGHT = scaleSizeH(_HEADER_HEIGHT)


const Title = () => {
  const theme = useTheme()

  return (
    <View pointerEvents="none" style={styles.titleContent}>
      <Text numberOfLines={1} style={styles.title} size={12} color={theme['q-text-secondary']}>{global.i18n.t('mobile_now_playing')}</Text>
    </View>
  )
}

export default memo(() => {
  const popupRef = useRef<SettingPopupType>(null)
  const statusBarHeight = useStatusbarHeight()

  const back = () => {
    void pop(commonState.componentIds.playDetail!)
  }
  const showSetting = () => {
    popupRef.current?.show()
  }

  return (
    <View style={{ height: HEADER_HEIGHT + statusBarHeight, paddingTop: statusBarHeight }} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_header}>
      <StatusBar />
      <View style={styles.container}>
        <Btn icon="chevron-down" accessibilityLabel={global.i18n.t('back')} onPress={back} />
        <View style={styles.spacer} />
        <TimeoutExitBtn />
        <Btn icon="slider" accessibilityLabel={global.i18n.t('play_detail_setting_title')} onPress={showSetting} />
        <Title />
      </View>
      <SettingPopup ref={popupRef} direction="vertical" />
    </View>
  )
})


const styles = StyleSheet.create({
  container: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  spacer: {
    flex: 1,
  },
  titleContent: {
    position: 'absolute',
    left: 64,
    right: 64,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 1,
  },
  icon: {
    paddingLeft: 4,
    paddingRight: 4,
  },
})
