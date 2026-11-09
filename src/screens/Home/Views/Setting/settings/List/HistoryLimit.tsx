import { useEffect, useState } from 'react'
import { View } from 'react-native'
import Text from '@/components/common/Text'
import CheckBoxItem from '../../components/CheckBoxItem'
import { playHistory } from '@/core/playHistory'
import { useI18n } from '@/lang'
import { toast } from '@/utils/tools'
export default () => {
  const t = useI18n()
  const [limit, setLimit] = useState(playHistory.snapshot().limit)
  useEffect(() => {
    const unsubscribe = playHistory.subscribe(() => { setLimit(playHistory.snapshot().limit) })
    void playHistory.load().catch(() => { toast(t('play_history_failed')) })
    return unsubscribe
  }, [t])
  return <View style={{ marginTop: 16 }}><Text size={14}>{t('play_history_limit')}</Text>
    {[0, 100, 500, 1000, 5000].map(value => <CheckBoxItem key={value} check={limit == value} label={value ? String(value) : t('play_history_unlimited')} onChange={() => { void playHistory.setLimit(value).catch(() => { toast(t('play_history_failed')) }) }} />)}
    <Text size={12}>{t('play_history_limit_tip')}</Text>
  </View>
}
