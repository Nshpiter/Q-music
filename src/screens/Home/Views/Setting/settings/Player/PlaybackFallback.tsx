import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import SubTitle from '../../components/SubTitle'
import CheckBoxItem from '../../components/CheckBoxItem'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { fallbackPlatformOrder } from '@/utils/playbackPolicy'

const names: Record<string, string> = { wy: '网易云音乐', tx: 'QQ 音乐', kg: '酷狗音乐', kw: '酷我音乐', mg: '咪咕音乐' }

export default memo(() => {
  const downgrade = useSettingValue('player.autoQualityFallback')
  const crossPlatform = useSettingValue('player.autoSourceFallback')
  const order = useSettingValue('player.fallbackOrder')
  const platforms = fallbackPlatformOrder(useSettingValue('player.fallbackPlatforms'))
  const theme = useTheme()
  const t = useI18n()
  const move = (index: number, step: number) => {
    const list = [...platforms]
    const target = index + step
    if (target < 0 || target >= list.length) return
    ;[list[index], list[target]] = [list[target], list[index]]
    updateSetting({ 'player.fallbackPlatforms': list.join(',') })
  }
  return <SubTitle title={t('playback_fallback_title')}>
    <CheckBoxItem label={t('playback_fallback_quality')} check={downgrade} onChange={value => { updateSetting({ 'player.autoQualityFallback': value }) }} />
    <CheckBoxItem label={t('playback_fallback_source')} check={crossPlatform} onChange={value => { updateSetting({ 'player.autoSourceFallback': value }) }} />
    {crossPlatform ? <>
      <View style={styles.options}>
        {(['source', 'quality'] as const).map(value => <Button key={value} accessibilityRole="radio" accessibilityState={{ checked: order == value }}
          onPress={() => { updateSetting({ 'player.fallbackOrder': value }) }}
          style={[styles.option, { borderColor: order == value ? theme['q-accent'] : theme['q-outline'], backgroundColor: order == value ? theme['q-surface-tint'] : theme['q-surface-raised'] }]}>
          <Text size={13} color={order == value ? theme['q-accent-text'] : theme['q-text-primary']}>{t(`playback_fallback_${value}_first`)}</Text>
        </Button>)}
      </View>
      <Text size={12} color={theme['q-text-secondary']} style={styles.hint}>{t('playback_fallback_platforms')}</Text>
      {platforms.map((source, index) => <View key={source} style={[styles.row, { borderColor: theme['q-outline'] }]}>
        <Text style={styles.name} size={14}>{index + 1}. {names[source]}</Text>
        {([-1, 1] as const).map(step => <Button key={step} disabled={index + step < 0 || index + step >= platforms.length}
          accessibilityLabel={`${names[source]} ${t(step < 0 ? 'playback_fallback_up' : 'playback_fallback_down')}`}
          onPress={() => { move(index, step) }} style={styles.arrow}>
          <Text size={18} color={theme['q-accent-text']}>{step < 0 ? '↑' : '↓'}</Text>
        </Button>)}
      </View>)}
    </> : null}
    <Text size={12} color={theme['q-text-secondary']} style={styles.hint}>{t('playback_fallback_hint')}</Text>
  </SubTitle>
})

const styles = StyleSheet.create({
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  option: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12, borderWidth: 1, borderRadius: 12, marginTop: 6, overflow: 'hidden' },
  name: { flex: 1 },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  hint: { marginTop: 12, lineHeight: 20 },
})
