import { memo } from 'react'

// import Section from '../../components/Section'
import Theme from './Theme'
import IsAutoTheme from './IsAutoTheme'
import IsHideBgDark from './IsHideBgDark'
import IsDynamicBg from './IsDynamicBg'
import BlurLevel from './BlurLevel'
import IsFontShadow from './IsFontShadow'
import PerformanceMode from './PerformanceMode'
import LiquidGlass from './LiquidGlass'
// import { useI18n } from '@/lang/i18n'

export default memo(() => {
  return (
    <>
      <IsAutoTheme />
      <Theme />
      <IsHideBgDark />
      <IsDynamicBg />
      <LiquidGlass />
      <BlurLevel />
      <PerformanceMode />
      <IsFontShadow />
    </>
  )
})
