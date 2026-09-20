import { createIconSetFromIcoMoon } from 'react-native-vector-icons'
import icoMoonConfig from '@/resources/fonts/selection.json'
import { scaleSizeW } from '@/utils/pixelRatio'
import { memo, type ComponentProps } from 'react'
import { useTextShadow, useTheme } from '@/store/theme/hook'
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native'
import Feather from 'react-native-vector-icons/Feather'
import Ionicons from 'react-native-vector-icons/Ionicons'

// import IconAntDesign from 'react-native-vector-icons/AntDesign'
// import IconEntypo from 'react-native-vector-icons/Entypo'
// import IconEvilIcons from 'react-native-vector-icons/EvilIcons'
// import IconFeather from 'react-native-vector-icons/Feather'
// import IconFontAwesome from 'react-native-vector-icons/FontAwesome'
// import IconFontAwesome5 from 'react-native-vector-icons/FontAwesome5'
// import IconFontisto from 'react-native-vector-icons/Fontisto'
// import IconFoundation from 'react-native-vector-icons/Foundation'
// import IconIonicons from 'react-native-vector-icons/Ionicons'
// import IconMaterialIcons from 'react-native-vector-icons/MaterialIcons'
// import IconMaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
// import IconOcticons from 'react-native-vector-icons/Octicons'
// import IconZocial from 'react-native-vector-icons/Zocial'
// import IconSimpleLineIcons from 'react-native-vector-icons/SimpleLineIcons'


const IcoMoon = createIconSetFromIcoMoon(icoMoonConfig)

// 常用操作统一为细线图标，播放控制使用同一套实心字形。
const outlineIcons: Record<string, string> = {
  'search-2': 'search',
  setting: 'settings',
  slider: 'sliders',
  love: 'heart',
  album: 'music',
  leaderboard: 'bar-chart-2',
  'download-2': 'download',
  menu: 'list',
  comment: 'message-circle',
  'chevron-left': 'chevron-left',
  'chevron-right': 'chevron-right',
  'chevron-left-2': 'chevron-left',
  'chevron-right-2': 'chevron-right',
  'chevron-down': 'chevron-down',
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
  'lyric-on': 'align-left',
  'lyric-off': 'align-left',
  music_time: 'clock',
  add_folder: 'folder-plus',
  'thumbs-up': 'thumbs-up',
}
const solidIcons: Record<string, string> = {
  play: 'play',
  pause: 'pause',
  prevMusic: 'play-skip-back',
  nextMusic: 'play-skip-forward',
  'add-music': 'heart-outline',
  'play-outline': 'play-outline',
}


// https://oblador.github.io/react-native-vector-icons/

type IconType = ReturnType<typeof createIconSetFromIcoMoon>

interface IconProps extends Omit<ComponentProps<IconType>, 'style'> {
  style?: StyleProp<TextStyle>
  rawSize?: number
}

export const Icon = memo(({ size = 15, rawSize, color, style, name, ...props }: IconProps) => {
  const theme = useTheme()
  const textShadow = useTextShadow()
  const mapped = outlineIcons[name] ?? solidIcons[name]
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


export {
  // IconAntDesign,
  // IconEntypo,
  // IconEvilIcons,
  // IconFeather,
  // IconFontAwesome,
  // IconFontAwesome5,
  // IconFontisto,
  // IconFoundation,
  // IconIonicons,
  // IconMaterialIcons,
  // IconMaterialCommunityIcons,
  // IconOcticons,
  // IconZocial,
  // IconSimpleLineIcons,
}
