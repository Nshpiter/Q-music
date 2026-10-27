import { useCallback } from 'react'
import Text from '@/components/common/Text'
import { View, ScrollView } from 'react-native'
import { confirmDialog, createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useUserApiList, state as userApiState } from '@/store/userApi'
import { useSettingValue } from '@/store/setting/hook'
import { removeUserApi, setUserApiAllowShowUpdateAlert } from '@/core/userApi'
import { BorderRadius } from '@/theme'
import CheckBox from '@/components/common/CheckBox'
import { Icon } from '@/components/common/Icon'
import settingState from '@/store/setting/state'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { setApiSource } from '@/core/apiSource'
import Button from '@/components/common/Button'
import { updateSetting } from '@/core/common'

const formatVersionName = (version: string) => {
  return /^\d/.test(version) ? `v${version}` : version
}
const ListItem = ({ item, activeId, onRemove, onChangeAllowShowUpdateAlert }: {
  item: LX.UserApi.UserApiInfo
  activeId: string
  onRemove: (id: string, name: string) => void
  onChangeAllowShowUpdateAlert: (id: string, enabled: boolean) => void
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
  const handleRemove = () => {
    onRemove(item.id, item.name)
  }

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

  return (
    <ScrollView style={styles.scrollView} keyboardShouldPersistTaps={'always'}>
      <Text size={12} color={theme['c-font-label']} style={{ padding: 10, lineHeight: 19 }}>{t('user_api_backup_hint')}</Text>
      <View>
        {
          userApiList.length
            ? orderedList.map((item) => {
              return (
              <ListItem
                key={item.id}
                item={item}
                activeId={apiSource}
                onRemove={handleRemove}
                onChangeAllowShowUpdateAlert={handleChangeAllowShowUpdateAlert}
              />
              )
            })
            : <Text style={styles.tipText} color={theme['c-font-label']}>{t('user_api_empty')}</Text>
        }
      </View>
    </ScrollView>
  )
}


const styles = createStyle({
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
    gap: 2,
  },
  listItemRight: {
    flex: 0,
    // backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  // btns: {
  //   padding: 5,
  // },
  btn: {
    width: 48,
    minWidth: 48,
    height: 48,
    minHeight: 48,
    padding: 0,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    // backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  tipText: {
    textAlign: 'center',
    marginTop: 25,
    marginBottom: 15,
  },
})


