import { StyleSheet, View } from 'react-native'
import Button from './Button'
import Text from './Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { Q_UI } from '@/theme/ui'

interface Props {
  selectMode: 'single' | 'range'
  isSelectAll: boolean
  onSwitchMode: (mode: 'single' | 'range') => void
  onSelectAll: () => void
  onExitSelectMode: () => void
}

export default ({ selectMode, isSelectAll, onSwitchMode, onSelectAll, onExitSelectMode }: Props) => {
  const theme = useTheme()
  const t = useI18n()

  return (
    <View style={styles.container}>
      <View style={{ ...styles.modes, backgroundColor: theme['q-surface-tint'] }}>
        {(['single', 'range'] as const).map(mode => (
          <Button
            key={mode}
            accessibilityRole="radio"
            accessibilityLabel={t(`list_select_${mode}`)}
            accessibilityState={{ checked: selectMode == mode }}
            onPress={() => { onSwitchMode(mode) }}
            style={{ ...styles.modeBtn, backgroundColor: selectMode == mode ? theme['q-surface-raised'] : 'transparent', borderColor: selectMode == mode ? theme['q-outline'] : 'transparent' }}
          >
            <Text size={13} numberOfLines={1} color={selectMode == mode ? theme['q-accent-text'] : theme['q-text-secondary']}>{t(`list_select_${mode}`)}</Text>
          </Button>
        ))}
      </View>
      <Button accessibilityLabel={t(isSelectAll ? 'list_select_unall' : 'list_select_all')} onPress={onSelectAll} style={styles.action}>
        <Text size={13} numberOfLines={1} color={theme['q-accent-text']}>{t(isSelectAll ? 'list_select_unall' : 'list_select_all')}</Text>
      </Button>
      <Button accessibilityLabel={t('list_select_cancel')} onPress={onExitSelectMode} style={{ ...styles.action, flex: 0.7 }}>
        <Text size={13} numberOfLines={1} color={theme['q-text-primary']}>{t('list_select_cancel')}</Text>
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  modes: {
    flexDirection: 'row',
    flex: 1.6,
    minWidth: 0,
    borderRadius: 12,
    padding: 2,
    overflow: 'hidden',
  },
  modeBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: Q_UI.touchSize,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  action: {
    flex: 1,
    minWidth: 0,
    minHeight: Q_UI.touchSize,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
