import { useRef, useState } from 'react'
import { View } from 'react-native'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { pushMusicAccountScreen } from '@/navigation/navigation'
import commonState from '@/store/common/state'
import listState from '@/store/list/state'
import LibraryShortcuts from '../LibraryShortcuts'
import ExternalImportModal, { type ExternalImportModalType } from '../ExternalImportModal'
import PlaylistSyncModal, { type PlaylistSyncModalType } from '../PlaylistSyncModal'

import ListMenu, { type ListMenuType } from './ListMenu'
import ListNameEdit, { type ListNameEditType } from './ListNameEdit'
import List from './List'
import ListImportExport, { type ListImportExportType } from './ListImportExport'
import { handleRemove, handleSync } from './listAction'
import ListMusicSort, { type ListMusicSortType } from './ListMusicSort'
import DuplicateMusic, { type DuplicateMusicType } from './DuplicateMusic'


export default ({ embedded = false, catalog = false, onSelect }: { embedded?: boolean, catalog?: boolean, onSelect?: (id: string) => void }) => {
  const theme = useTheme()
  const t = useI18n()
  const importRef = useRef<ExternalImportModalType>(null)
  const syncRef = useRef<PlaylistSyncModalType>(null)
  const [sorting, setSorting] = useState(false)
  const listMenuRef = useRef<ListMenuType>(null)
  const listNameEditRef = useRef<ListNameEditType>(null)
  const listMusicSortRef = useRef<ListMusicSortType>(null)
  const duplicateMusicRef = useRef<DuplicateMusicType>(null)
  const listImportExportRef = useRef<ListImportExportType>(null)

  const actionStyle = { width: 44, height: 44, borderRadius: 12, overflow: 'hidden' as const, alignItems: 'center' as const, justifyContent: 'center' as const }
  const header = <>
    {catalog ? <LibraryShortcuts onOpenList={onSelect} /> : null}
    <View style={{ paddingHorizontal: 16, paddingTop: embedded ? 12 : 4, paddingBottom: 8, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text size={16} numberOfLines={1} style={{ flex: 1, minWidth: 0, fontWeight: '700' }}>{t('mobile_playlists')}</Text>
        {catalog && !sorting ? <>
          <Button pressScale={0.94} accessibilityLabel={t('list_import')} onPress={() => importRef.current?.show(listState.activeListId)} style={actionStyle}><Icon name="download-2" size={19} color={theme['q-text-secondary']} /></Button>
          <Button pressScale={0.94} accessibilityLabel={t('list_sync_entry')} onPress={() => syncRef.current?.show()} style={actionStyle}><Icon name="available_updates" size={19} color={theme['q-text-secondary']} /></Button>
        </> : null}
        <Button pressScale={0.94} accessibilityLabel={t(sorting ? 'playlist_order_done' : 'playlist_order_title')} accessibilityState={{ selected: sorting }} onPress={() => { setSorting(!sorting) }} style={actionStyle}>
          {sorting ? <Text size={12} color={theme['q-accent-text']}>{t('playlist_order_done')}</Text> : <Icon name="slider" size={19} color={theme['q-text-secondary']} />}
        </Button>
        <Button pressScale={0.94} accessibilityLabel={t('list_create')} onPress={() => listNameEditRef.current?.showCreate(0)} style={actionStyle}><Icon name="add" size={21} color={theme['q-text-primary']} /></Button>
        {!embedded && !catalog ? <Button accessibilityLabel={t('close')} onPress={() => { global.app_event.changeLoveListVisible(false) }} style={actionStyle}><Icon name="close" size={20} color={theme['q-text-secondary']} /></Button> : null}
      </View>
      {sorting ? <Text size={11} color={theme['q-text-secondary']}>{t('playlist_order_hint')}</Text> : !catalog ? <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button pressScale={0.97} onPress={() => {
          global.app_event.changeLoveListVisible(false)
          if (commonState.componentIds.home) pushMusicAccountScreen(commonState.componentIds.home)
        }} style={{ flex: 1, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme['q-surface-tint'] }}><Text size={12} color={theme['q-accent-text']}>{t('list_import')}</Text></Button>
        <Button onPress={() => syncRef.current?.show()} style={{ flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme['q-surface-tint'] }}><Text size={12} color={theme['q-accent-text']}>{t('list_sync_entry')}</Text></Button>
      </View> : null}
    </View>
  </>
  return <View style={{ flex: 1 }}>
          {!catalog ? header : null}
          <ExternalImportModal ref={importRef} />
          <PlaylistSyncModal ref={syncRef} />
          <List catalog={catalog} header={catalog ? header : undefined} onSelect={onSelect} sorting={sorting} onShowMenu={(info, position) => listMenuRef.current?.show(info, position)} />
          <ListNameEdit ref={listNameEditRef} />
          <ListMusicSort ref={listMusicSortRef} />
          <DuplicateMusic ref={duplicateMusicRef} />
          <ListImportExport ref={listImportExportRef} />
          <ListMenu
            ref={listMenuRef}
            onNew={index => listNameEditRef.current?.showCreate(index)}
            onRename={info => listNameEditRef.current?.show(info)}
            onSort={info => listMusicSortRef.current?.show(info)}
            onDuplicateMusic={info => duplicateMusicRef.current?.show(info)}
            onImport={(info, position) => listImportExportRef.current?.import(info, position)}
            onExport={(info, position) => listImportExportRef.current?.export(info, position)}
            onRemove={info => { handleRemove(info) }}
            onSync={info => { handleSync(info) }}
            onSelectLocalFile={(info, position) => listImportExportRef.current?.selectFile(info, position)}
          />
          {/* <ImportExport actionType={actionType} visible={isShowChoosePath} hide={() => setShowChoosePath(false)} selectedListRef={selectedListRef} /> */}
        </View>
}
