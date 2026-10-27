import { memo } from 'react'

import Section from '../../components/Section'
import IsSavePlayTime from './IsSavePlayTime'
import PlayHighQuality from './PlayHighQuality'
import IsAutoCleanPlayedList from './IsAutoCleanPlayedList'
import MaxCache from './MaxCache'
import { useI18n } from '@/lang'
import PlayerStyleSelector from '@/components/player/PlayerStyleSelector'
import IsStartupAutoPlay from '../Basic/IsStartupAutoPlay'
import IsStartupPushPlayDetailScreen from '../Basic/IsStartupPushPlayDetailScreen'


export default memo(() => {
  const t = useI18n()

  return (
    <Section title={t('setting_player')}>
      <PlayerStyleSelector />
      <PlayHighQuality />
      <IsStartupAutoPlay />
      <IsStartupPushPlayDetailScreen />
      <IsSavePlayTime />
      <IsAutoCleanPlayedList />
      <MaxCache />
    </Section>
  )
})
