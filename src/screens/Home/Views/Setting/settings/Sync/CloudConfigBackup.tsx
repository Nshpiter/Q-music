import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import Text from '@/components/common/Text'
import CheckBox from '@/components/common/CheckBox'
import PressButton from '@/components/common/Button'
import { useTheme } from '@/store/theme/hook'
import { confirmDialog } from '@/utils/tools'
import { generateCloudBackupKey, listCloudBackups } from '@/core/cloudLibrary'
import { uploadCloudConfig, previewCloudConfig } from '@/core/cloudConfigBackup'
import type { SnapshotSelection } from '@/utils/cloudSnapshot'
import InputItem from '../../components/InputItem'
import Button from '../../components/Button'
import SubTitle from '../../components/SubTitle'

const names = { tx: 'QQ 音乐', wy: '网易云音乐', kg: '酷狗音乐' }
const choices = [{ key: 'settings', name: '通用设置' }, { key: 'sources', name: '音源与主备顺序' }, { key: 'accounts', name: '账号登录状态' }] as const
export default ({ disabled, connection, onBusyChange, defaultExpanded = false }: { defaultExpanded?: boolean, disabled: boolean, connection: string, onBusyChange: (value: boolean) => void }) => {
  const theme = useTheme()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [selected, setSelected] = useState<SnapshotSelection>({ settings: true, sources: true, accounts: false })
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [status, setStatus] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewCloudConfig>> | null>(null)
  const blocked = disabled || busy
  const anySelected = Object.values(selected).some(Boolean)
  useEffect(() => { setFiles([]); setPreview(null); setStatus('') }, [connection])
  const run = async(task: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true; setBusy(true); onBusyChange(true); setStatus('')
    try { await task() } catch (error) { setStatus(error instanceof Error ? error.message : '操作失败，请重试') } finally { busyRef.current = false; setBusy(false); onBusyChange(false) }
  }
  const upload = () => {
    void run(async() => {
      if (!await confirmDialog({ message: `上传勾选的配置${selected.accounts ? '及账号登录状态' : ''}到已配置的远程存储？每次上传会新建一份加密备份。`, confirmButtonText: '上传备份' })) return
      const id = await uploadCloudConfig(password, selected)
      setFiles(current => [id, ...current.filter(item => item != id)].slice(0, 50)); setPreview(null)
      setStatus('备份上传成功。另一设备使用相同连接和密钥即可预览恢复。')
    })
  }
  const inspect = (id: string) => { void run(async() => { setPreview(null); setPreview(await previewCloudConfig(id, password)) }) }
  const restore = () => {
    void run(async() => {
      if (!preview || !await confirmDialog({ message: '恢复勾选的内容？兼容设置覆盖本机对应项，音源合并且不删除已有音源；勾选账号会替换备份包含的平台登录状态。', confirmButtonText: '恢复' })) return
      setPreview(null)
      await preview.restore(selected)
      setStatus('恢复完成。请重启应用刷新音源与账号状态；过期账号需重新登录。')
    })
  }
  const row = { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, paddingHorizontal: 16, marginBottom: 12 }
  return <View style={{ marginVertical: 12 }}>
    <PressButton accessibilityState={{ expanded }} disabled={busy} onPress={() => { setExpanded(value => !value) }} style={{ marginHorizontal: 16, padding: 16, borderRadius: 14, backgroundColor: theme['q-surface-tint'] }}>
      <Text size={14} color={theme['q-text-primary']}>配置备份与恢复 {expanded ? '⌃' : '›'}</Text>
      <Text size={12} color={theme['q-text-secondary']}>设置、音源和账号 · 手机 / 车机 / PC</Text>
    </PressButton>
    {expanded ? <>
      <SubTitle title="选择备份 / 恢复内容">
        {choices.map(item => <CheckBox key={item.key} disabled={busy} check={selected[item.key]} label={item.name} onChange={() => { setSelected(value => ({ ...value, [item.key]: !value[item.key] })) }} />)}
        <Text size={12} color={theme['q-text-secondary']}>只迁移兼容偏好，不搬运设备路径和权限。音源按内容合并，账号默认不备份。</Text>
      </SubTitle>
      <InputItem immediate editable={!busy} label="配置备份密钥" value={password} secureTextEntry placeholder="至少 8 位，两端使用同一密钥" onChanged={(value, callback) => { setPassword(value); setPreview(null); callback(value) }} />
      <View style={row}>
        <Button disabled={busy} onPress={() => { void run(async() => { setPassword(await generateCloudBackupKey()); setPreview(null); setStatus('密钥已生成，请复制保存；点击输入框右侧图标可查看。') }) }}>生成密钥</Button>
        <Button disabled={busy || !password} onPress={() => { Clipboard.setString(password); setStatus('密钥已复制，请妥善保存。') }}>复制密钥</Button>
      </View>
      <Text size={12} style={{ marginHorizontal: 16, marginBottom: 12 }} color={theme['q-text-secondary']}>配置备份始终加密。请保存密钥；这不会改变云端歌曲的加密方式。</Text>
      <View style={row}>
        <Button disabled={blocked || password.length < 8 || !anySelected} onPress={upload}>上传配置备份</Button>
        <Button disabled={blocked} onPress={() => { void run(async() => { const ids = await listCloudBackups(); setFiles(ids); setPreview(null); setStatus(ids.length ? `找到 ${ids.length} 份备份，点击预览（最多显示最近 50 份）` : '还没有配置备份，请先在已有音源的设备上传。') }) }}>查看云端备份</Button>
      </View>
      {disabled && !busy ? <Text size={12} style={{ marginHorizontal: 16 }} color={theme['q-text-secondary']}>请先保存上方远程连接。</Text> : null}
      {files.map(id => <PressButton key={id} disabled={blocked || password.length < 8} onPress={() => { inspect(id) }} style={{ padding: 14, borderRadius: 12, marginHorizontal: 16, marginBottom: 6, backgroundColor: theme['q-surface-base'] }}>
        <Text size={13} color={theme['q-text-primary']}>{new Date(Number(id.slice(0, 13))).toLocaleString()} ›</Text>
        <Text size={11} color={theme['q-text-secondary']}>备份 {id.slice(14, 20)} · 点击预览</Text>
      </PressButton>)}
      {preview ? <SubTitle title={`${preview.platform == 'android' ? '安卓' : 'PC'} · ${new Date(preview.createdAt).toLocaleString()}`}>
        <Text size={12} color={theme['q-text-primary']}>兼容设置 {preview.settings} 项；音源 {preview.sources.length} 个；账号 {preview.accounts.map(id => names[id]).join('、') || '无'}。</Text>
        {preview.sources.length ? <Text size={12} color={theme['q-text-secondary']}>音源：{preview.sources.join('、')}</Text> : null}
        <Button disabled={blocked || !anySelected} onPress={restore}>恢复勾选的内容</Button>
      </SubTitle> : null}
      {busy ? <ActivityIndicator color={theme['q-accent']} /> : null}
      {status ? <Text accessibilityLiveRegion="polite" size={12} style={{ marginHorizontal: 16, marginVertical: 12 }} color={theme['q-text-primary']}>{status}</Text> : null}
    </> : null}
  </View>
}
