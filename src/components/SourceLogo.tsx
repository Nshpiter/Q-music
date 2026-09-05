import { useEffect, useState } from 'react'
import { Image, StyleSheet, Text as NativeText, View, type StyleProp, type ViewStyle } from 'react-native'

import { SOURCE_LOGO_ASSETS } from '@/resources/sourceLogoAssetsHiRes'
import { useTheme } from '@/store/theme/hook'

export interface SourceLogoProps {
  source?: string | null
  size?: number
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

export interface SourceLogoDefinition {
  label: string
  mark: string
  color: string
}

/**
 * Text marks are deterministic fallbacks for extension-defined providers.
 * First-party providers use the locally bundled square assets above.
 */
export const SOURCE_LOGOS: Readonly<Record<string, SourceLogoDefinition>> = {
  all: { label: '聚合搜索', mark: '合', color: '#64748b' },
  bd: { label: '百度音乐', mark: '百', color: '#2f7cf6' },
  tx: { label: 'QQ音乐', mark: 'Q', color: '#16b978' },
  wy: { label: '网易云音乐', mark: '云', color: '#e6172d' },
  kg: { label: '酷狗音乐', mark: 'K', color: '#2489e8' },
  kw: { label: '酷我音乐', mark: 'K', color: '#ff9d19' },
  mg: { label: '咪咕音乐', mark: 'M', color: '#ee2d7b' },
  spotify: { label: 'Spotify', mark: 'S', color: '#1db954' },
} as const

const DEFAULT_LOGO_COLOR = '#64748b'
const MIN_LOGO_SIZE = 12
const AGGREGATE_MARK_CELLS = [0, 1, 2, 3] as const

// Extensions may return legacy ids or display-name aliases. Keep the visual
// identity canonical at this boundary so Android badges remain consistent.
const SOURCE_ALIASES: Readonly<Record<string, string>> = {
  qq: 'tx',
  qqmusic: 'tx',
  tencent: 'tx',
  netease: 'wy',
  neteasecloud: 'wy',
  kugou: 'kg',
  kuwo: 'kw',
  migu: 'mg',
} as const

export const normalizeSource = (source: string | null | undefined) => {
  const key = (source ?? '').trim().toLowerCase()
  return SOURCE_ALIASES[key] ?? key
}

const getDefinition = (source: string): SourceLogoDefinition => {
  const definition = SOURCE_LOGOS[source]
  if (definition) return definition

  return {
    label: source,
    mark: source.slice(0, 1).toUpperCase() || '?',
    color: DEFAULT_LOGO_COLOR,
  }
}

export default ({
  source,
  size = 24,
  disabled = false,
  style,
}: SourceLogoProps) => {
  const theme = useTheme()
  const normalizedSource = normalizeSource(source)
  const definition = getDefinition(normalizedSource)
  const asset = SOURCE_LOGO_ASSETS[normalizedSource]
  const [assetFailed, setAssetFailed] = useState(false)
  const dimension = Math.max(MIN_LOGO_SIZE, Math.round(size))
  const radius = Math.max(4, Math.round(dimension * 0.24))
  // Bundled marks already contain their own background and edge treatment;
  // give them the full optical box. Text fallbacks keep a one-pixel frame so
  // extension-defined providers still match the branded badges.
  const assetInset = asset ? 0 : 1
  const contentDimension = Math.max(1, dimension - assetInset * 2)

  useEffect(() => {
    setAssetFailed(false)
  }, [asset, normalizedSource])

  const assetUri = !assetFailed ? asset : undefined

  const fallback = normalizedSource === 'all'
    ? (
        <View style={[styles.fallback, { width: contentDimension, height: contentDimension, borderRadius: Math.max(2, radius - 1), backgroundColor: theme['q-surface-tint'] }]}>
          <View style={[styles.aggregateMark, { width: contentDimension * 0.52, height: contentDimension * 0.52 }]}>
            {AGGREGATE_MARK_CELLS.map(index => (
              <View
                key={index}
                style={[
                  styles.aggregateDot,
                  {
                    width: contentDimension * 0.2,
                    height: contentDimension * 0.2,
                    borderRadius: Math.max(1, contentDimension * 0.04),
                    backgroundColor: theme['q-accent-text'],
                  },
                ]}
              />
            ))}
          </View>
        </View>
      )
    : (
        <View style={[styles.fallback, { width: contentDimension, height: contentDimension, borderRadius: Math.max(2, radius - 1), backgroundColor: definition.color }]}>
          <NativeText
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.mark, { fontSize: Math.max(9, Math.round(contentDimension * 0.48)) }]}
          >
            {definition.mark}
          </NativeText>
        </View>
      )

  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      pointerEvents="none"
      style={[
        styles.container,
        {
          width: dimension,
          height: dimension,
          borderRadius: radius,
          borderWidth: asset ? 0 : StyleSheet.hairlineWidth,
          borderColor: theme['q-outline'],
          backgroundColor: theme['q-surface-tint'],
          opacity: disabled ? 0.38 : 1,
        },
        style,
      ]}
    >
      {fallback}
      {assetUri
        ? <Image
            accessible={false}
            fadeDuration={0}
            key={assetUri}
            onError={() => { setAssetFailed(true) }}
            resizeMethod="scale"
            resizeMode="contain"
            source={{ uri: assetUri }}
            style={{
              position: 'absolute',
              top: assetInset,
              left: assetInset,
              width: contentDimension,
              height: contentDimension,
              borderRadius: Math.max(2, radius - 1),
            }}
          />
        : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexShrink: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aggregateMark: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'space-between',
    justifyContent: 'space-between',
  },
  aggregateDot: {
    flexGrow: 0,
    flexShrink: 0,
  },
  mark: {
    color: '#ffffff',
    fontWeight: '800',
    includeFontPadding: false,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
})
