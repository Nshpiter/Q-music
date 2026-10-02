<template lang="pug">
dd
  div(:class="$style.cloudHeader")
    h3#cloud-library 云端曲库
    div(v-if="fromList" :class="$style.cloudHeaderActions")
      base-btn.btn(min @click="backToList") 返回列表
      button(type="button" :class="$style.cloudClose" aria-label="关闭云端曲库" title="关闭云端曲库" @click="backToList") ×
  .p.small 上传本地歌曲，在其他设备按歌单或歌曲导入。
  button(type="button" :class="$style.configToggle" :aria-expanded="showConfig" @click="showConfig = !showConfig")
    span {{ config.provider == 's3' ? 'S3 / 兼容 S3' : 'WebDAV' }} · {{ hasConfigChanges ? '有修改待保存' : configured ? '已保存连接' : '请设置连接' }}
    span {{ showConfig ? '收起设置' : '编辑连接' }}
  fieldset(v-show="showConfig" :disabled="busy" :class="$style.configForm")
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
      div(:class="$style.passwordField")
        input(v-model="config.secretKey" :class="$style.passwordInput" :type="secretVisible ? 'text' : 'password'" autocomplete="off" :placeholder="configured ? '已保存；留空则保持不变' : ''")
        button(type="button" :class="$style.eyeButton" :aria-label="secretVisible ? '隐藏密钥' : '显示密钥'" @click="secretVisible = !secretVisible")
          svg-icon(:name="secretVisible ? 'eye-off' : 'eye'")
    .p
      base-btn.btn(min :disabled="busy" @click="saveConfig") 保存配置
  .p(:class="$style.row")
    span 端到端口令
    div(:class="$style.passwordField")
      input(v-model="password" :disabled="busy" :class="$style.passwordInput" :type="passwordVisible ? 'text' : 'password'" autocomplete="off" placeholder="可选，至少 8 个字符；两端保持相同" @input="resetTracks")
      button(type="button" :class="$style.eyeButton" :aria-label="passwordVisible ? '隐藏口令' : '显示口令'" :title="passwordVisible ? '隐藏口令' : '显示口令'" @click="passwordVisible = !passwordVisible")
        svg-icon(:name="passwordVisible ? 'eye-off' : 'eye'")
    base-btn.btn(min :disabled="busy || password.length < 8 || password === savedPassword" @click="savePassword") 保存口令
    base-btn.btn(v-if="savedPassword" min :disabled="busy" @click="clearPassword") 清除
  .p(:class="$style.row")
    span 上传到歌单
    base-input(:disabled="busy" :class="$style.input" :model-value="uploadPlaylist" @update:model-value="uploadPlaylist = $event")
  .p.small 当前模式：{{ password ? '端到端加密' : '免口令' }}。两种模式的云端目录相互独立。
  .p
    base-btn.btn(min :disabled="busy || !canUse" @click="uploadFiles") 上传歌曲
    base-btn.btn.gap-left(min :disabled="busy || !canUse" @click="refreshTracks") {{ loaded ? '刷新云端歌曲' : '连接并查看歌曲' }}
  .p.small(v-if="hasConfigChanges" :class="$style.hint") 请先保存连接设置，再查看或上传歌曲。
  .p.small(v-if="status" :class="[$style.status, statusKind == 'error' ? $style.error : null]" :role="statusKind == 'error' ? 'alert' : 'status'" aria-live="polite") {{ status }}
  .p(v-if="tracks.length" :class="$style.searchRow")
    base-input(:model-value="query" placeholder="搜索歌曲、歌手或歌单" aria-label="搜索云端歌曲" @update:model-value="query = $event")
  .p(v-if="tracks.length" :class="$style.actions")
    span(:class="$style.selectionCount") 已选 {{ selectedIds.length }}/{{ tracks.length }} 首
    base-btn.btn(min :disabled="busy || !visibleTracks.length" @click="toggleAll") {{ allVisibleSelected ? '取消当前选择' : query ? '选中搜索结果' : '全选' }}
    base-btn.btn(min :disabled="busy || !canUse || !selectedIds.length" @click="importSelected('playlist')") 导入歌单
    base-btn.btn.gap-left(min :disabled="busy || !canUse || !selectedIds.length" @click="importSelected('songs')") 导入歌曲
    base-btn.btn.gap-left(v-if="importedListId" min @click="openImportedList") 查看导入结果
  div(v-if="tracks.length" :class="$style.trackList")
    label(v-for="track in visibleTracks" :key="track.id" :class="[$style.track, selectedIds.includes(track.id) ? $style.selectedTrack : null]")
      input(v-model="selectedIds" type="checkbox" :value="track.id" :disabled="busy" :aria-label="`选择 ${track.name}`")
      span(:class="$style.trackInfo")
        strong {{ track.name }}
        small {{ [track.singer, track.playlist].filter(Boolean).join(' · ') }}
    .p.small(v-if="!visibleTracks.length" :class="$style.empty") 没有匹配的歌曲，试试其他关键词。
  .p.small(v-else-if="loaded && !busy" :class="$style.empty") 云端还没有歌曲。上传本地歌曲后，便可在其他设备导入。
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
    const savedConfig = ref(emptyConfig('s3'))
    const showConfig = ref(true)
    const secretVisible = ref(false)
    const drafts = new Map()
    const configured = ref(false)
    const hasConfigChanges = computed(() => Object.keys(savedConfig.value).some(key => config.value[key] !== savedConfig.value[key]))
    const canUse = computed(() => configured.value && !hasConfigChanges.value)
    const password = ref('')
    const savedPassword = ref('')
    const passwordVisible = ref(false)
    const uploadPlaylist = ref('云端曲库')
    const status = ref('')
    const statusKind = ref('info')
    const busy = ref(false)
    const loaded = ref(false)
    const query = ref('')
    const tracks = ref([])
    const selectedIds = ref([])
    const importedListId = ref('')
    const visibleTracks = computed(() => {
      const keyword = query.value.trim().toLocaleLowerCase()
      return keyword ? tracks.value.filter(track => [track.name, track.singer, track.playlist].join(' ').toLocaleLowerCase().includes(keyword)) : tracks.value
    })
    const allVisibleSelected = computed(() => visibleTracks.value.length > 0 && visibleTracks.value.every(track => selectedIds.value.includes(track.id)))

    const resetTracks = () => {
      tracks.value = []
      selectedIds.value = []
      importedListId.value = ''
      loaded.value = false
      query.value = ''
      status.value = ''
      statusKind.value = 'info'
    }

    onMounted(async() => {
      await run(async() => {
        const [stored, storedPassword] = await Promise.all([getCloudConfig(), getSavedCloudPassword()])
        configured.value = stored.configured
        const values = emptyConfig(stored.provider ?? 's3')
        for (const key of Object.keys(values)) values[key] = stored[key] ?? values[key]
        values.secretKey = ''
        config.value = { ...values }
        savedConfig.value = values
        showConfig.value = !stored.configured
        password.value = storedPassword
        savedPassword.value = storedPassword
      })
    })

    const run = async(task, message = '') => {
      if (busy.value) return
      busy.value = true
      status.value = message
      statusKind.value = 'info'
      try { await task() } catch (error) {
        statusKind.value = 'error'
        status.value = error.message || '云端操作失败，请重试'
      } finally { busy.value = false }
    }

    const changeProvider = async(provider) => run(async() => {
      if (provider.id === config.value.provider) return
      drafts.set(config.value.provider, { config: { ...config.value }, configured: configured.value })
      const stored = await selectCloudProvider(provider.id)
      const draft = drafts.get(provider.id)
      const values = emptyConfig(provider.id)
      for (const key of Object.keys(values)) values[key] = stored[key] ?? values[key]
      values.secretKey = ''
      savedConfig.value = values
      config.value = draft?.config ?? { ...values }
      configured.value = draft?.configured ?? stored.configured
      secretVisible.value = false
      resetTracks()
    })

    const saveConfig = async() => run(async() => {
      const result = await saveCloudConfig({ ...config.value })
      configured.value = result.configured
      config.value.secretKey = ''
      savedConfig.value = { ...config.value }
      showConfig.value = false
      secretVisible.value = false
      drafts.set(config.value.provider, { config: { ...config.value }, configured: configured.value })
      resetTracks()
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
      resetTracks()
      status.value = '已清除本机保存的加密口令'
    })

    const refreshTracks = async() => run(async() => {
      tracks.value = await listCloudTracks(password.value)
      const ids = new Set(tracks.value.map(track => track.id))
      selectedIds.value = selectedIds.value.filter(id => ids.has(id))
      loaded.value = true
      status.value = `连接成功，云端共有 ${tracks.value.length} 首歌曲`
    }, '正在连接并加载云端歌曲…')

    const toggleAll = () => {
      const visibleIds = new Set(visibleTracks.value.map(track => track.id))
      selectedIds.value = allVisibleSelected.value
        ? selectedIds.value.filter(id => !visibleIds.has(id))
        : [...new Set([...selectedIds.value, ...visibleIds])]
    }

    const uploadFiles = async() => run(async() => {
      const result = await showSelectDialog({
        title: '选择要上传的歌曲',
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Audio', extensions: ['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg', 'ape'] }],
      })
      if (result.canceled || !result.filePaths.length) return
      tracks.value = await listCloudTracks(password.value)
      const ids = new Set(tracks.value.map(track => track.id))
      selectedIds.value = selectedIds.value.filter(id => ids.has(id))
      loaded.value = true
      const metadata = await window.lx.worker.main.createLocalMusicInfos(result.filePaths)
      const byPath = new Map(metadata.map(info => [info.meta.filePath, info]))
      for (let index = 0; index < result.filePaths.length; index++) {
        status.value = `正在上传 ${index + 1}/${result.filePaths.length}`
        const source = result.filePaths[index]
        const info = byPath.get(source)
        const uploaded = await uploadCloudTrack(source, password.value, uploadPlaylist.value, info?.name ?? '', info?.singer ?? '')
        tracks.value = [...tracks.value.filter(track => track.id != uploaded.id), uploaded]
      }
      status.value = `已上传 ${result.filePaths.length} 首歌曲`
      query.value = ''
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

    return { providers, config, configured, canUse, fromList, password, savedPassword, passwordVisible, uploadPlaylist, status, statusKind, busy, loaded, tracks, visibleTracks, query, allVisibleSelected, showConfig, secretVisible, hasConfigChanges, selectedIds, importedListId, resetTracks, changeProvider, saveConfig, savePassword, clearPassword, refreshTracks, toggleAll, uploadFiles, importSelected, backToList, openImportedList }
  },
}
</script>

