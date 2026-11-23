<template lang="pug">
material-modal(:show="modelValue" bg-close teleport="#root" width="min(620px, calc(100vw - 32px))" max-width="calc(100vw - 32px)" height="min(660px, calc(100vh - 48px))" max-height="calc(100vh - 48px)" @close="handleClose")
  main(:class="$style.main")
    h2 {{ $t('user_api__title') }}
    div(v-if="apiList.length" :class="$style.modeOptions")
      base-checkbox(v-for="mode in ['play', 'quality']" :id="`user-api-mode-${mode}`" :key="mode" name="user-api-mode" need :value="mode" :model-value="appSetting['common.apiPreferQuality'] ? 'quality' : 'play'" :label="$t(`user_api_${mode}_first`)" @update:model-value="setMode")
    p(:class="$style.backupHint") {{ $t(appSetting['common.apiPreferQuality'] ? 'user_api_quality_hint' : 'user_api_backup_hint') }}
    ul.scroll(v-if="apiList.length" :class="$style.content")
      li(v-for="(api, index) in apiList" :key="api.id" :class="[$style.listItem, {[$style.active]: appSetting['common.apiSource'] == api.id}]")
        div(:class="$style.listLeft")
          h3
            | {{ api.name }}
            span(v-if="api.version") {{ /^\d/.test(api.version) ? `v${api.version}` : api.version }}
            span(v-if="api.author") {{ api.author }}
          p {{ api.description }}
          div(:class="$style.sourceOptions")
            span(v-if="appSetting['common.apiSource'] == api.id" :class="$style.primaryBadge") {{ $t('user_api_primary') }}
            base-checkbox(v-else :id="`user_api_backup_${api.id}`" :model-value="backupIds.includes(api.id)" :class="$style.checkbox" :label="$t('user_api_backup')" @update:model-value="handleBackup(api.id, $event)")
            div(v-if="backupIds.includes(api.id) && appSetting['common.apiSource'] != api.id" :class="$style.backupOrder")
              span {{ $t('user_api_backup_priority', { order: backupIds.indexOf(api.id) + 1 }) }}
              base-btn(outline :disabled="backupIds.indexOf(api.id) == 0" @click="moveBackup(api.id, -1)") {{ $t('user_api_backup_up') }}
              base-btn(outline :disabled="backupIds.indexOf(api.id) == backupIds.length - 1" @click="moveBackup(api.id, 1)") {{ $t('user_api_backup_down') }}
            base-checkbox(:id="`user_api_${api.id}`" v-model="api.allowShowUpdateAlert" :class="$style.checkbox" :label="$t('user_api__allow_show_update_alert')" @change="handleChangeAllowUpdateAlert(api, $event)")
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
import { importUserApi, removeUserApi, showSelectDialog, setAllowShowUserApiUpdateAlert } from '@renderer/utils/ipc'
import { readFile } from '@common/utils/nodejs'
import { openUrl } from '@common/utils/electron'
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
    }
  },
  watch: {
    modelValue(show) {
      if (!show) this.isShowOnlineImportModal = false
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
    async importUserApi(script) {
      return importUserApi(script).then(({ apiList }) => {
        userApi.list = apiList
      }).catch((err) => {
        void dialog(this.$t('user_api_import__failed', { message: err.message }))
      })
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
  // max-height: 100%;
  // overflow: hidden;
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
.modeOptions { display: flex; flex-wrap: wrap; gap: 16px; padding: 12px 7px 0; }
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
