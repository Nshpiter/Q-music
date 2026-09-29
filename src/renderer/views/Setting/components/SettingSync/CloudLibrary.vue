<template lang="pug">
dd
  div(:class="$style.cloudHeader")
    h3#cloud-library 云端曲库
    div(v-if="fromList" :class="$style.cloudHeaderActions")
      base-btn.btn(min @click="backToList") 返回列表
      button(type="button" :class="$style.cloudClose" aria-label="关闭云端曲库" title="关闭云端曲库" @click="backToList") ×
  .p.small 上传歌曲后，可在其他设备导入。S3 静态加密取决于服务商及存储桶配置；端到端口令可选。
  .p(:class="$style.row")
    span 远程服务
    base-selection(:list="providers" :model-value="config.provider" item-key="id" item-name="name" @change="changeProvider")
  .p(:class="$style.row")
    span 服务地址
    base-input(:class="$style.input" :model-value="config.endpoint" placeholder="https://..." @update:model-value="config.endpoint = $event")
  template(v-if="config.provider == 's3'")
    .p(:class="$style.row")
      span 区域
      base-input(:class="$style.input" :model-value="config.region" placeholder="us-east-1" @update:model-value="config.region = $event")
    .p(:class="$style.row")
      span 存储桶
      base-input(:class="$style.input" :model-value="config.bucket" @update:model-value="config.bucket = $event")
  .p(:class="$style.row")
    span 云端目录
    base-input(:class="$style.input" :model-value="config.prefix" placeholder="qmusic" @update:model-value="config.prefix = $event")
  .p(:class="$style.row")
    span {{ config.provider == 's3' ? 'Access Key' : '用户名' }}
    base-input(:class="$style.input" :model-value="config.accessKey" @update:model-value="config.accessKey = $event")
  .p(:class="$style.row")
    span {{ config.provider == 's3' ? 'Secret Key' : '密码' }}
    input(v-model="config.secretKey" :class="$style.secretInput" type="password" autocomplete="off" :placeholder="configured ? '已保存；留空则保持不变' : ''")
  .p
    base-btn.btn(min :disabled="busy" @click="saveConfig") 保存配置
  .p(:class="$style.row")
    span 端到端口令
    div(:class="$style.passwordField")
      input(v-model="password" :class="$style.passwordInput" :type="passwordVisible ? 'text' : 'password'" autocomplete="off" placeholder="可选；填写后两端使用相同口令")
      button(type="button" :class="$style.eyeButton" :aria-label="passwordVisible ? '隐藏口令' : '显示口令'" :title="passwordVisible ? '隐藏口令' : '显示口令'" @click="passwordVisible = !passwordVisible")
        svg-icon(:name="passwordVisible ? 'eye-off' : 'eye'")
    base-btn.btn(min :disabled="busy || password.length < 8 || password === savedPassword" @click="savePassword") 保存口令
    base-btn.btn(v-if="savedPassword" min :disabled="busy" @click="clearPassword") 清除
  .p(:class="$style.row")
    span 上传到歌单
    base-input(:class="$style.input" :model-value="uploadPlaylist" @update:model-value="uploadPlaylist = $event")
  .p.small 当前模式：{{ password ? '端到端加密' : '免口令' }}。两种模式的云端目录相互独立。
  .p
    base-btn.btn(min :disabled="busy || !canUse" @click="uploadFiles") 上传歌曲
    base-btn.btn.gap-left(min :disabled="busy || !canUse" @click="refreshTracks") 查看云端歌曲
  .p.small(v-if="status") {{ status }}
  .p(v-if="tracks.length" :class="$style.actions")
    span(:class="$style.selectionCount") 已选 {{ selectedIds.length }}/{{ tracks.length }} 首
    base-btn.btn(min :disabled="busy" @click="toggleAll") {{ selectedIds.length == tracks.length ? '取消全选' : '全选' }}
    base-btn.btn(min :disabled="busy || !selectedIds.length" @click="importSelected('playlist')") 导入歌单
    base-btn.btn.gap-left(min :disabled="busy || !selectedIds.length" @click="importSelected('songs')") 导入歌曲
    base-btn.btn.gap-left(v-if="importedListId" min @click="openImportedList") 查看导入结果
  div(v-if="tracks.length" :class="$style.trackList")
    label(v-for="track in tracks" :key="track.id" :class="$style.track")
      input(v-model="selectedIds" type="checkbox" :value="track.id")
      span {{ track.name }} · {{ track.playlist }}
