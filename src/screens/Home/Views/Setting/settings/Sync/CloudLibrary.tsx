import { memo, useEffect, useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import RNFS from 'react-native-fs'
import ChoosePath, { type ChoosePathType } from '@/components/common/ChoosePath'
import CheckBox from '@/components/common/CheckBox'
import Text from '@/components/common/Text'
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

export default memo(() => {
  const theme = useTheme()
  const picker = useRef<ChoosePathType>(null)
  const drafts = useRef<Partial<Record<CloudProvider, { config: CloudConfig, configured: boolean }>>>({})
  const [config, setConfig] = useState<CloudConfig>(defaultConfig)
  const [configured, setConfigured] = useState(false)
  const [password, setPassword] = useState('')
  const [playlist, setPlaylist] = useState('云端曲库')
  const [tracks, setTracks] = useState<CloudTrack[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [importedListId, setImportedListId] = useState('')

  useEffect(() => {
    void getCloudConfig().then(saved => {
      setConfigured(saved.configured)
      setConfig({ ...defaultConfig, ...saved, secretKey: '' })
    }).catch(() => {})
  }, [])

  const update = (key: keyof CloudConfig) => (value: string, callback: (value: string) => void) => {
    setConfig(current => ({ ...current, [key]: value }))
    callback(value)
  }

  const run = async(task: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setStatus('')
    try { await task() } catch (error: unknown) { setStatus(error instanceof Error ? error.message : '云端操作失败') } finally { setBusy(false) }
  }

  const save = () => {
    void run(async() => {
      await saveCloudConfig(config)
      const saved = await getCloudConfig()
      setConfigured(saved.configured)
      setConfig(current => ({ ...current, secretKey: '' }))
      drafts.current[config.provider] = { config: { ...config, secretKey: '' }, configured: saved.configured }
      setTracks([])
      setSelected([])
      setImportedListId('')
      setStatus('云端配置已保存')
    })
  }

  const refresh = () => {
    void run(async() => {
      const result = await listCloudTracks(password)
      setTracks(result)
      setSelected(result.map(track => track.id))
      setImportedListId('')
      setStatus(`云端共有 ${result.length} 首歌曲`)
    })
  }

  const uploadPaths = async(paths: string[]) => {
    await listCloudTracks(password)
    for (let index = 0; index < paths.length; index++) {
      setStatus(`正在上传 ${index + 1}/${paths.length}`)
      const metadata = await readMetadata(paths[index]).catch(() => null)
      await uploadCloudTrack(paths[index], password, playlist, metadata?.name ?? '', metadata?.singer ?? '')
    }
    setStatus(`已上传 ${paths.length} 首歌曲`)
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
  const canUse = configured
  const changeProvider = (provider: CloudProvider) => {
    if (provider == config.provider) return
    void run(async() => {
      drafts.current[config.provider] = { config: { ...config }, configured }
      const saved = await selectCloudProvider(provider)
      const draft = drafts.current[provider]
      setConfig(draft?.config ?? { ...defaultConfig, ...saved, provider, secretKey: '' })
      setConfigured(draft?.configured ?? saved.configured)
      setTracks([])
      setSelected([])
      setImportedListId('')
    })
  }

  return (
    <>
      <SubTitle title="远程存储">
        <Text size={12} color={theme['q-text-secondary']}>上传歌曲后，可在其他设备导入。S3 静态加密取决于服务商及存储桶配置；端到端口令可选。</Text>
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
      <InputItem immediate label="服务地址" value={config.endpoint} onChanged={update('endpoint')} placeholder="https://..." inputMode="url" />
      {config.provider == 's3' ? <>
        <InputItem immediate label="区域" value={config.region} onChanged={update('region')} placeholder="us-east-1" />
        <InputItem immediate label="存储桶" value={config.bucket} onChanged={update('bucket')} />
      </> : null}
      <InputItem immediate label="云端目录" value={config.prefix} onChanged={update('prefix')} placeholder="qmusic" />
      <InputItem immediate label={config.provider == 's3' ? 'Access Key' : '用户名'} value={config.accessKey} onChanged={update('accessKey')} />
      <InputItem immediate label={config.provider == 's3' ? 'Secret Key' : '密码'} value={config.secretKey} onChanged={update('secretKey')}
        secureTextEntry placeholder={configured ? '已保存；留空则保持不变' : ''} />
      <View style={styles.actions}><Button disabled={busy} onPress={save}>保存配置</Button></View>
      <InputItem label="端到端口令" value={password} onChanged={(value, callback) => { setPassword(value); callback(value) }}
        secureTextEntry placeholder="可选；填写后两端使用相同口令" />
      <Text style={styles.status} size={12} color={theme['q-text-secondary']}>当前模式：{password ? '端到端加密' : '免口令'}。两种模式的云端目录相互独立。</Text>
      <InputItem label="上传到歌单" value={playlist} onChanged={(value, callback) => { setPlaylist(value); callback(value) }} />
      <View style={styles.actions}>
        <Button disabled={busy || !canUse} onPress={() => picker.current?.show({ title: '选择歌曲', dirOnly: false, filter: AUDIO_EXT })}>上传歌曲</Button>
        <Button disabled={busy || !canUse} onPress={uploadDownloaded}>上传已下载歌曲</Button>
      </View>
      <View style={styles.actions}><Button disabled={busy || !canUse} onPress={refresh}>查看云端歌曲</Button></View>
      {status ? <Text style={styles.status} size={12} color={theme['q-text-secondary']}>{status}</Text> : null}
      {tracks.length ? <>
        <View style={styles.selectionBar}>
          <Text size={12} color={theme['q-text-secondary']}>已选 {selected.length}/{tracks.length} 首</Text>
          <Button disabled={busy} onPress={() => { setSelected(selected.length == tracks.length ? [] : tracks.map(track => track.id)) }}>
            {selected.length == tracks.length ? '取消全选' : '全选'}
          </Button>
        </View>
        <View style={styles.actions}>
          <Button disabled={busy || !selected.length} onPress={() => { importSelected('playlist') }}>导入歌单</Button>
          <Button disabled={busy || !selected.length} onPress={() => { importSelected('songs') }}>导入歌曲</Button>
        </View>
        {importedListId ? <View style={styles.actions}>
          <Button onPress={() => { setActiveList(importedListId); setNavActiveId('nav_love') }}>查看导入结果</Button>
        </View> : null}
        <View style={styles.trackList}>
          {tracks.map(track => <CheckBox key={track.id} check={selected.includes(track.id)}
            label={`${track.name} · ${track.playlist}`} onChange={() => { toggle(track.id) }} />)}
        </View>
      </> : null}
      <ChoosePath ref={picker} onConfirm={path => { upload([path]) }} />
    </>
  )
})

const styles = createStyle({
  providers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  provider: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 6 },
  actions: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12, flexWrap: 'wrap', gap: 8 },
  selectionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  status: { paddingHorizontal: 16, marginBottom: 12 },
  trackList: { paddingHorizontal: 16, marginBottom: 20 },
})
