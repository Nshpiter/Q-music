import { Platform, type ViewStyle } from 'react-native'

export const Q_UI = {
  radius: {
    item: 10,
    control: 12,
    cover: 14,
    player: 24,
  },
  touchSize: 48,
} as const

export const qSoftShadow: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: '#365A48',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },
  android: {
    elevation: 6,
    shadowColor: '#365A48',
  },
}) ?? {}

export const qSurfaceShadow: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: '#365A48',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
  },
  android: {
    elevation: 2,
    shadowColor: '#365A48',
  },
}) ?? {}

export const qFloatingShadow: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: '#365A48',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
  },
  android: {
    elevation: 10,
    shadowColor: '#365A48',
  },
}) ?? {}
