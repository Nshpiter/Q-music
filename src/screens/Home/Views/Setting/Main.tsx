import { forwardRef, memo, useImperativeHandle, useMemo } from 'react'

import Basic from './settings/Basic'
import Cloud from './settings/Cloud'
import Player from './settings/Player'
import Search from './settings/Search'
import List from './settings/List'
import Sync from './settings/Sync'
import Backup from './settings/Backup'
import Other from './settings/Other'
import Version from './settings/Version'
import About from './settings/About'
import Overview from './Overview'
import Appearance from './settings/Appearance'
import Sources from './settings/Sources'
import Lyrics from './settings/Lyrics'
import Background from './settings/Background'
import Download from './settings/Download'
import SettingSearchTarget from './SettingSearchTarget'
import { selectSettingSection, useSettingSection, useSettingTarget } from '@/store/setting/navigation'

export const SETTING_SCREENS = [
  'overview',
  'appearance',
  'sources',
  'basic',
  'player',
  'lyrics',
  'background',
  'search',
  'list',
  'download',
  'cloud',
  'sync',
  'backup',
  'other',
  'version',
  'about',
] as const

export type SettingScreenIds = typeof SETTING_SCREENS[number] | 'lyric_desktop'

// interface MainProps {
//   onUpdateActiveId: (id: string) => void
// }
export interface MainType {
  setActiveId: (id: SettingScreenIds) => void
}

// 过渡期间旧页面使用自己的位置快照，不能跟着全局分类一起切换。
export const SettingContent = memo(({ id, target = '' }: { id: SettingScreenIds, target?: string }) => {
  const component = useMemo(() => {
    switch (id) {
      case 'overview': return <Overview />
      case 'appearance': return <Appearance />
      case 'sources': return <Sources />
      case 'lyrics': return <Lyrics />
      case 'background': return <Background />
      case 'download': return <Download />
      case 'cloud': return <Cloud />
      case 'player': return <Player />
      case 'lyric_desktop': return <Lyrics />
      case 'search': return <Search />
      case 'list': return <List />
      case 'sync': return <Sync />
      case 'backup': return <Backup />
      case 'other': return <Other />
      case 'version': return <Version />
      case 'about': return <About />
      case 'basic':
      default: return <Basic />
    }
  }, [id])

  return target ? <SettingSearchTarget id={target} /> : component
})


const Main = forwardRef<MainType, {}>((props, ref) => {
  const id = useSettingSection()
  const target = useSettingTarget()
  useImperativeHandle(ref, () => ({ setActiveId: selectSettingSection }))
  return <SettingContent id={id} target={target} />
})

export default Main

