import { forwardRef, type Ref, useImperativeHandle, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import DorpDownMenu, { type DorpDownMenuProps as _DorpDownMenuProps } from '@/components/common/DorpDownMenu'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import SourceLogo, { normalizeSource, SOURCE_LOGOS } from '@/components/SourceLogo'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { Q_UI } from '@/theme/ui'
import { useWindowSize } from '@/utils/hooks'

type Sources = Readonly<Array<LX.OnlineSource | 'all'>>

export interface SourceSelectorProps<S extends Sources> {
  fontSize?: number
  center?: _DorpDownMenuProps<any>['center']
  plain?: boolean
  iconOnly?: boolean
  onSourceChange: (source: S[number]) => void
}

export interface SourceSelectorType<S extends Sources> {
  setSourceList: (list: S, activeSource: S[number]) => void
}

export const useSourceListI18n = (list: Sources) => {
  const t = useI18n()
  return useMemo(() => {
    return list.map(s => {
      const normalized = normalizeSource(s)
      const label = t(`source_real_${s}`) || SOURCE_LOGOS[normalized]?.label || s
      return {
        label,
        action: s,
        icon: <SourceLogo source={s} size={24} />,
      }
    })
  }, [list, t])
}

const Component = <S extends Sources>({ fontSize = 15, center, plain = false, iconOnly = false, onSourceChange }: SourceSelectorProps<S>, ref: Ref<SourceSelectorType<S>>) => {
  const [list, setList] = useState([] as unknown as S)
  // Do not assume a provider before the async source list arrives. Rendering
  // a hard-coded Kuwo mark here made the Android header briefly show the wrong
  // platform and also enabled an empty menu during startup.
  const [source, setSource] = useState<S[number] | null>(null)
  const t = useI18n()
  const theme = useTheme()
  const { width: windowWidth } = useWindowSize()

  useImperativeHandle(ref, () => ({
    setSourceList(list, activeSource) {
      setList(list)
      // A provider can disappear after an API refresh. Keep the selector
      // pointing at a valid option instead of rendering a blank label/icon.
      setSource((list.includes(activeSource) ? activeSource : list[0]) ?? null)
    },
  }), [])

  const sourceList_t = useSourceListI18n(list)

  type DorpDownMenuProps = _DorpDownMenuProps<typeof sourceList_t>

  const handleChangeSource: DorpDownMenuProps['onPress'] = ({ action }) => {
    onSourceChange(action)
    setSource(action)
  }

  const currentSource = source ?? list[0] ?? 'all'
  const normalizedCurrentSource = normalizeSource(currentSource)
  const sourceLabel = t(`source_real_${currentSource}`) || SOURCE_LOGOS[normalizedCurrentSource]?.label || currentSource
  // Keep the popup wide enough for localized provider names, but let it
  // shrink on very narrow Android windows instead of running off-screen.
  const sourceMenuWidth = Math.min(224, Math.max(168, windowWidth - 24))

  return (
    <DorpDownMenu
      menus={sourceList_t}
      center={center}
      onPress={handleChangeSource}
      fontSize={fontSize}
      activeId={source}
      menuWidth={sourceMenuWidth}
      accessibilityLabel={sourceLabel}
      accessibilityHint={t('source_select')}
      disabled={!list.length}
      btnStyle={{
        ...(iconOnly ? styles.iconSourceButton : plain ? styles.plainSourceButton : styles.sourceButton),
        backgroundColor: plain ? 'transparent' : theme['q-surface-base'],
        borderColor: plain ? 'transparent' : theme['q-outline'],
      }}
    >
      <View style={iconOnly ? styles.iconSourceMenu : plain ? styles.plainSourceMenu : styles.sourceMenu}>
        <SourceLogo source={currentSource} size={24} disabled={!source} />
        {!iconOnly
          ? <Text style={{ ...styles.sourceText, textAlign: center ? 'center' : 'left' }} numberOfLines={1} ellipsizeMode="tail" size={fontSize}>{sourceLabel}</Text>
          : null}
        <Icon style={styles.chevron} name="chevron-right" color={theme['q-text-secondary']} rawSize={12} />
      </View>
    </DorpDownMenu>
  )
}

export default forwardRef(Component) as <S extends Sources>(p: SourceSelectorProps<S> & { ref?: Ref<SourceSelectorType<S>> }) => JSX.Element | null

const styles = StyleSheet.create({
  sourceButton: {
    height: Q_UI.touchSize,
    minHeight: Q_UI.touchSize,
    minWidth: 96,
    maxWidth: 164,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    overflow: 'hidden',
  },
  sourceMenu: {
    flex: 1,
    minWidth: 0,
    height: Q_UI.touchSize,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 7,
  },
  plainSourceButton: {
    height: Q_UI.touchSize,
    minHeight: Q_UI.touchSize,
    minWidth: 72,
    maxWidth: 156,
    overflow: 'hidden',
  },
  plainSourceMenu: {
    flex: 1,
    minWidth: 0,
    height: Q_UI.touchSize,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 6,
  },
  iconSourceButton: {
    width: Q_UI.touchSize,
    minWidth: Q_UI.touchSize,
    height: Q_UI.touchSize,
    minHeight: Q_UI.touchSize,
    overflow: 'hidden',
  },
  iconSourceMenu: {
    width: Q_UI.touchSize,
    height: Q_UI.touchSize,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  sourceText: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  chevron: {
    flexShrink: 0,
    transform: [{ rotate: '90deg' }],
  },
})
