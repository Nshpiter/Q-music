import { Alert, StyleSheet, View } from 'react-native'
import SubTitle from '../../components/SubTitle'
import CheckBoxItem from '../../components/CheckBoxItem'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { exitApp, updateSetting } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import useAdaptiveLayout from '@/utils/hooks/useAdaptiveLayout'

const positions = ['left', 'right', 'bottom'] as const

export default () => {
  const { wide, isCar } = useAdaptiveLayout()
  const position = useSettingValue('common.largeScreenNavigation')
  const showExit = useSettingValue('common.carShowExitBtn')
  const theme = useTheme()
  const t = useI18n()
  if (!wide && !isCar) return null

  return <SubTitle title={t('setting_large_navigation')}>
    {wide ? <View style={styles.options}>
      {positions.map(value => <Button key={value} accessibilityLabel={t(`setting_navigation_${value}`)} accessibilityRole="radio" accessibilityState={{ checked: position == value }}
        onPress={() => { updateSetting({ 'common.largeScreenNavigation': value }) }}
        style={[styles.option, { backgroundColor: position == value ? theme['q-surface-tint'] : theme['q-surface-raised'], borderColor: position == value ? theme['q-accent'] : theme['q-outline'] }]}>
        <Text size={14} color={position == value ? theme['q-accent-text'] : theme['q-text-primary']}>{t(`setting_navigation_${value}`)}</Text>
      </Button>)}
    </View> : null}
    <Text size={12} color={theme['q-text-secondary']} style={styles.hint}>{t('setting_large_navigation_hint')}</Text>
    {isCar ? <>
      <CheckBoxItem label={t('setting_car_exit')} check={showExit} onChange={value => { updateSetting({ 'common.carShowExitBtn': value }) }} />
      {showExit ? <Button style={[styles.option, { borderColor: theme['q-outline'] }]} accessibilityLabel={t('setting_car_exit_action')} onPress={() => {
        Alert.alert(t('setting_car_exit_action'), t('exit_app_tip'), [
          { text: t('cancel'), style: 'cancel' },
          { text: t('confirm'), onPress: () => { exitApp('car-settings') } },
        ])
      }}><Text color={theme['q-text-primary']}>{t('setting_car_exit_action')}</Text></Button> : null}
    </> : null}
  </SubTitle>
}

const styles = StyleSheet.create({
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { minHeight: 52, minWidth: 80, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { marginTop: 10, marginBottom: 8, lineHeight: 20 },
})
