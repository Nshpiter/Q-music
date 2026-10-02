import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, TouchableOpacity, View } from 'react-native'
import RNFS from 'react-native-fs'
import ChoosePath, { type ChoosePathType } from '@/components/common/ChoosePath'
import CheckBox from '@/components/common/CheckBox'
import Text from '@/components/common/Text'
import Input from '@/components/common/Input'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle, requestStoragePermission, confirmDialog } from '@/utils/tools'
import { createList, addListMusics, setActiveList } from '@/core/list'
import { setNavActiveId } from '@/core/common'
import listState from '@/store/list/state'
import settingState from '@/store/setting/state'
import { LIST_IDS } from '@/config/constant'
import { readMetadata } from '@/utils/localMediaMetadata'
import { formatPlayTime2 } from '@/utils'
import { getCloudConfig, importCloudTracks, listCloudTracks, saveCloudConfig, selectCloudProvider, uploadCloudTrack, type CloudConfig, type CloudProvider, type CloudTrack } from '@/core/cloudLibrary'
import InputItem from '../../components/InputItem'
import SubTitle from '../../components/SubTitle'
import Button from '../../components/Button'

const AUDIO_EXT = ['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg', 'ape']
const DOWNLOAD_DIR = `${RNFS.ExternalStorageDirectoryPath}/Music/QMusic`

const defaultConfig: CloudConfig = {
  provider: 's3', endpoint: '', region: 'us-east-1', bucket: '', prefix: '', accessKey: '', secretKey: '',
}
const configKeys = Object.keys(defaultConfig) as Array<keyof CloudConfig>

