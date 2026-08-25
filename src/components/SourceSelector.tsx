import { forwardRef, type Ref, useImperativeHandle, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import DorpDownMenu, { type DorpDownMenuProps as _DorpDownMenuProps } from '@/components/common/DorpDownMenu'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'

import { useTheme } from '@/store/theme/hook'

type Sources = Readonly<Array<LX.OnlineSource | 'all'>>

export interface SourceSelectorProps<S extends Sources> {
  fontSize?: number
  center?: _DorpDownMenuProps<any>['center']
  plain?: boolean
  onSourceChange: (source: S[number]) => void
}

export interface SourceSelectorType<S extends Sources> {
  setSourceList: (list: S, activeSource: S[number]) => void
}

export const useSourceListI18n = (list: Sources) => {
  const t = useI18n()
  return useMemo(() => {
    return list.map(s => ({ label: t(`source_real_${s}`), action: s }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, t])
}

const Component = <S extends Sources>({ fontSize = 15, center, plain = false, onSourceChange }: SourceSelectorProps<S>, ref: Ref<SourceSelectorType<S>>) => {
  const [list, setList] = useState([] as unknown as S)
  const [source, setSource] = useState<S[number]>('kw')
  const t = useI18n()
  const theme = useTheme()

  useImperativeHandle(ref, () => ({
    setSourceList(list, activeSource) {
      setList(list)
      setSource(activeSource)
    },
  }), [])

  const sourceList_t = useSourceListI18n(list)

  type DorpDownMenuProps = _DorpDownMenuProps<typeof sourceList_t>

  const handleChangeSource: DorpDownMenuProps['onPress'] = ({ action }) => {
    onSourceChange(action)
    setSource(action)
  }

  return (
    <DorpDownMenu
      menus={sourceList_t}
      center={center}
      onPress={handleChangeSource}
      fontSize={fontSize}
      activeId={source}
      btnStyle={{
        ...(plain ? styles.plainSourceButton : styles.sourceButton),
        backgroundColor: plain ? 'transparent' : theme['q-surface-base'],
        borderColor: plain ? 'transparent' : theme['q-outline'],
      }}
    >
      <View style={plain ? styles.plainSourceMenu : styles.sourceMenu}>
        <Text style={{ textAlign: center ? 'center' : 'left' }} numberOfLines={1} size={fontSize}>{t(`source_real_${source}`)}</Text>
      </View>
    </DorpDownMenu>
  )
}

export default forwardRef(Component) as <S extends Sources>(p: SourceSelectorProps<S> & { ref?: Ref<SourceSelectorType<S>> }) => JSX.Element | null


const styles = StyleSheet.create({
  sourceButton: {
    height: 44,
    minWidth: 82,
    maxWidth: 122,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sourceMenu: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  plainSourceButton: {
    height: 44,
    minWidth: 68,
    maxWidth: 108,
    overflow: 'hidden',
  },
  plainSourceMenu: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
})
