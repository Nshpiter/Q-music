import { memo } from 'react'

import { StyleSheet, Switch, View } from 'react-native'

import CheckBox, { type CheckBoxProps } from '@/components/common/CheckBox'
import { useTheme } from '@/store/theme/hook'
import { createStyle, tipDialog } from '@/utils/tools'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'


export default memo((props: CheckBoxProps) => {
  const theme = useTheme()
  if (!props.label || props.need) return <View style={styles.container}><CheckBox {...props} /></View>

  return (
    <View style={{ ...styles.container, borderBottomColor: theme['q-outline'], marginBottom: props.marginBottom ?? 0 }}>
      <Button
        accessibilityRole="switch"
        accessibilityLabel={props.label}
        accessibilityState={{ checked: props.check, disabled: props.disabled }}
        disabled={props.disabled}
        style={styles.row}
        onPress={() => { props.onChange(!props.check) }}
      >
        <Text style={styles.label} size={14 * (props.size ?? 1)} color={theme['q-text-primary']}>{props.label}</Text>
        <View pointerEvents="none" importantForAccessibility="no-hide-descendants">
          <Switch accessible={false} value={props.check} disabled={props.disabled} trackColor={{ false: theme['q-outline'], true: theme['q-accent'] }} thumbColor={props.check ? '#ffffff' : theme['q-text-secondary']} />
        </View>
      </Button>
      {(props.helpTitle ?? props.helpDesc) ? <Button
        accessibilityLabel={props.helpTitle ?? `${props.label} · ${global.i18n.t('help')}`}
        style={styles.help}
        onPress={() => { void tipDialog({ title: props.helpTitle ?? props.label, message: props.helpDesc, btnText: global.i18n.t('understand') }) }}
      ><Icon name="help" rawSize={18} color={theme['q-text-secondary']} /></Button> : null}
    </View>
  )
})

const styles = createStyle({
  container: {
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flex: 1,
    minHeight: 58,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: { flex: 1, lineHeight: 21 },
  help: { width: 40, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
})
