import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { View, type ImageSourcePropType } from 'react-native'
import { setTheme } from '@/core/theme'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'

import SubTitle from '../../components/SubTitle'
import { BG_IMAGES, getAllThemes, type LocalTheme } from '@/theme/themes'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { scaleSizeH } from '@/utils/pixelRatio'
import { Icon } from '@/components/common/Icon'
import ImageBackground from '@/components/common/ImageBackground'
import Button from '@/components/common/Button'
import { Q_UI, qSurfaceShadow } from '@/theme/ui'

const useActive = (id: string) => {
  const activeThemeId = useSettingValue('theme.id')
  const isActive = useMemo(() => activeThemeId == id, [activeThemeId, id])
  return isActive
}

const ThemeItem = ({ id, name, color, image, setTheme, showAll }: {
  id: string
  name: string
  color: string
  showAll: boolean
  image?: ImageSourcePropType
  setTheme: (id: string) => void
}) => {
  const theme = useTheme()
  const isActive = useActive(id)
  const glassPanelStyle = {
    ...styles.glassPanel,
    backgroundColor: theme.isDark ? 'rgba(22,30,27,0.58)' : 'rgba(255,255,255,0.64)',
    borderColor: theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.74)',
  }
  const preview = image
    ? (
        <ImageBackground
          style={{ ...styles.imageContent, width: scaleSizeH(IMAGE_WIDTH), backgroundColor: color }}
          imageStyle={{ borderRadius: 9 }}
          source={image}
        >
          <View style={glassPanelStyle}>
            <View style={{ ...styles.glassAccent, backgroundColor: color }} />
          </View>
        </ImageBackground>
      )
    : (
        <View style={{ ...styles.imageContent, width: scaleSizeH(IMAGE_WIDTH), backgroundColor: color }}>
          <View style={glassPanelStyle}>
            <View style={{ ...styles.glassAccent, backgroundColor: color }} />
          </View>
        </View>
      )

  return (
    showAll || isActive ? (
      <Button
        accessibilityRole="button"
        accessibilityLabel={name}
        accessibilityState={{ selected: isActive }}
        style={{ ...styles.item, width: scaleSizeH(ITEM_WIDTH) }}
        onPress={() => { setTheme(id) }}
      >
        <View
          style={{
            ...styles.colorContent,
            ...qSurfaceShadow,
            width: scaleSizeH(PREVIEW_WIDTH),
            borderColor: isActive ? color : theme['q-outline'],
            backgroundColor: theme['q-surface-base'],
          }}
        >
          {preview}
        </View>
        <Text style={[styles.name, isActive ? styles.nameActive : null]} size={12} color={isActive ? color : theme['q-text-primary']} numberOfLines={1}>{name}</Text>
      </Button>
    ) : null
  )
}

const MoreBtn = ({ showAll, setShowAll }: {
  showAll: boolean
  setShowAll: (showAll: boolean) => void
}) => {
  const theme = useTheme()
  const t = useI18n()

  return (
    showAll ? null
      : (
          <Button
            accessibilityLabel={t('setting_basic_theme_more_btn_show')}
            style={{ ...styles.moreBtn, backgroundColor: theme['q-surface-tint'], borderColor: theme['c-primary-alpha-700'] }}
            onPress={() => { setShowAll(!showAll) }}
          >
            <Text style={styles.moreBtnText} size={13} color={theme['q-accent-text']} numberOfLines={1}>{t('setting_basic_theme_more_btn_show')}</Text>
            <Icon name="chevron-right" size={12} color={theme['q-accent-text']} />
          </Button>
        )

  )
}

interface ThemeInfo {
  themes: Readonly<LocalTheme[]>
  userThemes: LX.Theme[]
  dataPath: string
}
const initInfo: ThemeInfo = { themes: [], userThemes: [], dataPath: '' }
export default memo(() => {
  const [showAll, setShowAll] = useState(false)
  const t = useI18n()
  const [themeInfo, setThemeInfo] = useState(initInfo)
  const setThemeId = useCallback((id: string) => {
    requestAnimationFrame(() => {
      setTheme(id)
    })
  }, [])

  useEffect(() => {
    void getAllThemes().then(setThemeInfo)
  }, [])

  return (
    <SubTitle title={t('setting_basic_theme')}>
      <View style={styles.list}>
        {
          themeInfo.themes.map(({ id, config }) => {
            return <ThemeItem
              key={id}
              color={config.themeColors['c-theme']}
              image={config.extInfo['bg-image'] ? BG_IMAGES[config.extInfo['bg-image']] : undefined}
              showAll={showAll}
              id={id}
              name={t(`theme_${id}`)}
              setTheme={setThemeId} />
          })
        }
        {
          themeInfo.userThemes.map(({ id, name, config }) => {
            return <ThemeItem
              key={id}
              color={config.themeColors['c-theme']}
              // image={undefined}
              showAll={showAll}
              id={id}
              name={name}
              setTheme={setThemeId} />
          })
        }
        <MoreBtn showAll={showAll} setShowAll={setShowAll} />
      </View>
    </SubTitle>
  )
})

const ITEM_WIDTH = 88
const PREVIEW_WIDTH = 88
const PREVIEW_HEIGHT = 54
const IMAGE_WIDTH = 78
const IMAGE_HEIGHT = 44
const styles = createStyle({
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
    paddingBottom: 2,
  },
  item: {
    alignItems: 'center',
    minHeight: Q_UI.touchSize,
    borderRadius: 12,
    overflow: 'hidden',
  },
  colorContent: {
    height: PREVIEW_HEIGHT,
    padding: 3,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContent: {
    height: IMAGE_HEIGHT,
    borderRadius: 9,
    overflow: 'hidden',
  },
  glassPanel: {
    position: 'absolute',
    left: 7,
    right: 7,
    bottom: 6,
    height: 14,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassAccent: {
    width: 18,
    height: 3,
    borderRadius: 2,
    opacity: 0.72,
  },
  name: {
    width: '100%',
    marginTop: 7,
    textAlign: 'center',
  },
  nameActive: {
    fontWeight: '700',
  },
  moreBtn: {
    minHeight: Q_UI.touchSize,
    paddingLeft: 14,
    paddingRight: 12,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  moreBtnText: {
    fontWeight: '600',
  },
})
