import { memo } from 'react'

import Section from '../../components/Section'
import AddMusicLocationType from './AddMusicLocationType'
import IsShowAlbumName from './IsShowAlbumName'
import IsShowInterval from './IsShowInterval'
import SinglePlayMode from './SinglePlayMode'
import HistoryLimit from './HistoryLimit'
import FavoriteTarget from './FavoriteTarget'

import { useI18n } from '@/lang'

export default memo(() => {
  const t = useI18n()

  return (
    <Section title={t('setting_list')}>
      <SinglePlayMode />
      <HistoryLimit />
      <FavoriteTarget />
      <IsShowAlbumName />
      <IsShowInterval />
      <AddMusicLocationType />
    </Section>
  )
})
