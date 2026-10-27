import { memo } from 'react'

import Section from '../../components/Section'
import Language from './Language'
import ShareType from './ShareType'
import IsAutoHidePlayBar from './IsAutoHidePlayBar'
import IsHomePageScroll from './IsHomePageScroll'
import IsAllowProgressBarSeek from './IsAllowProgressBarSeek'
import IsUseSystemFileSelector from './IsUseSystemFileSelector'
import IsAlwaysKeepStatusbarHeight from './IsAlwaysKeepStatusbarHeight'
import { useI18n } from '@/lang/i18n'

export default memo(() => {
  const t = useI18n()


  return (
    <Section title={t('setting_basic')}>
      <Language />
      <IsAutoHidePlayBar />
      <IsHomePageScroll />
      <IsAllowProgressBarSeek />
      <IsUseSystemFileSelector />
      <IsAlwaysKeepStatusbarHeight />
      <ShareType />
    </Section>
  )
})
