import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import Text from '@/components/common/Text'
import { toast } from '@/utils/tools'
import Title from './Title'
import List from './List'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { addListMusics, moveListMusics } from '@/core/list'
import settingState from '@/store/setting/state'

export interface SelectInfo {
  selectedList: LX.Music.MusicInfo[]
  listId: string
  isMove: boolean
}
const initSelectInfo: SelectInfo = { selectedList: [], listId: '', isMove: false }

export interface MusicMultiAddModalProps { onAdded?: () => void }
export interface MusicMultiAddModalType { show: (info: SelectInfo) => void }

export default forwardRef<MusicMultiAddModalType, MusicMultiAddModalProps>(({ onAdded }, ref) => {
  const t = useI18n()
  const theme = useTheme()
  const dialogRef = useRef<DialogType>(null)
  const busyRef = useRef(false)
  const creatingRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectInfo, setSelectInfo] = useState<SelectInfo>(initSelectInfo)

  useImperativeHandle(ref, () => ({
    show(info) {
      if (busyRef.current || creatingRef.current) return
      setSelectInfo(info)
      dialogRef.current?.setVisible(true)
    },
  }))
  const handleHide = () => { setSelectInfo(initSelectInfo) }
  const handleCreating = (next: boolean) => {
    creatingRef.current = next
    setCreating(next)
  }
  const handleSelect = async(listInfo: LX.List.MyListInfo) => {
    if (busyRef.current || creatingRef.current || !selectInfo.selectedList.length) return
    busyRef.current = true
    setBusy(true)
    const songs = [...selectInfo.selectedList]
    try {
      if (selectInfo.isMove) await moveListMusics(selectInfo.listId, listInfo.id, songs, settingState.setting['list.addMusicLocationType'])
      else await addListMusics(listInfo.id, songs, settingState.setting['list.addMusicLocationType'])
      dialogRef.current?.setVisible(false)
      onAdded?.()
      toast(t(selectInfo.isMove ? 'list_edit_action_tip_move_success' : 'list_edit_action_tip_add_success'))
    } catch {
      toast(t(selectInfo.isMove ? 'list_edit_action_tip_move_failed' : 'list_edit_action_tip_add_failed'))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <Dialog ref={dialogRef} onHide={handleHide} keyHide={!busy && !creating} bgHide={!busy && !creating} closeBtn={!busy && !creating}>
      {!selectInfo.selectedList.length ? null : <>
        <Title selectedList={selectInfo.selectedList} isMove={selectInfo.isMove} />
        {busy ? <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 12 }}>
          <ActivityIndicator size="small" color={theme['q-accent-text']} />
          <Text size={12} color={theme['q-text-secondary']}>{t('list_create_saving')}</Text>
        </View> : null}
        <List listId={selectInfo.listId} onPress={info => { void handleSelect(info) }} disabled={busy || creating} onCreating={handleCreating} />
      </>}
    </Dialog>
  )
})
