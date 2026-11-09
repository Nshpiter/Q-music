import { useEffect, useRef, useState } from 'react'
import MusicAddModal, { type MusicAddModalType } from '@/components/MusicAddModal'
import playerState from '@/store/player/state'
import Btn from './Btn'
import { getFavoriteListId, toggleLocalFavorite } from '@/core/localFavorite'
import { getListMusics } from '@/core/list'
import { usePlayMusicInfo } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { toast } from '@/utils/tools'


export default ({ iconOnly = false }: { iconOnly?: boolean }) => {
  const musicAddModalRef = useRef<MusicAddModalType>(null)
  const current = usePlayMusicInfo().musicInfo
  const target = useSettingValue('list.favoriteTargetId')
  const [loved, setLoved] = useState(false)
  const busy = useRef(false)
  const track = current && ('progress' in current ? current.metadata.musicInfo : current)
  useEffect(() => {
    let active = true
    const refresh = () => {
      if (!track) { setLoved(false); return }
      void getListMusics(getFavoriteListId()).then(list => { if (active) setLoved(list.some(item => item.id == track.id)) }).catch(() => { if (active) setLoved(false) })
    }
    refresh()
    global.app_event.on('myListMusicUpdate', refresh)
    global.state_event.on('mylistUpdated', refresh)
    return () => { active = false; global.app_event.off('myListMusicUpdate', refresh); global.state_event.off('mylistUpdated', refresh) }
  }, [track, target])
  const toggle = async() => {
    if (!track || busy.current) return
    busy.current = true
    try { await toggleLocalFavorite(track) } catch { toast(global.i18n.t('favorite_default_failed')) } finally { busy.current = false }
  }

  const handleShowMusicAddModal = () => {
    const musicInfo = playerState.playMusicInfo.musicInfo
    if (!musicInfo) return
    musicAddModalRef.current?.show({
      musicInfo: 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo,
      isMove: false,
      listId: playerState.playMusicInfo.listId!,
    })
  }

  return (
    <>
      <Btn icon={loved ? 'heart-filled' : 'love'} selected={loved} label={iconOnly ? undefined : global.i18n.t(loved ? 'favorite_saved' : 'favorite_save')} accessibilityLabel={global.i18n.t('favorite_default_toggle')} onPress={() => { void toggle() }} onLongPress={handleShowMusicAddModal} />
      <MusicAddModal ref={musicAddModalRef} />
    </>
  )
}
