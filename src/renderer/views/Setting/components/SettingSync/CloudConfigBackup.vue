<template>
  <section :class="$style.card">
    <h3>配置备份与恢复</h3>
    <p>使用上方已保存的远程连接。手机、平板、车机与 PC 可共用备份，上传后在另一设备手动恢复。</p>
    <div :class="$style.row">
      <label v-for="item in choices" :key="item.key"><input v-model="selected[item.key]" type="checkbox" :disabled="working">{{ item.name }}</label>
    </div>
    <p>只恢复兼容的通用偏好；音源按内容合并。账号默认不备份，恢复后仍可能需要重新登录或验证。</p>
    <div :class="$style.row">
      <input v-model="password" :class="$style.key" :type="showKey ? 'text' : 'password'" :disabled="working" autocomplete="off" placeholder="配置备份密钥（至少 8 位）" aria-label="配置备份密钥" @input="preview = null">
      <base-btn min :disabled="working" @click="showKey = !showKey">{{ showKey ? '隐藏' : '显示' }}</base-btn>
      <base-btn min :disabled="working" @click="generate">生成密钥</base-btn>
      <base-btn min :disabled="!password || working" @click="copyKey">复制密钥</base-btn>
    </div>
    <p>配置备份始终加密。请保存密钥，并在其他设备填写同一密钥；本功能不会更改云端歌曲的加密方式。</p>
    <div :class="$style.row">
      <base-btn min :disabled="blocked || password.length &lt; 8 || !anySelected" @click="upload">上传配置备份</base-btn>
      <base-btn min :disabled="blocked" @click="refresh">查看云端备份</base-btn>
    </div>
    <p v-if="disabled && !working">请先保存上方的远程连接。</p>
    <div v-if="files.length" :class="$style.row">
      <select v-model="file" :disabled="working" aria-label="选择配置备份" @change="preview = null"><option v-for="id in files" :key="id" :value="id">{{ date(Number(id.slice(0, 13))) }} · {{ id.slice(14, 20) }}</option></select>
      <base-btn min :disabled="blocked || !file || password.length &lt; 8" @click="inspect">预览备份</base-btn>
    </div>
    <div v-if="preview" :class="$style.preview">
      <strong>{{ preview.platform == 'android' ? '安卓' : 'PC' }} · {{ date(preview.createdAt) }}</strong>
      <p>兼容设置 {{ preview.settings }} 项；音源 {{ preview.sources.length }} 个；账号 {{ preview.accounts.map(id => names[id]).join('、') || '无' }}。</p>
      <p v-if="preview.sources.length">音源：{{ preview.sources.join('、') }}</p>
      <base-btn min :disabled="blocked || !anySelected" @click="restore">恢复勾选的内容</base-btn>
    </div>
    <p v-if="status" role="status" aria-live="polite">{{ status }}</p>
  </section>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { dialog } from '@renderer/plugins/Dialog'
import { generateCloudBackupKey, listCloudBackups, uploadCloudBackup, previewCloudBackup, restoreCloudBackup, getUserApiList } from '@renderer/utils/ipc'
import { userApi } from '@renderer/store'
const props = defineProps({ disabled: Boolean, connection: { type: String, default: '' } })
const emit = defineEmits(['busy'])
const selected = ref({ settings: true, sources: true, accounts: false })
const choices = [{ key: 'settings', name: '通用设置' }, { key: 'sources', name: '音源与主备顺序' }, { key: 'accounts', name: '账号登录状态' }]
const names = { tx: 'QQ 音乐', wy: '网易云音乐', kg: '酷狗音乐' }
const password = ref(''); const showKey = ref(false); const working = ref(false); const status = ref(''); const files = ref([]); const file = ref(''); const preview = ref(null)
const blocked = computed(() => working.value || props.disabled)
const anySelected = computed(() => Object.values(selected.value).some(Boolean))
const date = value => new Date(value).toLocaleString()
watch(() => props.connection, () => { files.value = []; file.value = ''; preview.value = null; status.value = '' })
const run = async task => { if (working.value) return; working.value = true; emit('busy', true); status.value = ''; try { await task() } catch (error) { status.value = error.message || '操作失败，请重试' } finally { working.value = false; emit('busy', false) } }
const generate = async() => run(async() => { password.value = await generateCloudBackupKey(); showKey.value = true; preview.value = null; status.value = '密钥已生成，请复制保存。' })
const copyKey = async() => run(async() => { await navigator.clipboard.writeText(password.value); status.value = '密钥已复制，请妥善保存。' })
const refresh = async() => run(async() => { files.value = await listCloudBackups(); file.value = files.value[0] ?? ''; preview.value = null; status.value = files.value.length ? `找到 ${files.value.length} 份备份（最多显示最近 50 份）` : '还没有配置备份，可以先在已有音源的设备上传。' })
const upload = async() => run(async() => {
  if (!await dialog.confirm({ message: `上传勾选的${selected.value.accounts ? '设置、音源及账号登录状态' : '配置内容'}到你配置的远程存储？每次上传会新建一份加密备份。`, confirmButtonText: '上传备份', cancelButtonText: '取消' })) return
  const id = await uploadCloudBackup(password.value, { ...selected.value })
  files.value = [id, ...files.value.filter(item => item != id)].slice(0, 50); file.value = id; preview.value = null
  status.value = '备份上传成功。另一设备使用相同连接和密钥即可预览恢复。'
})
const inspect = async() => run(async() => { preview.value = null; preview.value = await previewCloudBackup(file.value, password.value) })
const restore = async() => run(async() => {
  if (!preview.value || !await dialog.confirm({ message: '恢复勾选的内容？兼容设置将覆盖本机对应项，音源合并且不删除已有音源；勾选账号会替换备份包含的平台登录状态。', confirmButtonText: '恢复', cancelButtonText: '取消' })) return
  const token = preview.value.token; preview.value = null
  await restoreCloudBackup(token, { ...selected.value })
  userApi.list = await getUserApiList()
  status.value = '恢复完成。请重启应用以刷新音源与账号状态；过期账号需重新登录。'
})
</script>
<style lang="less" module>
.card { max-width: 650px; margin: 22px 0; padding: 18px; border: 1px solid var(--q-outline); border-radius: 14px; background: var(--q-surface); }
.card h3 { font-size: 15px; margin-bottom: 10px; }
.card p { font-size: 12px; line-height: 1.7; color: var(--color-font-label); margin: 10px 0; overflow-wrap: anywhere; }
.row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin: 12px 0; }
.row label { display: flex; gap: 6px; align-items: center; font-size: 13px; }
.row input[type=checkbox] { accent-color: var(--color-primary); }
.key, .row select { min-width: 0; flex: 1 1 200px; padding: 9px 10px; border-radius: 8px; border: 1px solid var(--q-outline); background: var(--color-content-background); color: var(--color-font); }
.preview { border-top: 1px solid var(--q-outline); padding-top: 14px; font-size: 13px; }
</style>