export default memo(() => {
  const theme = useTheme()
  const picker = useRef<ChoosePathType>(null)
  const drafts = useRef<Partial<Record<CloudProvider, { config: CloudConfig, configured: boolean }>>>({})
  const [config, setConfig] = useState<CloudConfig>(defaultConfig)
  const [savedConfig, setSavedConfig] = useState<CloudConfig>(defaultConfig)
  const [showConfig, setShowConfig] = useState(true)
  const [configured, setConfigured] = useState(false)
  const [password, setPassword] = useState('')
  const [playlist, setPlaylist] = useState('云端曲库')
  const [tracks, setTracks] = useState<CloudTrack[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [statusKind, setStatusKind] = useState<'info' | 'error'>('info')
  const [loaded, setLoaded] = useState(false)
  const [query, setQuery] = useState('')
  const [importedListId, setImportedListId] = useState('')
  const busyRef = useRef(false)
  const hasConfigChanges = configKeys.some(key => config[key] !== savedConfig[key])
  const visibleTracks = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase()
    return keyword ? tracks.filter(track => [track.name, track.singer, track.playlist].join(' ').toLocaleLowerCase().includes(keyword)) : tracks
  }, [tracks, query])
  const selectedIds = new Set(selected)
  const allVisibleSelected = visibleTracks.length > 0 && visibleTracks.every(track => selectedIds.has(track.id))

  const resetTracks = () => {
    setTracks([])
    setSelected([])
    setImportedListId('')
    setLoaded(false)
    setQuery('')
    setStatus('')
    setStatusKind('info')
  }

  useEffect(() => {
    void getCloudConfig().then(saved => {
      setConfigured(saved.configured)
      const values = { ...defaultConfig, ...saved, secretKey: '' }
      setConfig(values)
      setSavedConfig(values)
      setShowConfig(!saved.configured)
    }).catch(() => { setStatusKind('error'); setStatus('无法读取连接设置，请重新打开云端曲库') })
  }, [])

  const update = (key: keyof CloudConfig) => (value: string, callback: (value: string) => void) => {
    setConfig(current => ({ ...current, [key]: value }))
    callback(value)
  }

  const run = async(task: () => Promise<void>, message = '') => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setStatus(message)
    setStatusKind('info')
    try { await task() } catch (error: unknown) {
      setStatusKind('error')
      setStatus(error instanceof Error ? error.message : '云端操作失败，请重试')
    } finally { busyRef.current = false; setBusy(false) }
  }

  const save = () => {
    void run(async() => {
      await saveCloudConfig(config)
      const saved = await getCloudConfig()
      setConfigured(saved.configured)
      setConfig(current => ({ ...current, secretKey: '' }))
      setSavedConfig({ ...config, secretKey: '' })
      setShowConfig(false)
      drafts.current[config.provider] = { config: { ...config, secretKey: '' }, configured: saved.configured }
      resetTracks()
      setStatus('云端配置已保存')
    })
  }

  const refresh = () => {
    void run(async() => {
      const result = await listCloudTracks(password)
      setTracks(result)
      const ids = new Set(result.map(track => track.id))
      setSelected(current => current.filter(id => ids.has(id)))
      setLoaded(true)
      setStatus(`连接成功，云端共有 ${result.length} 首歌曲`)
    }, '正在连接并加载云端歌曲…')
  }

  const uploadPaths = async(paths: string[]) => {
    const result = await listCloudTracks(password)
    setTracks(result)
    const ids = new Set(result.map(track => track.id))
    setSelected(current => current.filter(id => ids.has(id)))
    setLoaded(true)
    for (let index = 0; index < paths.length; index++) {
      setStatus(`正在上传 ${index + 1}/${paths.length}`)
      const metadata = await readMetadata(paths[index]).catch(() => null)
      const uploaded = await uploadCloudTrack(paths[index], password, playlist, metadata?.name ?? '', metadata?.singer ?? '')
      setTracks(current => [...current.filter(track => track.id != uploaded.id), uploaded])
    }
    setStatus(`已上传 ${paths.length} 首歌曲`)
    setQuery('')
  }

  const upload = (paths: string[]) => { void run(async() => uploadPaths(paths)) }

  const uploadDownloaded = () => {
    void run(async() => {
      if (!await requestStoragePermission()) return
      const files = await RNFS.readDir(DOWNLOAD_DIR).catch(() => [])
      const paths = files.filter(file => file.isFile() && AUDIO_EXT.some(ext => file.name.toLowerCase().endsWith(`.${ext}`))).map(file => file.path)
      if (!paths.length) { setStatus('下载目录中没有歌曲'); return }
      await uploadPaths(paths)
    })
  }

  const importSelected = (mode: 'playlist' | 'songs') => {
    void run(async() => {
      if (!selected.length) return
      if (!await confirmDialog({ message: `将 ${selected.length} 首云端歌曲下载到本地？`, confirmButtonText: '导入' })) return
      if (!await requestStoragePermission()) return
      setImportedListId('')
      setStatus(password ? '正在下载并解密歌曲' : '正在下载歌曲')
      const imported = await importCloudTracks(selected, password)
      if (!imported.length) throw new Error('没有找到选中的云端歌曲，请刷新列表后重试')
      const infos: LX.Music.MusicInfoLocal[] = await Promise.all(imported.map(async track => {
        const metadata = await readMetadata(track.filePath).catch(() => null)
        return {
          id: track.filePath,
          name: metadata?.name ? metadata.name : track.name,
          singer: metadata?.singer ? metadata.singer : track.singer,
          source: 'local' as const,
          interval: metadata ? formatPlayTime2(metadata.interval) : null,
          meta: { albumName: metadata?.albumName ?? '', filePath: track.filePath, songId: track.filePath, picUrl: '', ext: metadata?.ext ?? track.fileName.split('.').at(-1) ?? '' },
        }
      }))
      let resultListId: string = LIST_IDS.DEFAULT
      if (mode == 'songs') await addListMusics(LIST_IDS.DEFAULT, infos, settingState.setting['list.addMusicLocationType'])
      else {
        for (const [index, name] of [...new Set(imported.map(track => track.playlist))].entries()) {
          const paths = new Set(imported.filter(track => track.playlist == name).map(track => track.filePath))
          const list = infos.filter(info => paths.has(info.meta.filePath))
          const existing = listState.userList.find(item => item.name == name)
          const id = existing?.id ?? `userlist_${Date.now()}_${index}`
          if (existing) await addListMusics(id, list, settingState.setting['list.addMusicLocationType'])
          else await createList({ name, id, list })
          if (index == 0) resultListId = id
        }
      }
      setImportedListId(resultListId)
      setStatus(`已导入 ${infos.length} 首歌曲到${mode == 'songs' ? '默认列表' : '歌单'}`)
    })
  }

  const toggle = (id: string) => { setSelected(current => current.includes(id) ? current.filter(item => item != id) : [...current, id]) }
  const canUse = configured && !hasConfigChanges
  const toggleAll = () => {
    const visibleIds = new Set(visibleTracks.map(track => track.id))
    setSelected(current => allVisibleSelected
      ? current.filter(id => !visibleIds.has(id))
      : [...new Set([...current, ...visibleIds])])
  }
  const changeProvider = (provider: CloudProvider) => {
    if (provider == config.provider) return
    void run(async() => {
      drafts.current[config.provider] = { config: { ...config }, configured }
      const saved = await selectCloudProvider(provider)
      const draft = drafts.current[provider]
      const values = { ...defaultConfig, ...saved, provider, secretKey: '' }
      setSavedConfig(values)
      setConfig(draft?.config ?? values)
      setConfigured(draft?.configured ?? saved.configured)
      resetTracks()
    })
  }

  return (
    <>
      <SubTitle title="远程存储">
        <Text size={12} color={theme['q-text-secondary']}>上传本地歌曲，在其他设备按歌单或歌曲导入。</Text>
        <View style={styles.providers}>
          {(['s3', 'webdav'] as const).map(provider => (
            <TouchableOpacity key={provider} accessibilityRole="radio" accessibilityState={{ selected: config.provider == provider }}
              style={{ ...styles.provider, backgroundColor: config.provider == provider ? theme['q-surface-tint'] : theme['q-surface-base'] }}
              disabled={busy} onPress={() => { changeProvider(provider) }}>
              <Text size={13} color={theme['q-text-primary']}>{provider == 's3' ? 'S3 / 兼容 S3' : 'WebDAV'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </SubTitle>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: showConfig }}
        style={[styles.configToggle, { backgroundColor: theme['q-surface-tint'] }]} onPress={() => { setShowConfig(current => !current) }}>
        <View style={styles.summary}>
          <Text size={13} color={theme['q-text-primary']}>{hasConfigChanges ? '有修改待保存' : configured ? '已保存连接' : '请设置连接'}</Text>
          <Text size={12} color={theme['q-text-secondary']}>{showConfig ? '收起连接设置' : '编辑连接设置'}</Text>
        </View>
        <Icon name={showConfig ? 'chevron-down' : 'chevron-right'} size={16} color={theme['q-accent-text']} />
      </TouchableOpacity>
      {showConfig ? <>
      <InputItem immediate editable={!busy} label="服务地址" value={config.endpoint} onChanged={update('endpoint')} placeholder="https://..." inputMode="url" />
      {config.provider == 's3' ? <>
        <InputItem immediate editable={!busy} label="区域" value={config.region} onChanged={update('region')} placeholder="us-east-1" />
        <InputItem immediate editable={!busy} label="存储桶" value={config.bucket} onChanged={update('bucket')} />
      </> : null}
      <InputItem immediate editable={!busy} label="云端目录" value={config.prefix} onChanged={update('prefix')} placeholder="qmusic" />
      <InputItem immediate editable={!busy} label={config.provider == 's3' ? 'Access Key' : '用户名'} value={config.accessKey} onChanged={update('accessKey')} />
      <InputItem immediate editable={!busy} label={config.provider == 's3' ? 'Secret Key' : '密码'} value={config.secretKey} onChanged={update('secretKey')}
        secureTextEntry placeholder={configured ? '已保存；留空则保持不变' : ''} />
      <View style={styles.actions}><Button disabled={busy} onPress={save}>保存配置</Button></View>
      </> : null}
      {hasConfigChanges ? <Text style={styles.status} size={12} color={theme['q-accent-text']}>请先保存连接设置，再查看或上传歌曲。</Text> : null}
      <InputItem immediate editable={!busy} label="端到端口令" value={password} onChanged={(value, callback) => { if (value != password) { setPassword(value); resetTracks() }; callback(value) }}
        secureTextEntry placeholder="可选，至少 8 个字符；两端保持相同" />
      <Text style={styles.status} size={12} color={theme['q-text-secondary']}>当前模式：{password ? '端到端加密' : '免口令'}。两种模式的云端目录相互独立。</Text>
      <InputItem immediate editable={!busy} label="上传到歌单" value={playlist} onChanged={(value, callback) => { setPlaylist(value); callback(value) }} />
      <View style={styles.actions}>
        <Button disabled={busy || !canUse} onPress={() => picker.current?.show({ title: '选择歌曲', dirOnly: false, filter: AUDIO_EXT })}>上传歌曲</Button>
        <Button disabled={busy || !canUse} onPress={uploadDownloaded}>上传已下载歌曲</Button>
      </View>
      <View style={styles.actions}><Button disabled={busy || !canUse} onPress={refresh}>{loaded ? '刷新云端歌曲' : '连接并查看歌曲'}</Button></View>
      {status || busy ? <View style={[styles.statusCard, { backgroundColor: theme['q-surface-tint'], borderColor: statusKind == 'error' ? '#d45757' : theme['q-outline'] }]}>
        {busy ? <ActivityIndicator size="small" color={theme['q-accent']} /> : null}
        <Text accessibilityLiveRegion="polite" style={styles.statusText} size={12} color={theme['q-text-primary']}>{status || '正在处理…'}</Text>
      </View> : null}
      {tracks.length ? <>
        <View style={styles.searchRow}>
          <Input value={query} onChangeText={setQuery} clearBtn accessibilityLabel="搜索云端歌曲" placeholder="搜索歌曲、歌手或歌单" />
        </View>
        <View style={styles.selectionBar}>
          <Text size={12} color={theme['q-text-secondary']}>已选 {selected.length}/{tracks.length} 首</Text>
          <Button disabled={busy || !visibleTracks.length} onPress={toggleAll} style={styles.selectionButton}>
            {allVisibleSelected ? '取消当前选择' : query ? '选中搜索结果' : '全选'}
          </Button>
        </View>
        <View style={styles.actions}>
          <Button disabled={busy || !canUse || !selected.length} onPress={() => { importSelected('playlist') }}>导入歌单</Button>
          <Button disabled={busy || !canUse || !selected.length} onPress={() => { importSelected('songs') }}>导入歌曲</Button>
        </View>
        {importedListId ? <View style={styles.actions}>
          <Button onPress={() => { setActiveList(importedListId); setNavActiveId('nav_love') }}>查看导入结果</Button>
        </View> : null}
        <View style={styles.trackList}>
          {visibleTracks.map(track => <View key={track.id} style={[styles.trackCard, { backgroundColor: selectedIds.has(track.id) ? theme['q-surface-tint'] : theme['q-surface-base'], borderColor: selectedIds.has(track.id) ? theme['q-accent'] : theme['q-outline'] }]}>
            <CheckBox disabled={busy} check={selectedIds.has(track.id)}
              label={`${track.name}\n${[track.singer, track.playlist].filter(Boolean).join(' · ')}`} onChange={() => { toggle(track.id) }} />
          </View>)}
          {!visibleTracks.length ? <Text style={styles.empty} size={13} color={theme['q-text-secondary']}>没有匹配的歌曲，试试其他关键词。</Text> : null}
        </View>
      </> : loaded && !busy ? <Text style={styles.empty} size={13} color={theme['q-text-secondary']}>云端还没有歌曲。上传本地歌曲后，便可在其他设备导入。</Text> : null}
      <ChoosePath ref={picker} onConfirm={path => { upload([path]) }} />
    </>
  )
})

const styles = createStyle({
  providers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  provider: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, minHeight: 44 },
  configToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, marginHorizontal: 16, marginBottom: 16, borderRadius: 12 },
  summary: { flexShrink: 1, gap: 4 },
  actions: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12, flexWrap: 'wrap', gap: 8 },
  selectionBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  selectionButton: { marginRight: 0 },
  status: { paddingHorizontal: 16, marginBottom: 12 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 16, borderWidth: 1, borderRadius: 12, padding: 12 },
  statusText: { flex: 1, lineHeight: 19 },
  searchRow: { paddingHorizontal: 16, marginBottom: 12 },
  trackList: { paddingHorizontal: 16, marginBottom: 20 },
  trackCard: { padding: 10, marginBottom: 8, borderWidth: 1, borderRadius: 12 },
  empty: { padding: 20, lineHeight: 22, textAlign: 'center' },
})
