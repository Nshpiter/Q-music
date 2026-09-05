import { updateSetting } from '@/core/common'
import { setDesktopLyricColor } from '@/core/desktopLyric'
import { useI18n } from '@/lang'
import { memo } from 'react'
import { StyleSheet, View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { Q_UI } from '@/theme/ui'

const themes = [
  ['#08e664', 'rgba(0,0,0,0.6)'],
  ['#fffa12', 'rgba(0,0,0,0.6)'],
  ['#019ce4', 'rgba(0,0,0,0.6)'],
  ['#ff1222', 'rgba(0,0,0,0.6)'],
  ['#ef6976', 'rgba(0,0,0,0.6)'],
  ['#c851d4', 'rgba(0,0,0,0.6)'],
  ['#ffa600', 'rgba(0,0,0,0.6)'],
  ['#000000', '#ffffff'],
  ['#ffffff', 'rgba(0,0,0,0.6)'],
] as const
type Theme = typeof themes[number]

const ThemeItem = ({ color, index, selected, change }: {
  color: Theme
  index: number
  selected: boolean
  change: (color: Theme) => void
}) => {
  const theme = useTheme()
  return (
    <Button
      accessibilityLabel={`${global.i18n.t('setting_lyric_desktop_theme')} ${index + 1}`}
      accessibilityState={{ selected }}
      style={[
        styles.item,
        selected ? { backgroundColor: theme['q-surface-tint'], borderColor: theme['q-accent'] } : null,
      ]}
      onPress={() => { change(color) }}
    >
      <View style={[styles.colorContent, { borderColor: selected ? theme['q-accent'] : theme['q-outline'] }]}>
        <View style={{ ...styles.image, backgroundColor: color[0] }} />
      </View>
      <Text accessible={false} style={styles.itemNumber} size={9} color={theme['q-text-secondary']}>{index + 1}</Text>
    </Button>
  )
}

export default memo(() => {
  const t = useI18n()
  const activeColor = useSettingValue('desktopLyric.style.lyricPlayedColor')

  const setThemeDesktopLyric = (color: Theme) => {
    // const shadowColor = 'rgba(0,0,0,0.6)'
    void setDesktopLyricColor(null, color[0], color[1]).then(() => {
      updateSetting({ 'desktopLyric.style.lyricPlayedColor': color[0], 'desktopLyric.style.lyricShadowColor': color[1] })
    })
  }

  return (
    <SubTitle title={t('setting_lyric_desktop_theme')}>
      <View style={styles.list}>
        {
          themes.map((c, i) => <ThemeItem key={i.toString()} color={c} index={i} selected={activeColor == c[0]} change={setThemeDesktopLyric} />)
        }
      </View>
    </SubTitle>
  )
})

const styles = StyleSheet.create({
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  item: {
    marginRight: 15,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    width: Q_UI.touchSize,
    height: Q_UI.touchSize,
    minWidth: Q_UI.touchSize,
    minHeight: Q_UI.touchSize,
    borderRadius: Q_UI.radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  colorContent: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 26,
    height: 26,
    borderRadius: 6,
    elevation: 1,
  },
  itemNumber: {
    position: 'absolute',
    bottom: 1,
    right: 3,
  },
})
