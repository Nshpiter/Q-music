import { createIconSetFromIcoMoon } from 'react-native-vector-icons'
import icoMoonConfig from '@/resources/fonts/selection.json'
import { scaleSizeW } from '@/utils/pixelRatio'
import { memo, type ComponentProps } from 'react'
import { useTextShadow, useTheme } from '@/store/theme/hook'
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native'
import Feather from 'react-native-vector-icons/Feather'
import Ionicons from 'react-native-vector-icons/Ionicons'

const IcoMoon = createIconSetFromIcoMoon(icoMoonConfig)

// 常用操作统一为细线图标，播放控制使用同一套实心字形。
const outlineIcons: Record<string, string> = {
  mic: 'mic',
  'dots-horizontal': 'more-horizontal',
  disc: 'disc',
  radio: 'radio',
  shield: 'shield',
  save: 'save',
  tool: 'tool',
  copy: 'copy',
  'search-2': 'search',
  slider: 'sliders',
  love: 'heart',
  'cloud-library': 'cloud',
  eye: 'eye',
  'eye-off': 'eye-off',
  menu: 'list',
  comment: 'message-circle',
  'chevron-left': 'chevron-left',
  'chevron-right': 'chevron-right',
  'chevron-left-2': 'chevron-left',
  'chevron-right-2': 'chevron-right',
  'chevron-down': 'chevron-down',
  'chevron-up': 'chevron-up',
  remove: 'x',
  close: 'x',
  'dots-vertical': 'more-vertical',
  share: 'share-2',
  help: 'help-circle',
  available_updates: 'refresh-cw',
  check: 'check',
  'list-loop': 'repeat',
  'list-random': 'shuffle',
  'list-order': 'list',
  music_time: 'clock',
  add_folder: 'folder-plus',
  folder: 'folder',
  add: 'plus',
  'thumbs-up': 'thumbs-up',
}
// 导航的两种状态用同一家族的轮廓与实心版本，形状在切换时保持稳定。
const stateIcons: Record<string, string> = {
  discover: 'compass',
  album: 'albums',
  leaderboard: 'podium',
  user: 'person',
  setting: 'settings',
  'download-2': 'download',
}
const ionIcons: Record<string, string> = {
  palette: 'color-palette-outline',
  home: 'home-outline',
  'playback-rate': 'speedometer-outline',
  'volume-off': 'volume-off-outline',
  'volume-mute': 'volume-mute-outline',
  'volume-low': 'volume-low-outline',
  'volume-medium': 'volume-medium-outline',
  'volume-higt': 'volume-high-outline',
  'version-info': 'information-circle-outline',
  play: 'play',
  pause: 'pause',
  prevMusic: 'play-skip-back',
  nextMusic: 'play-skip-forward',
  'add-music': 'heart-outline',
  'heart-filled': 'heart',
  'play-outline': 'play-outline',
  translation: 'language-outline',
  'platform-playlists': 'albums-outline',
}


// https://oblador.github.io/react-native-vector-icons/

type IconType = ReturnType<typeof createIconSetFromIcoMoon>

interface IconProps extends Omit<ComponentProps<IconType>, 'style'> {
  style?: StyleProp<TextStyle>
  rawSize?: number
  selected?: boolean
}

export const Icon = memo(({ size = 15, rawSize, color, style, name, selected = false, ...props }: IconProps) => {
  const theme = useTheme()
  const textShadow = useTextShadow()
  const stateIcon = stateIcons[name]
  const mapped = stateIcon ? (selected ? stateIcon : `${stateIcon}-outline`) : outlineIcons[name] ?? ionIcons[name]
  if (mapped) {
    const Glyph = outlineIcons[name] ? Feather : Ionicons
    // 图标库仍引用旧版 RN TextStyle，在边界统一适配样式类型。
    const glyphStyle = [{ includeFontPadding: false, textAlignVertical: 'center' }, style] as unknown as ComponentProps<typeof Feather>['style']
    return <Glyph {...props} name={mapped} size={rawSize ?? scaleSizeW(size)} color={color ?? theme['c-font']} style={glyphStyle} />
  }
  const newStyle = textShadow ? StyleSheet.compose({
    textShadowColor: theme['c-primary-dark-300-alpha-800'],
    textShadowOffset: { width: 0.2, height: 0.2 },
    textShadowRadius: 2,
  }, style) : style
  return (
    <IcoMoon
      size={rawSize ?? scaleSizeW(size)}
      color={color ?? theme['c-font']}
      name={name}
      // @ts-expect-error
      style={newStyle}
      {...props}
    />
  )
})