<style lang="less" module>
.cloudHeader { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.cloudHeader h3 { margin: 0; }
.cloudHeaderActions { display: flex; align-items: center; gap: 6px; }
.cloudClose { width: 32px; height: 32px; border: 0; border-radius: 6px; background: transparent; color: var(--color-button-font); font-size: 22px; line-height: 1; cursor: pointer; }
.cloudClose:hover, .cloudClose:focus-visible { background: var(--color-primary-background-hover); }
.configToggle { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; max-width: 650px; padding: 14px; margin: 14px 0; border: 1px solid var(--color-primary-alpha-800); border-radius: 12px; background: var(--color-button-background); color: var(--color-button-font); cursor: pointer; text-align: left; }
.configToggle:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.configForm { min-width: 0; max-width: 650px; margin: 0 0 16px; padding: 0; border: 0; }
.row { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; max-width: 650px; margin: 12px 0; }
.row > span { width: 90px; flex: none; }
.input { min-width: 0; flex: 1 1 180px; max-width: 430px; }
.passwordField { display: flex; align-items: center; min-width: 0; flex: 1 1 180px; max-width: 350px; border: 1px solid var(--color-primary-alpha-800); border-radius: 10px; background: var(--color-button-background); }
.passwordInput { min-width: 0; flex: 1; padding: 7px 9px; border: 0; outline: 0; background: transparent; color: inherit; }
.eyeButton { display: grid; place-items: center; width: 32px; height: 32px; flex: none; border: 0; background: transparent; color: inherit; cursor: pointer; opacity: .7; }
.eyeButton:hover, .eyeButton:focus-visible { opacity: 1; }
.actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.actions :global(.gap-left) { margin-left: 0; }
.searchRow { max-width: 650px; }
.searchRow > input { box-sizing: border-box; width: 100%; }
.hint { color: var(--color-button-font); }
.status { max-width: 650px; padding: 12px 14px; box-sizing: border-box; border-radius: 10px; background: var(--color-primary-background-hover); overflow-wrap: anywhere; }
.error { border-left: 3px solid #d45757; }
.selectionCount { display: inline-flex; align-items: center; margin-right: 10px; color: var(--color-button-font); font-size: 12px; }
.trackList { max-height: 320px; overflow: auto; max-width: 650px; border-radius: 12px; background: var(--color-button-background); padding: 4px; }
.track { display: flex; align-items: center; gap: 12px; padding: 12px; min-height: 30px; border-radius: 8px; cursor: pointer; }
.track:hover, .track:focus-within, .selectedTrack { background: var(--color-primary-background-hover); }
.track input { accent-color: var(--color-primary); flex: none; }
.trackInfo { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.trackInfo strong { font-size: 13px; line-height: 1.4; overflow-wrap: anywhere; }
.trackInfo small { font-size: 12px; line-height: 1.4; opacity: .7; overflow-wrap: anywhere; }
.empty { padding: 20px 14px; text-align: center; line-height: 1.7; }
</style>