</template>

<script>
import { computed, onMounted, ref } from '@common/utils/vueTools'
import { showSelectDialog, getCloudConfig, saveCloudConfig, selectCloudProvider, listCloudTracks, uploadCloudTrack, importCloudTracks, getSavedCloudPassword, saveCloudPassword } from '@renderer/utils/ipc'
import { addListMusics, createUserList } from '@renderer/store/list/action'
import { userLists } from '@renderer/store/list/state'
import { LIST_IDS } from '@common/constants'
import { useRoute, useRouter } from '@common/utils/vueRouter'

export default {
  name: 'CloudLibrary',
  setup() {
    const router = useRouter()
    const route = useRoute()
    const fromList = computed(() => route.query.section == 'cloud-library')
    const providers = [{ id: 's3', name: 'S3 / 兼容 S3' }, { id: 'webdav', name: 'WebDAV' }]
    const emptyConfig = provider => ({ provider, endpoint: '', region: 'us-east-1', bucket: '', prefix: '', accessKey: '', secretKey: '' })
    const config = ref(emptyConfig('s3'))
    const drafts = new Map()
    const configured = ref(false)
    const canUse = computed(() => configured.value)
    const password = ref('')
    const savedPassword = ref('')
    const passwordVisible = ref(false)
    const uploadPlaylist = ref('云端曲库')
    const status = ref('')
    const busy = ref(false)
    const tracks = ref([])
    const selectedIds = ref([])
    const importedListId = ref('')

    onMounted(async() => {
      const [stored, storedPassword] = await Promise.all([getCloudConfig(), getSavedCloudPassword()])
      configured.value = stored.configured
      config.value = { ...emptyConfig(stored.provider ?? 's3'), ...stored, secretKey: '' }
      password.value = storedPassword
      savedPassword.value = storedPassword
    })

    const run = async(task) => {
      if (busy.value) return
      busy.value = true
      status.value = ''
      try { await task() } catch (error) { status.value = error.message || '云端操作失败' } finally { busy.value = false }
    }

    const changeProvider = async(provider) => run(async() => {
      if (provider.id === config.value.provider) return
      drafts.set(config.value.provider, { config: { ...config.value }, configured: configured.value })
      const stored = await selectCloudProvider(provider.id)
      const draft = drafts.get(provider.id)
      config.value = draft?.config ?? { ...emptyConfig(provider.id), ...stored, secretKey: '' }
      configured.value = draft?.configured ?? stored.configured
      tracks.value = []
      selectedIds.value = []
      importedListId.value = ''
    })

    const saveConfig = async() => run(async() => {
      const result = await saveCloudConfig({ ...config.value })
      configured.value = result.configured
      config.value.secretKey = ''
      drafts.set(config.value.provider, { config: { ...config.value }, configured: configured.value })
      tracks.value = []
      selectedIds.value = []
      importedListId.value = ''
      status.value = '云端配置已保存'
    })

    const savePassword = async() => run(async() => {
      await saveCloudPassword(password.value)
      savedPassword.value = password.value
      status.value = '加密口令已保存在本机安全存储中'
    })

    const clearPassword = async() => run(async() => {
      await saveCloudPassword('')
      savedPassword.value = ''
      password.value = ''
      status.value = '已清除本机保存的加密口令'
    })

    const refreshTracks = async() => run(async() => {
      tracks.value = await listCloudTracks(password.value)
      selectedIds.value = tracks.value.map(track => track.id)
      importedListId.value = ''
      status.value = `云端共有 ${tracks.value.length} 首歌曲`
    })

    const toggleAll = () => { selectedIds.value = selectedIds.value.length == tracks.value.length ? [] : tracks.value.map(track => track.id) }

    const uploadFiles = async() => run(async() => {
      await listCloudTracks(password.value)
      const result = await showSelectDialog({
        title: '选择要上传的歌曲',
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Audio', extensions: ['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg', 'ape'] }],
      })
      if (result.canceled || !result.filePaths.length) return
      const metadata = await window.lx.worker.main.createLocalMusicInfos(result.filePaths)
      const byPath = new Map(metadata.map(info => [info.meta.filePath, info]))
      for (let index = 0; index < result.filePaths.length; index++) {
        status.value = `正在上传 ${index + 1}/${result.filePaths.length}`
        const source = result.filePaths[index]
        const info = byPath.get(source)
        await uploadCloudTrack(source, password.value, uploadPlaylist.value, info?.name ?? '', info?.singer ?? '')
      }
      status.value = `已上传 ${result.filePaths.length} 首歌曲`
    })

    const importSelected = async(mode) => run(async() => {
      if (!selectedIds.value.length) return
      importedListId.value = ''
      status.value = password.value ? '正在下载并解密歌曲…' : '正在下载歌曲…'
      const downloaded = await importCloudTracks([...selectedIds.value], password.value)
      if (!downloaded.length) throw new Error('没有找到选中的云端歌曲，请刷新列表后重试')
      const parsed = await window.lx.worker.main.createLocalMusicInfos(downloaded.map(track => track.filePath))
      const byPath = new Map(parsed.map(info => [info.meta.filePath, info]))
      const infos = downloaded.map(track => byPath.get(track.filePath) ?? {
        id: track.filePath,
        name: track.name,
        singer: track.singer,
        source: 'local',
        interval: '',
        meta: { albumName: '', filePath: track.filePath, songId: track.filePath, picUrl: '', ext: track.fileName.split('.').at(-1) ?? '' },
      })
      let resultListId = LIST_IDS.DEFAULT
      if (mode == 'songs') await addListMusics(LIST_IDS.DEFAULT, infos)
      else {
        for (const [index, name] of [...new Set(downloaded.map(track => track.playlist))].entries()) {
          const paths = new Set(downloaded.filter(track => track.playlist == name).map(track => track.filePath))
          const list = infos.filter(info => paths.has(info.meta.filePath))
          const existing = userLists.find(item => item.name == name)
          const id = existing?.id ?? `userlist_${Date.now()}_${index}`
          if (existing) await addListMusics(id, list)
          else await createUserList({ name, id, list })
          if (index == 0) resultListId = id
        }
      }
      importedListId.value = resultListId
      status.value = `已导入 ${infos.length} 首歌曲到${mode == 'songs' ? '默认列表' : '歌单'}`
    })

    const backToList = () => { void router.push({ path: '/list' }) }
    const openImportedList = () => { void router.push({ path: '/list', query: { id: importedListId.value, from: 'cloud-library' } }) }

    return { providers, config, configured, canUse, fromList, password, savedPassword, passwordVisible, uploadPlaylist, status, busy, tracks, selectedIds, importedListId, changeProvider, saveConfig, savePassword, clearPassword, refreshTracks, toggleAll, uploadFiles, importSelected, backToList, openImportedList }
  },
}
</script>

