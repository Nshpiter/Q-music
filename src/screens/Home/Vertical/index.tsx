import Content from './Content'
import PlayerBar from '@/components/player/PlayerBar'
import BottomNav from './BottomNav'

export default () => {
  return (
    <>
      <Content />
      <PlayerBar isHome />
      <BottomNav />
    </>
  )
}
