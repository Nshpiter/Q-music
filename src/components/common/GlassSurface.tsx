import { memo } from 'react'
import { Platform, requireNativeComponent, StyleSheet, View, type ViewProps } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useMotion } from '@/utils/useMotion'
import { Q_BLUR_PRESETS } from '@/theme/ui'

interface NativeGlassProps extends ViewProps {
  glassSelection: boolean
  glassEnabled: boolean
  glassDark: boolean
  glassMotion: boolean
  glassRadius: number
  glassBlur: number
}
const NativeGlass = Platform.OS == 'android' ? requireNativeComponent<NativeGlassProps>('QGlassView') : null

// 半透明底栏会经过深浅封面，材质与前景共同保证文字对比。
export const useGlassColors = () => {
  const theme = useTheme()
  return theme.isDark
    ? { primary: '#f8fafc', secondary: '#cfddda', active: '#ffffff' }
    : { primary: '#252b30', secondary: '#4d5a60', active: '#202b31' }
}

// 导航与迷你播放器共用真实背景采样和材质，文字作为原生玻璃的子节点保持清晰。
export default memo(({ children, style, radius = 24, selection = false, ...props }: ViewProps & { radius?: number, selection?: boolean }) => {
  const theme = useTheme()
  const performanceMode = useSettingValue('theme.performanceMode')
  const blurLevel = useSettingValue('theme.blurLevel')
  const motion = useMotion()
  const panelStyle = [styles.panel, { borderRadius: radius }, style]
  return NativeGlass
    ? <NativeGlass {...props} glassSelection={selection} glassEnabled={!performanceMode} glassDark={theme.isDark} glassMotion={motion} glassRadius={radius} glassBlur={Q_BLUR_PRESETS[blurLevel].radius} style={panelStyle}>{children}</NativeGlass>
    : <View {...props} style={[panelStyle, { backgroundColor: theme['c-content-background'], borderWidth: StyleSheet.hairlineWidth, borderColor: theme['q-outline'] }]}>{children}</View>
})

const styles = StyleSheet.create({
  panel: { overflow: 'hidden' },
})