<style lang="less" module>
.cloudHeader { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.cloudHeader h3 { margin: 0; }
.cloudHeaderActions { display: flex; align-items: center; gap: 6px; }
.cloudClose { width: 32px; height: 32px; border: 0; border-radius: 6px; background: transparent; color: var(--color-button-font); font-size: 22px; line-height: 1; cursor: pointer; }
.cloudClose:hover, .cloudClose:focus-visible { background: var(--color-primary-background-hover); }
.row { display: flex; align-items: center; gap: 14px; max-width: 650px; margin: 10px 0; }
.row > span { width: 90px; flex: none; }
.input, .secretInput { width: min(100%, 430px); }
.secretInput { box-sizing: border-box; padding: 7px 9px; border: 1px solid var(--color-border); border-radius: 4px; background: transparent; color: inherit; }
.passwordField { display: flex; align-items: center; width: min(100%, 350px); border: 1px solid var(--color-border); border-radius: 4px; }
.passwordInput { min-width: 0; flex: 1; padding: 7px 9px; border: 0; outline: 0; background: transparent; color: inherit; }
.eyeButton { display: grid; place-items: center; width: 32px; height: 32px; flex: none; border: 0; background: transparent; color: inherit; cursor: pointer; opacity: .7; }
.eyeButton:hover, .eyeButton:focus-visible { opacity: 1; }
.actions { margin-top: 14px; }
.selectionCount { display: inline-flex; align-items: center; margin-right: 10px; color: var(--color-button-font); font-size: 12px; }
.trackList { max-height: 240px; overflow: auto; max-width: 650px; }
.track { display: flex; align-items: center; gap: 9px; padding: 7px 3px; }
</style>
