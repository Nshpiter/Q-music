import { useCallback, useRef, useState } from 'react'
import Text from '@/components/common/Text'
import { View, ScrollView } from 'react-native'
import { confirmDialog, createStyle, toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useUserApiList, state as userApiState } from '@/store/userApi'
import { useSettingValue } from '@/store/setting/hook'
import {
  removeUserApi,
  setUserApiAllowShowUpdateAlert,
  setUserApiAutoUpdate,
  updateUserApiSourceUrl,
  updateUserApisFromUrls,
} from '@/core/userApi'
import { normalizeUserApiUrl, type UserApiBatchUpdateResult, type UserApiUpdateItemResult } from '@/utils/userApiImport'
import { BorderRadius } from '@/theme'
import CheckBox from '@/components/common/CheckBox'
import { Icon } from '@/components/common/Icon'
import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'
import Input, { type InputType } from '@/components/common/Input'
import settingState from '@/store/setting/state'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { setApiSource } from '@/core/apiSource'
import Button from '@/components/common/Button'
import { updateSetting } from '@/core/common'

const formatVersionName = (version: string) => {
  return /^\d/.test(version) ? `v${version}` : version
}

const getStatusText = (t: ReturnType<typeof useI18n>, status: UserApiUpdateItemResult<LX.UserApi.UserApiInfo>) => {
  switch (status.status) {
    case 'updated': return t('user_api_status_updated')
    case 'unchanged': return t('user_api_status_unchanged')
    case 'skipped': return t('user_api_status_skipped')
    case 'failed': return t('user_api_status_failed', { message: status.message ?? '' })
  }
}

