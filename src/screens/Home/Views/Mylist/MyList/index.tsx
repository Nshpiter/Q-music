import { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
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

  const actionStyle = { minWidth: 44, height: 44, paddingHorizontal: 10, borderRadius: 12, overflow: 'hidden' as const, alignItems: 'center' as const, justifyContent: 'center' as const }
  const actionGroupStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2, paddingHorizontal: 4, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, backgroundColor: theme['q-surface-raised'], borderColor: theme['q-outline'] }
  const createBtnStyle = { width: 44, height: 44, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' as const, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: theme['q-surface-raised'], borderColor: theme['q-outline'] }
  const header = <>
    {catalog ? <LibraryShortcuts onOpenList={onSelect} /> : null}
    <View style={{ paddingHorizontal: 16, paddingTop: embedded ? 12 : 6, paddingBottom: 8, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text size={16} numberOfLines={1} style={{ flex: 1, minWidth: 0, fontWeight: '700' }}>{t('mobile_playlists')}</Text>
        <View style={actionGroupStyle}>
          {catalog && !sorting ? <>
            <Button pressScale={0.94} accessibilityLabel={t('list_import')} onPress={() => importRef.current?.show(listState.activeListId)} style={actionStyle}><Icon name="add_folder" size={18} color={theme['q-text-secondary']} /></Button>
            <Button pressScale={0.94} accessibilityLabel={t('list_sync_entry')} onPress={() => syncRef.current?.show()} style={actionStyle}><Icon name="available_updates" size={17} color={theme['q-text-secondary']} /></Button>
          </> : null}
          <Button pressScale={0.94} accessibilityLabel={t(sorting ? 'playlist_order_done' : 'playlist_order_title')} accessibilityState={{ selected: sorting }} onPress={() => { setSorting(!sorting) }} style={actionStyle}>
            {sorting ? <Text size={12} color={theme['q-accent-text']} style={{ fontWeight: '600' }}>{t('playlist_order_done')}</Text> : <Icon name="slider" size={17} color={theme['q-text-secondary']} />}
          </Button>
        </View>
        <Button pressScale={0.94} accessibilityLabel={t('list_create')} onPress={() => listNameEditRef.current?.showCreate(0)} style={createBtnStyle}><Icon name="add" size={20} color={theme['q-text-primary']} /></Button>
        {!embedded && !catalog ? <Button accessibilityLabel={t('close')} onPress={() => { global.app_event.changeLoveListVisible(false) }} style={actionStyle}><Icon name="close" size={20} color={theme['q-text-secondary']} /></Button> : null}
      </View>
      {!sorting ? <Button
        pressScale={0.985}
        onPress={() => importRef.current?.show(listState.activeListId, 'bi')}
        style={{ minHeight: 48, borderRadius: 15, paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme['q-outline'], backgroundColor: theme['q-surface-raised'], flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
        <View style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme['c-primary-input-background'] }}>
          <Icon accessible={false} name="play-outline" rawSize={17} color={theme['q-text-primary']} />
        </View>
        <Text size={13} color={theme['q-text-primary']} style={{ flex: 1, minWidth: 0, fontWeight: '500' }} numberOfLines={1}>{t('bilibili_favorite_add')}</Text>
        <Icon accessible={false} name="chevron-right" rawSize={15} color={theme['q-text-secondary']} />
      </Button> : null}
      {sorting ? <Text size={11} color={theme['q-text-secondary']}>{t('playlist_order_hint')}</Text> : !catalog ? <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button pressScale={0.97} onPress={() => {
          global.app_event.changeLoveListVisible(false)
          if (commonState.componentIds.home) pushMusicAccountScreen(commonState.componentIds.home)
        }} style={{ flex: 1, minHeight: 48, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme['q-outline'], alignItems: 'center', justifyContent: 'center', backgroundColor: theme['q-surface-raised'] }}><Text size={12} color={theme['q-text-primary']}>{t('list_import')}</Text></Button>
        <Button onPress={() => syncRef.current?.show()} style={{ flex: 1, minHeight: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme['q-outline'], alignItems: 'center', justifyContent: 'center', backgroundColor: theme['q-surface-raised'] }}><Text size={12} color={theme['q-text-primary']}>{t('list_sync_entry')}</Text></Button>
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
