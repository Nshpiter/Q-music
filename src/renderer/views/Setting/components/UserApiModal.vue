<template lang="pug">
material-modal(:show="modelValue" bg-close teleport="#root" width="min(620px, calc(100vw - 32px))" max-width="calc(100vw - 32px)" height="min(660px, calc(100vh - 48px))" max-height="calc(100vh - 48px)" @close="handleClose")
  main(:class="$style.main")
    h2 {{ $t('user_api__title') }}
    div(v-if="apiList.length" :class="$style.toolbar")
      div(:class="$style.modeOptions")
        base-checkbox(v-for="mode in ['play', 'quality']" :id="`user-api-mode-${mode}`" :key="mode" name="user-api-mode" need :value="mode" :model-value="appSetting['common.apiPreferQuality'] ? 'quality' : 'play'" :label="$t(`user_api_${mode}_first`)" @update:model-value="setMode")
      div(:class="$style.updateAllRow")
        base-btn(outline :disabled="isUpdatingAll" @click="handleUpdateAll") {{ isUpdatingAll ? $t('user_api__btn_updating') : $t('user_api__btn_update_all') }}
        span(v-if="updateSummaryText" :class="$style.updateSummary") {{ updateSummaryText }}
    p(:class="$style.backupHint") {{ $t(appSetting['common.apiPreferQuality'] ? 'user_api_quality_hint' : 'user_api_backup_hint') }}
    ul.scroll(v-if="apiList.length" :class="$style.content")
      li(v-for="(api, index) in apiList" :key="api.id" :class="[$style.listItem, {[$style.active]: appSetting['common.apiSource'] == api.id}]")
        div(:class="$style.listLeft")
          h3
            | {{ api.name }}
            span(v-if="api.version") {{ /^\d/.test(api.version) ? `v${api.version}` : api.version }}
            span(v-if="api.author") {{ api.author }}
          p {{ api.description }}
          div(:class="$style.sourceUrlSection")
            div(v-if="editingUrlId !== api.id" :class="$style.sourceUrlRow")
              span(:class="$style.sourceUrlLabel") {{ $t('user_api__source_url_label') }}
              span(:class="[$style.sourceUrlText, { [$style.muted]: !api.sourceUrl }]") {{ api.sourceUrl || $t('user_api__source_url_empty') }}
              base-btn(outline :class="$style.compactBtn" @click="startEditUrl(api)") {{ $t('user_api__source_url_edit') }}
            div(v-else :class="$style.sourceUrlEditRow")
              base-input(v-model="editingUrlText" :class="$style.urlInput" type="url" :placeholder="$t('user_api__source_url_placeholder')" @submit="saveSourceUrl(api)")
              base-btn(outline :class="$style.compactBtn" @click="saveSourceUrl(api)") {{ $t('user_api__source_url_save') }}
              base-btn(outline :class="$style.compactBtn" @click="cancelEditUrl") {{ $t('user_api__source_url_cancel') }}
          div(:class="$style.sourceOptions")
            span(v-if="appSetting['common.apiSource'] == api.id" :class="$style.primaryBadge") {{ $t('user_api_primary') }}
            base-checkbox(v-else :id="`user_api_backup_${api.id}`" :model-value="backupIds.includes(api.id)" :class="$style.checkbox" :label="$t('user_api_backup')" @update:model-value="handleBackup(api.id, $event)")
            div(v-if="backupIds.includes(api.id) && appSetting['common.apiSource'] != api.id" :class="$style.backupOrder")
              span {{ $t('user_api_backup_priority', { order: backupIds.indexOf(api.id) + 1 }) }}
              base-btn(outline :disabled="backupIds.indexOf(api.id) == 0" @click="moveBackup(api.id, -1)") {{ $t('user_api_backup_up') }}
              base-btn(outline :disabled="backupIds.indexOf(api.id) == backupIds.length - 1" @click="moveBackup(api.id, 1)") {{ $t('user_api_backup_down') }}
            div(:class="$style.updateActionRow")
              base-checkbox(:id="`user_api_${api.id}`" :model-value="api.allowShowUpdateAlert" :class="$style.checkbox" :label="$t('user_api__allow_show_update_alert')" @update:model-value="handleChangeAllowUpdateAlert(api, $event)")
              base-checkbox(:id="`user_api_auto_update_${api.id}`" :model-value="Boolean(api.autoUpdate)" :class="$style.checkbox" :label="$t('user_api__auto_update')" @update:model-value="handleChangeAutoUpdate(api, $event)")
              base-btn(outline :class="$style.compactBtn" :disabled="Boolean(updatingIds[api.id]) || isUpdatingAll" @click="handleUpdateOne(api)") {{ updatingIds[api.id] ? $t('user_api__btn_updating') : $t('user_api__btn_update') }}
              span(v-if="updateStatuses[api.id]" :class="[$style.statusBadge, $style[`status_${updateStatuses[api.id].status}`]]") {{ formatStatusText(updateStatuses[api.id]) }}
        base-btn(:class="$style.listBtn" outline :aria-label="$t('user_api__btn_remove')" @click.stop="handleRemove(index)")
          svg(v-once version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 212.982 212.982" space="preserve")
            use(xlink:href="#icon-delete")
    div(v-else :class="$style.content")
      div(:class="$style.noitem") {{ $t('user_api__noitem') }}
    div(:class="$style.note")
      p(:class="[$style.ruleLink]")
        | {{ $t('user_api__readme') }}
        span.hover.underline(aria-label="https://lxmusic.toside.cn/desktop/custom-source" @click="handleOpenUrl('https://lyswhut.github.io/lx-music-doc/desktop/custom-source')") FAQ
      p {{ $t('user_api__note') }}
    div(:class="$style.footer")
      base-btn(:class="$style.footerBtn" @click="isShowOnlineImportModal = true") {{ $t('user_api__btn_import_online') }}
      base-btn(:class="$style.footerBtn" @click="handleImport") {{ $t('user_api__btn_import') }}
      //- base-btn(:class="$style.footerBtn" @click="handleExport") {{ $t('user_api__btn_export') }}
    UserApiOnlineImportModal(v-model:show="isShowOnlineImportModal" @import="importUserApi")
</template>

<script>
import {
  importUserApi,
  removeUserApi,
  replaceUserApiScript,
  setUserApiSourceUrl,
  setUserApiAutoUpdate,
  showSelectDialog,
  setAllowShowUserApiUpdateAlert,
} from '@renderer/utils/ipc'
import { readFile } from '@common/utils/nodejs'
import { openUrl } from '@common/utils/electron'
import { httpFetch } from '@renderer/utils/request'
import { normalizeUserApiUrl, runUserApiUpdates } from '@common/utils/userApiImport'
import apiSourceInfo from '@renderer/utils/musicSdk/api-source-info'
import { userApi } from '@renderer/store'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { computed, ref } from '@common/utils/vueTools'
import { dialog } from '@renderer/plugins/Dialog'

import UserApiOnlineImportModal from './UserApiOnlineImportModal.vue'

export default {
  components: {
    UserApiOnlineImportModal,
  },
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue'],
  setup() {
    const isShowOnlineImportModal = ref(false)
    const editingUrlId = ref('')
    const editingUrlText = ref('')
    const updatingIds = ref({})
    const isUpdatingAll = ref(false)
    const updateStatuses = ref({})
    const updateSummary = ref(null)
    const apiList = computed(() => {
      const order = [...new Set([appSetting['common.apiSource'], ...appSetting['common.apiBackupSources']])]
      const rank = id => order.includes(id) ? order.indexOf(id) : order.length
      return [...userApi.list].sort((a, b) => rank(a.id) - rank(b.id))
    })

    return {
      userApi,
      apiList,
      backupIds: computed(() => appSetting['common.apiBackupSources'].filter(id => id != appSetting['common.apiSource'] && userApi.list.some(api => api.id == id))),
      appSetting,
      isShowOnlineImportModal,
      editingUrlId,
      editingUrlText,
      updatingIds,
      isUpdatingAll,
      updateStatuses,
      updateSummary,
    }
  },
  computed: {
    updateSummaryText() {
      if (!this.updateSummary) return ''
      return this.$t('user_api__update_all_summary', this.updateSummary)
    },
  },
  watch: {
    modelValue(show) {
      if (!show) {
        this.isShowOnlineImportModal = false
        this.cancelEditUrl()
      }
    },
  },
  methods: {
    setMode(mode) {
      updateSetting({ 'common.apiPreferQuality': mode == 'quality' })
    },
    handleBackup(id, enabled) {
      updateSetting({ 'common.apiBackupSources': enabled ? [...new Set([...this.backupIds, id])] : this.backupIds.filter(value => value != id) })
    },
    moveBackup(id, offset) {
      const ids = [...this.backupIds]
      const index = ids.indexOf(id)
      const next = index + offset
      if (index < 0 || next < 0 || next >= ids.length) return
      ;[ids[index], ids[next]] = [ids[next], ids[index]]
      updateSetting({ 'common.apiBackupSources': ids })
    },
    async importUserApi(payload) {
      return importUserApi(payload).then(({ apiList }) => {
        userApi.list = apiList
      }).catch((err) => {
        void dialog(this.$t('user_api_import__failed', { message: err.message }))
      })
    },
    startEditUrl(api) {
      this.editingUrlId = api.id
      this.editingUrlText = api.sourceUrl || ''
    },
    cancelEditUrl() {
      this.editingUrlId = ''
      this.editingUrlText = ''
    },
    async saveSourceUrl(api) {
      const trimmed = this.editingUrlText.trim()
      try {
        const nextUrl = trimmed ? normalizeUserApiUrl(trimmed) : ''
        userApi.list = await setUserApiSourceUrl({ id: api.id, sourceUrl: nextUrl })
        if (this.updateStatuses[api.id]?.status === 'skipped' || this.updateStatuses[api.id]?.status === 'failed') {
          const { [api.id]: _removed, ...restStatuses } = this.updateStatuses
          this.updateStatuses = restStatuses
        }
        this.cancelEditUrl()
      } catch (err) {
        void dialog(err.message)
      }
    },
    async handleChangeAutoUpdate(api, enable) {
      try {
        userApi.list = await setUserApiAutoUpdate({ id: api.id, enable })
      } catch (err) {
        void dialog(err.message)
      }
    },
    formatStatusText(itemResult) {
      switch (itemResult.status) {
        case 'updated': return this.$t('user_api__status_updated')
        case 'unchanged': return this.$t('user_api__status_unchanged')
        case 'skipped': return this.$t('user_api__status_skipped')
        case 'failed': return this.$t('user_api__status_failed', { message: itemResult.message || '' })
        default: return ''
      }
    },
    async runUpdatesForTargets(targets) {
      return runUserApiUpdates({
        apis: targets,
        fetchScript: url => httpFetch(url, { follow_max: 3 }),
        replaceScript: async(id, script) => {
          const result = await replaceUserApiScript({ id, script })
          userApi.list = result.apiList
          return { changed: result.changed, apiInfo: result.apiInfo }
        },
      })
    },
    async handleUpdateOne(api) {
      if (this.updatingIds[api.id] || this.isUpdatingAll) return
      if (!api.sourceUrl?.trim()) {
        this.updateStatuses = {
          ...this.updateStatuses,
          [api.id]: { id: api.id, name: api.name, status: 'failed', message: this.$t('user_api__update_no_url') },
        }
        return
      }
      this.updatingIds = { ...this.updatingIds, [api.id]: true }
      this.updateSummary = null
      try {
        const { results } = await this.runUpdatesForTargets([api])
        if (results[0]) {
          this.updateStatuses = { ...this.updateStatuses, [api.id]: results[0] }
        }
      } finally {
        const { [api.id]: _done, ...restUpdating } = this.updatingIds
        this.updatingIds = restUpdating
      }
    },
    async handleUpdateAll() {
      if (this.isUpdatingAll || !this.apiList.length) return
      this.isUpdatingAll = true
      const nextUpdating = { ...this.updatingIds }
      for (const api of this.apiList) nextUpdating[api.id] = true
      this.updatingIds = nextUpdating
      try {
        const { results, summary } = await this.runUpdatesForTargets(this.apiList)
        const nextStatuses = { ...this.updateStatuses }
        for (const item of results) {
          nextStatuses[item.id] = item
        }
        this.updateStatuses = nextStatuses
        this.updateSummary = summary
      } finally {
        this.updatingIds = {}
        this.isUpdatingAll = false
      }
    },
    handleImport() {
      if (this.userApi.list.length > 20) {
        this.$dialog({
          message: this.$t('user_api__max_tip'),
          confirmButtonText: this.$t('ok'),
        })
        return
      }
      void showSelectDialog({
        title: this.$t('user_api__import_file'),
        properties: ['openFile'],
        filters: [
          { name: 'LX API File', extensions: ['js'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      }).then(async result => {
        if (result.canceled) return
        return readFile(result.filePaths[0]).then(async data => {
          return this.importUserApi(data.toString())
        })
      })
    },
    handleExport() {

    },
    async handleRemove(index) {
      const api = this.apiList[index]
      if (!api) return
      if (appSetting['common.apiSource'] == api.id) {
        const backApiId = this.backupIds[0] ?? apiSourceInfo.find(api => !api.disabled)?.id ?? userApi.list.find(item => item.id != api.id)?.id ?? ''
        updateSetting({ 'common.apiSource': backApiId })
      }
      userApi.list = await removeUserApi([api.id])
      this.handleBackup(api.id, false)
    },
    handleClose() {
      this.$emit('update:modelValue', false)
    },
    handleOpenUrl(url) {
      void openUrl(url)
    },
    handleChangeAllowUpdateAlert(api, enable) {
      void setAllowShowUserApiUpdateAlert(api.id, enable)
    },
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.main {
  padding: 10px 16px 18px;
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-flow: column nowrap;
  min-height: 0;
  h2 {
    flex-shrink: 0;
    font-size: 16px;
    color: var(--color-font);
    line-height: 1.3;
    text-align: center;
  }
}

.name {
  color: var(--color-primary);
}
.toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 7px 0;
  flex-shrink: 0;
}
.modeOptions { display: flex; flex-wrap: wrap; gap: 16px; }
.updateAllRow {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  button { padding: 4px 10px; font-size: 12px; }
}
.updateSummary {
  font-size: 12px;
  color: var(--color-font-label);
}
.backupHint {
  flex-shrink: 0;
  padding: 10px 7px 0;
  color: var(--color-font-label);
  font-size: 12px;
  line-height: 1.6;
}
.primaryBadge {
  display: inline-block;
  color: var(--color-primary);
  font-size: 12px;
}
.sourceUrlSection {
  margin-top: 8px;
}
.sourceUrlRow, .sourceUrlEditRow {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
}
.sourceUrlLabel {
  color: var(--color-font-label);
  flex-shrink: 0;
}
.sourceUrlText {
  color: var(--color-font);
  word-break: break-all;
  flex: 1 1 180px;
  &.muted {
    color: var(--color-font-label);
  }
}
.urlInput {
  flex: 1 1 200px;
  min-width: 0;
  font-size: 12px;
}
.compactBtn {
  padding: 3px 9px !important;
  font-size: 12px !important;
  line-height: 1.4 !important;
}
.sourceOptions { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; margin-top: 8px; }
.backupOrder {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: var(--color-font-label);
  margin: 0;
  button { padding: 4px 8px; }
}
.updateActionRow {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
}
.statusBadge {
  font-size: 12px;
  line-height: 1.4;
  word-break: break-all;
}
.status_updated {
  color: var(--color-primary-font);
}
.status_unchanged, .status_skipped {
  color: var(--color-font-label);
}
.status_failed {
  color: #c84b4b;
}

.checkbox {
  margin-top: 0;
  font-size: 12px;
  opacity: .86;
}

.content {
  flex: auto;
  min-height: 0;
  overflow-y: auto;
  margin-top: 15px;
  padding: 0 7px;
}
.listItem {
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  transition: background-color 0.2s ease;
  padding: 15px 10px;
  + .listItem { margin-top: 6px; }
  border-radius: @radius-border;
  &:hover {
    background-color: var(--color-primary-background-hover);
  }
  &.active {
    background-color: var(--color-primary-background-active);
  }
  h3 {
    font-size: 15px;
    color: var(--color-font);
    word-break: break-all;
    span {
      font-size: 12px;
      color: var(--color-font-label);
      margin-left: 6px;
    }
  }
  p {
    margin-top: 5px;
    font-size: 14px;
    color: var(--color-font-label);
    word-break: break-all;
  }
}
.noitem {
  height: 100px;
  font-size: 18px;
  color: var(--color-font-label);
  display: flex;
  justify-content: center;
  align-items: center;
}
.listLeft {
  flex: auto;
  min-width: 0;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
}
.listBtn {
  flex: none;
  height: 30px;
  width: 30px;
  padding: 0;
  margin-left: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  svg {
    width: 60%;
  }
}
.note {
  flex-shrink: 0;
  padding: 0 7px;
  margin-top: 15px;
  font-size: 12px;
  line-height: 1.25;
  color: var(--color-font);
  p {
    + p {
      margin-top: 5px;
    }
  }
}
.footer {
  flex-shrink: 0;
  padding: 0 7px;
  margin-top: 15px;
  display: flex;
  flex-flow: row nowrap;
}
.footerBtn {
  flex: auto;
  height: 36px;
  line-height: 36px;
  padding: 0 10px !important;
  width: 150px;
  .mixin-ellipsis-1();
  + .footerBtn {
    margin-left: 15px;
  }
}
.ruleLink {
  .mixin-ellipsis-1();
}

</style>