const ListItem = ({
  item,
  activeId,
  updating,
  disableUpdate,
  statusResult,
  onRemove,
  onChangeAllowShowUpdateAlert,
  onChangeAutoUpdate,
  onEditUrl,
  onUpdateOne,
}: {
  item: LX.UserApi.UserApiInfo
  activeId: string
  updating: boolean
  disableUpdate: boolean
  statusResult?: UserApiUpdateItemResult<LX.UserApi.UserApiInfo>
  onRemove: (id: string, name: string) => void
  onChangeAllowShowUpdateAlert: (id: string, enabled: boolean) => void
  onChangeAutoUpdate: (id: string, enabled: boolean) => void
  onEditUrl: (item: LX.UserApi.UserApiInfo) => void
  onUpdateOne: (item: LX.UserApi.UserApiInfo) => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  const backupSetting = useSettingValue('common.apiBackupSources')
  const backupIds = backupSetting.filter(id => id !== activeId && userApiState.list.some(api => api.id === id))
  const order = backupIds.indexOf(item.id)
  const changeBackup = (enabled: boolean) => {
    updateSetting({ 'common.apiBackupSources': enabled ? [...new Set([...backupIds, item.id])] : backupIds.filter(id => id !== item.id) })
  }
  const moveBackup = (offset: number) => {
    const next = order + offset
    if (order < 0 || next < 0 || next >= backupIds.length) return
    const ids = [...backupIds]
    ;[ids[order], ids[next]] = [ids[next], ids[order]]
    updateSetting({ 'common.apiBackupSources': ids })
  }
  const changeAllowShowUpdateAlert = (check: boolean) => {
    onChangeAllowShowUpdateAlert(item.id, check)
  }
  const changeAutoUpdate = (check: boolean) => {
    onChangeAutoUpdate(item.id, check)
  }
  const handleRemove = () => {
    onRemove(item.id, item.name)
  }
  const statusColor = statusResult?.status === 'updated'
    ? theme['q-accent-text']
    : statusResult?.status === 'failed'
      ? '#C94A4A'
      : theme['c-font-label']

  return (
    <View style={{ ...styles.listItem, backgroundColor: activeId == item.id ? theme['c-primary-background-active'] : 'transparent' }}>
      <View style={styles.listItemLeft}>
        <Text size={14}>
          {item.name}
          {
            item.version ? (
              <Text size={12} color={theme['c-font-label']}>{ '   ' + formatVersionName(item.version) }</Text>
            ) : null
          }
          {
            item.author ? (
              <Text size={12} color={theme['c-font-label']}>{ '   ' + item.author }</Text>
            ) : null
          }
        </Text>
        {
          item.description ? (
            <Text size={12} color={theme['c-font-label']}>{item.description}</Text>
          ) : null
        }
        <Text size={11} color={theme['c-font-label']} numberOfLines={2}>
          {item.sourceUrl ? t('user_api_source_url_label', { url: item.sourceUrl }) : t('user_api_source_url_empty')}
        </Text>
        {activeId === item.id
          ? <Text size={12} color={theme['c-primary-font']}>{t('user_api_primary')}</Text>
          : <CheckBox check={order >= 0} label={t('user_api_backup')} onChange={changeBackup} size={0.86} />}
        {order >= 0 && activeId !== item.id ? (
          <View style={styles.backupOrder}>
            <Text size={11} color={theme['c-font-label']}>{t('user_api_backup_priority', { order: order + 1 })}</Text>
            <Button disabled={order === 0} accessibilityLabel={t('user_api_backup_up')} style={[styles.orderBtn, { opacity: order === 0 ? 0.35 : 1 }]} onPress={() => { moveBackup(-1) }}>
              <Text size={12} color={theme['c-primary-font']}>{t('user_api_backup_up')}</Text>
            </Button>
            <Button disabled={order === backupIds.length - 1} accessibilityLabel={t('user_api_backup_down')} style={[styles.orderBtn, { opacity: order === backupIds.length - 1 ? 0.35 : 1 }]} onPress={() => { moveBackup(1) }}>
              <Text size={12} color={theme['c-primary-font']}>{t('user_api_backup_down')}</Text>
            </Button>
          </View>
        ) : null}
        <CheckBox check={item.allowShowUpdateAlert} label={t('user_api_allow_show_update_alert')} onChange={changeAllowShowUpdateAlert} size={0.86} />
        <CheckBox check={Boolean(item.autoUpdate)} label={t('user_api_auto_update')} onChange={changeAutoUpdate} size={0.86} />
        <View style={styles.actionRow}>
          <Button
            accessibilityLabel={t('user_api_source_url_edit')}
            style={{ ...styles.compactBtn, backgroundColor: theme['q-surface-raised'], borderColor: theme['q-outline'] }}
            onPress={() => { onEditUrl(item) }}
          >
            <Text size={12} color={theme['c-font']}>{t('user_api_source_url_edit')}</Text>
          </Button>
          <Button
            disabled={updating || disableUpdate}
            accessibilityLabel={t('user_api_btn_update')}
            style={{ ...styles.compactBtn, backgroundColor: theme['q-surface-raised'], borderColor: theme['q-outline'], opacity: updating || disableUpdate ? 0.55 : 1 }}
            onPress={() => { onUpdateOne(item) }}
          >
            <Text size={12} color={theme['c-font']}>{updating ? t('user_api_btn_updating') : t('user_api_btn_update')}</Text>
          </Button>
        </View>
        {statusResult ? (
          <Text size={11} color={statusColor}>{getStatusText(t, statusResult)}</Text>
        ) : null}
      </View>
      <View style={styles.listItemRight}>
        <Button accessibilityLabel={`${t('delete')}: ${item.name}`} style={styles.btn} onPress={handleRemove}>
          <Icon accessible={false} name="close" color={theme['c-button-font']} />
        </Button>
      </View>
    </View>
  )
}

export interface UserApiEditModalProps {
  onSave: (rules: string) => void
  // onSourceChange: SourceSelectorProps['onSourceChange']
}
export interface UserApiEditModalType {
  show: (rules: string) => void
}


export default () => {
  const userApiList = useUserApiList()
  const apiSource = useSettingValue('common.apiSource')
  const backupSources = useSettingValue('common.apiBackupSources')
  const sourceOrder = [...new Set([apiSource, ...backupSources])]
  const rank = (id: string) => sourceOrder.includes(id) ? sourceOrder.indexOf(id) : sourceOrder.length
  const orderedList = [...userApiList].sort((a, b) => rank(a.id) - rank(b.id))
  const theme = useTheme()
  const t = useI18n()

  const preferQuality = useSettingValue('common.apiPreferQuality')
  const [updatingIds, setUpdatingIds] = useState<Record<string, boolean>>({})
  const [updatingAll, setUpdatingAll] = useState(false)
  const [statusMap, setStatusMap] = useState<Record<string, UserApiUpdateItemResult<LX.UserApi.UserApiInfo>>>({})
  const [batchSummary, setBatchSummary] = useState<UserApiBatchUpdateResult<LX.UserApi.UserApiInfo>['summary'] | null>(null)

  const urlAlertRef = useRef<ConfirmAlertType>(null)
  const urlInputRef = useRef<InputType>(null)
  const [urlModalVisible, setUrlModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<LX.UserApi.UserApiInfo | null>(null)
  const [editingUrl, setEditingUrl] = useState('')

  const handleRemove = useCallback(async(id: string, name: string) => {
    const confirm = await confirmDialog({
      message: global.i18n.t('user_api_remove_tip', { name }),
      cancelButtonText: global.i18n.t('cancel_button_text_2'),
      confirmButtonText: global.i18n.t('confirm_button_text'),
      bgClose: false,
    })
    if (!confirm) return
    void removeUserApi([id]).then(() => {
      updateSetting({ 'common.apiBackupSources': settingState.setting['common.apiBackupSources'].filter(value => value !== id) })
      if (settingState.setting['common.apiSource'] == id) {
        let backApiId = settingState.setting['common.apiBackupSources'].find(value => userApiState.list.some(api => api.id === value)) ?? apiSourceInfo.find(api => !api.disabled)?.id
        if (!backApiId) backApiId = userApiState.list[0]?.id
        setApiSource(backApiId ?? '')
      }
    })
  }, [])
  const handleChangeAllowShowUpdateAlert = useCallback((id: string, enabled: boolean) => {
    void setUserApiAllowShowUpdateAlert(id, enabled)
  }, [])
  const handleChangeAutoUpdate = useCallback((id: string, enabled: boolean) => {
    void setUserApiAutoUpdate(id, enabled).catch((error: unknown) => {
      toast(error instanceof Error ? error.message : String(error), 'long')
    })
  }, [])

  const openUrlEditor = useCallback((item: LX.UserApi.UserApiInfo) => {
    setEditingItem(item)
    setEditingUrl(item.sourceUrl ?? '')
    const showAlert = () => {
      urlAlertRef.current?.setVisible(true)
      setTimeout(() => {
        urlInputRef.current?.focus()
      }, 250)
    }
    if (urlModalVisible) showAlert()
    else {
      setUrlModalVisible(true)
      requestAnimationFrame(showAlert)
    }
  }, [urlModalVisible])

  const handleConfirmUrl = useCallback(async() => {
    if (!editingItem) return
    const trimmed = editingUrl.trim()
    try {
      const normalized = trimmed ? normalizeUserApiUrl(trimmed) : ''
      await updateUserApiSourceUrl(editingItem.id, normalized)
      setStatusMap(prev => {
        const current = prev[editingItem.id]
        if (!current || (current.status !== 'skipped' && current.status !== 'failed')) return prev
        const { [editingItem.id]: _removed, ...rest } = prev
        return rest
      })
      urlAlertRef.current?.setVisible(false)
    } catch (error: unknown) {
      toast(error instanceof Error ? error.message : String(error), 'long')
    }
  }, [editingItem, editingUrl])

  const handleUpdateOne = useCallback(async(item: LX.UserApi.UserApiInfo) => {
    if (updatingIds[item.id] || updatingAll) return
    if (!item.sourceUrl?.trim()) {
      setStatusMap(prev => ({
        ...prev,
        [item.id]: { id: item.id, name: item.name, status: 'failed', message: t('user_api_update_no_url') },
      }))
      return
    }
    setUpdatingIds(prev => ({ ...prev, [item.id]: true }))
    setBatchSummary(null)
    try {
      const { results } = await updateUserApisFromUrls([item.id])
      if (results[0]) {
        setStatusMap(prev => ({ ...prev, [item.id]: results[0] }))
      }
    } finally {
      setUpdatingIds(prev => {
        const { [item.id]: _done, ...rest } = prev
        return rest
      })
    }
  }, [t, updatingAll, updatingIds])

  const handleUpdateAll = useCallback(async() => {
    if (updatingAll || !userApiList.length) return
    setUpdatingAll(true)
    const nextUpdating: Record<string, boolean> = {}
    for (const api of userApiList) nextUpdating[api.id] = true
    setUpdatingIds(nextUpdating)
    try {
      const { results, summary } = await updateUserApisFromUrls()
      setStatusMap(prev => {
        const next = { ...prev }
        for (const item of results) next[item.id] = item
        return next
      })
      setBatchSummary(summary)
    } finally {
      setUpdatingIds({})
      setUpdatingAll(false)
    }
  }, [updatingAll, userApiList])

  return (
    <>
      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps={'always'}>
        {userApiList.length > 0 && (
          <View style={styles.headerActions}>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingHorizontal: 8 }}>
              {[false, true].map(quality => <Button key={String(quality)} accessibilityRole="radio" accessibilityState={{ checked: preferQuality === quality }}
                onPress={() => { updateSetting({ 'common.apiPreferQuality': quality }) }}
                style={{ paddingHorizontal: 14, minHeight: 44, justifyContent: 'center', borderRadius: 12, backgroundColor: quality === preferQuality ? theme['q-surface-tint'] : theme['q-surface-raised'] }}>
                <Text size={13} color={quality === preferQuality ? theme['q-accent-text'] : theme['q-text-secondary']}>{t(quality ? 'user_api_quality_first' : 'user_api_play_first')}</Text>
              </Button>)}
            </View>
            <View style={styles.updateAllRow}>
              <Button
                disabled={updatingAll}
                accessibilityLabel={t('user_api_btn_update_all')}
                style={{ ...styles.compactBtn, backgroundColor: theme['q-surface-raised'], borderColor: theme['q-outline'], opacity: updatingAll ? 0.55 : 1 }}
                onPress={handleUpdateAll}
              >
                <Text size={12} color={theme['c-font']}>{updatingAll ? t('user_api_btn_updating') : t('user_api_btn_update_all')}</Text>
              </Button>
              {batchSummary ? (
                <Text size={11} color={theme['c-font-label']}>{t('user_api_update_all_summary', batchSummary)}</Text>
              ) : null}
            </View>
          </View>
        )}
        <Text size={12} color={theme['c-font-label']} style={{ padding: 10, lineHeight: 19 }}>{t(preferQuality ? 'user_api_quality_hint' : 'user_api_backup_hint')}</Text>
        <View>
          {
            userApiList.length
              ? orderedList.map((item) => {
                return (
                  <ListItem
                    key={item.id}
                    item={item}
                    activeId={apiSource}
                    updating={Boolean(updatingIds[item.id])}
                    disableUpdate={updatingAll}
                    statusResult={statusMap[item.id]}
                    onRemove={handleRemove}
                    onChangeAllowShowUpdateAlert={handleChangeAllowShowUpdateAlert}
                    onChangeAutoUpdate={handleChangeAutoUpdate}
                    onEditUrl={openUrlEditor}
                    onUpdateOne={handleUpdateOne}
                  />
                )
              })
              : <Text style={styles.tipText} color={theme['c-font-label']}>{t('user_api_empty')}</Text>
          }
        </View>
      </ScrollView>
      {urlModalVisible ? (
        <ConfirmAlert
          ref={urlAlertRef}
          onConfirm={handleConfirmUrl}
          confirmText={t('confirm_button_text')}
        >
          <View style={styles.urlModalContent}>
            <Text size={13} style={{ marginBottom: 6 }}>{t('user_api_source_url_edit')}</Text>
            <Input
              ref={urlInputRef}
              value={editingUrl}
              onChangeText={setEditingUrl}
              placeholder={t('user_api_source_url_input_tip')}
              style={{ ...styles.urlInput, backgroundColor: theme['c-primary-input-background'] }}
            />
          </View>
        </ConfirmAlert>
      ) : null}
    </>
  )
}


const styles = createStyle({
  headerActions: {
    gap: 8,
  },
  updateAllRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  compactBtn: {
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backupOrder: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  orderBtn: { minWidth: 44, minHeight: 40, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  scrollView: {
    paddingHorizontal: 7,
    flexGrow: 0,
  },
  list: {
    paddingBottom: 15,
    flexDirection: 'column',
  },
  listItem: {
    padding: 10,
    borderRadius: BorderRadius.normal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listItemLeft: {
    paddingRight: 10,
    flex: 1,
    gap: 4,
  },
  listItemRight: {
    flex: 0,
  },
  btn: {
    width: 48,
    minWidth: 48,
    height: 48,
    minHeight: 48,
    padding: 0,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    textAlign: 'center',
    marginTop: 25,
    marginBottom: 15,
  },
  urlModalContent: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'column',
  },
  urlInput: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    borderRadius: 4,
  },
})
