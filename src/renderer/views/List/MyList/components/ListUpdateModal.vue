<template>
  <material-modal :show="visible" bg-close teleport="#view" @close="$emit('update:visible', false)">
    <div :class="$style.header">
      <h2>{{ $t('list_update_modal__title') }}</h2>
    </div>
    <div :class="$style.toolbar">
      <base-btn :disabled="batchWorking || !lists.length" @click="syncAllLists">{{ $t(batchWorking ? 'list_sync_working' : 'list_sync_all') }}</base-btn>
      <span v-if="batchTotal" role="status">{{ $t(batchWorking ? 'list_sync_batch_progress' : 'list_sync_batch_done', { current: batchCurrent, total: batchTotal, failed: batchFailed }) }}</span>
    </div>
    <main class="scroll" :class="$style.main">
      <ul v-if="lists.length" ref="dom_list" :class="$style.list">
        <li v-for="list in lists" :key="list.id" :class="[$style.listItem, {[$style.fetching]: fetchingListStatus[list.id]}]">
          <div :class="$style.listLeft">
            <h3 :class="$style.text"><SourceIcon :source="list.source" :size="18" /> {{ list.name }}</h3>
            <div>
              <base-checkbox
                :id="`list_auto_update_${list.id}`" :model-value="updateInfo[list.id]?.isAutoUpdate == true"
                :class="$style.checkbox" :label="$t('list_update_modal__auto_update')" @change="handleChangeAutoUpdate(list, $event)"
              />
              <span :class="$style.label" style="vertical-align: text-top;">{{ listUpdateTimes[list.id] || $t('list_sync_never') }}</span>
            </div>
            <p v-if="listSyncStates[list.id]" role="status" :class="$style.status">{{ syncStatus(list.id) }}</p>
            <p v-else-if="isQQSyncList(list) && !updateInfo[list.id]?.sourceAccountId" :class="$style.status">{{ $t('list_sync_binding_required') }}</p>
          </div>
          <div :class="$style.btns">
            <KugouVerifyButton v-if="list.source == 'kg' && listSyncStates[list.id]?.error == 'kugou__verification_required'" :disabled="batchWorking || loginWorking" @verified="handleUpdate(list)" />
            <base-btn v-if="listSyncStates[list.id]?.error == 'list_sync_login_required'" :disabled="batchWorking || loginWorking" @click.stop="relogin(list)">{{ $t('list_sync_relogin') }}</base-btn>
            <button :class="$style.btn" :disabled="fetchingListStatus[list.id]" outline="outline" :aria-label="$t('list_update_modal__update')" @click.stop="handleUpdate(list)">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" style="transform: rotate(45deg);" viewBox="0 0 24 24" space="preserve">
                <use xlink:href="#icon-refresh" />
              </svg>
            </button>
          </div>
        </li>
      </ul>
      <div v-else :class="$style.noItem">
        <p v-text="$t('no_item')" />
      </div>
    </main>
    <div :class="$style.footer">
      <div :class="$style.tips">{{ $t('list_update_modal__tips') }}</div>
      <div :class="$style.tips">{{ $t('list_sync_preserve_local_tip') }}</div>
    </div>
  </material-modal>
</template>

<script>
import { computed, ref, watch } from '@common/utils/vueTools'
import { userLists, fetchingListStatus, listUpdateTimes } from '@renderer/store/list/state'
import handleSyncSourceList, { isQQSyncList, listSyncStates } from '@renderer/store/list/syncSourceList'
import musicSdk from '@renderer/utils/musicSdk'
import { getListUpdateInfo, setListAutoUpdate } from '@renderer/utils/data'
import SourceIcon from '@renderer/components/common/SourceIcon.vue'
import KugouVerifyButton from '@renderer/components/common/KugouVerifyButton.vue'
import { useI18n } from '@renderer/plugins/i18n'
import { dialog } from '@renderer/plugins/Dialog'
import { loginMusicAccount } from '@renderer/utils/ipc'

export default {
  components: { SourceIcon, KugouVerifyButton },
  props: { visible: { type: Boolean, default: false } },
  emits: ['update:visible'],
  setup(props) {
    const t = useI18n()
    const lists = computed(() => userLists.filter(l => l.source == 'bi' || (!!l.source && !!musicSdk[l.source]?.songList)))
    const updateInfo = ref({})
    const refreshSettings = async() => { updateInfo.value = structuredClone(await getListUpdateInfo()) }
    watch(() => props.visible, visible => {
      if (visible) void refreshSettings().catch(() => { void dialog(t('list_sync_failed')) })
    }, { immediate: true })
    const batchWorking = ref(false)
    const batchCurrent = ref(0)
    const batchTotal = ref(0)
    const batchFailed = ref(0)
    const loginWorking = ref(false)
    const relogin = async(list) => {
      if (loginWorking.value || !['tx', 'wy', 'kg'].includes(list.source)) return
      loginWorking.value = true
      try {
        const result = await loginMusicAccount(list.source)
        if (result.status == 'connected') await handleUpdate(list)
      } catch { void dialog(t('list_sync_login_required')) } finally { loginWorking.value = false }
    }
    const handleUpdate = async(targetListInfo) => {
      try {
        const updated = await handleSyncSourceList(targetListInfo)
        await refreshSettings()
        return updated
      } catch { return false }
    }
    const syncAllLists = async() => {
      if (batchWorking.value) return
      const targets = [...lists.value]
      batchWorking.value = true
      batchTotal.value = targets.length
      batchCurrent.value = batchFailed.value = 0
      try {
        for (const list of targets) {
          if (!await handleUpdate(list)) batchFailed.value++
          batchCurrent.value++
        }
      } finally { batchWorking.value = false }
    }
    const handleChangeAutoUpdate = async(list, enable) => {
      try {
        await setListAutoUpdate(list.id, enable)
        await refreshSettings()
      } catch { void dialog(t('list_sync_failed')) }
    }
    const syncStatus = id => {
      const state = listSyncStates[id]
      if (state.phase == 'fetch' && !state.total) return t('list_sync_working')
      if (state.phase == 'success' && !state.total) return t('list_sync_empty')
      return t(state.phase == 'error' ? state.error : `list_sync_${state.phase}`, { current: state.current, total: state.total })
    }
    return {
      lists,
      updateInfo,
      fetchingListStatus,
      listUpdateTimes,
      handleUpdate,
      handleChangeAutoUpdate,
      relogin,
      loginWorking,
      batchWorking,
      batchCurrent,
      batchTotal,
      batchFailed,
      syncAllLists,
      listSyncStates,
      syncStatus,
      isQQSyncList,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

@width: 460px;

.header {
  flex: none;
  padding: 15px;
  text-align: center;
  h2 {
    word-break: break-all;
  }
}
.toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 0 15px 12px; font-size: 12px; }
.status { font-size: 12px; line-height: 1.5; margin-top: 6px; color: var(--color-font-label); overflow-wrap: anywhere; }
.main {
  min-height: 115px;
  width: min(@width, 85vw);
}

.list {
  // background-color: @color-search-form-background;
  font-size: 13px;
  transition-property: height;
  position: relative;
  .listItem {
    position: relative;
    padding: 15px 10px 15px 15px;
    transition: .3s ease;
    transition-property: background-color, opacity;
    line-height: 1.3;
    // overflow: hidden;
    display: flex;
    flex-flow: row nowrap;
    align-items: center;

    &:hover {
      background-color: var(--color-primary-background-hover);
    }
    // border-radius: 4px;
    // &:last-child {
    //   border-bottom-left-radius: 4px;
    //   border-bottom-right-radius: 4px;
    // }
    &.fetching {
      opacity: .5;
    }
  }
}

.listLeft {
  flex: auto;
  min-width: 0;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
}

.text {
  flex: auto;
  margin-bottom: 2px;
  .mixin-ellipsis-1();
  > span { vertical-align: middle; margin-right: 4px; }
}
.checkbox {
  margin-top: 3px;
  font-size: 14px;
  opacity: .86;
}

.label {
  flex: none;
  font-size: 12px;
  opacity: 0.5;
  padding: 0 10px;
  // display: flex;
  // align-items: center;
  // transform: rotate(45deg);
  // background-color:
}
.btns {
  flex: none;
  font-size: 12px;
  padding: 0 5px;
  display: flex;
  align-items: center;
}
.btn {
  background-color: transparent;
  border: none;
  border-radius: @form-radius;
  margin-right: 5px;
  cursor: pointer;
  padding: 4px 7px;
  color: var(--color-button-font);
  outline: none;
  transition: background-color 0.2s ease;
  line-height: 0;
  &:last-child {
    margin-right: 0;
  }

  svg {
    height: 22px;
    width: 22px;
  }

  &:hover {
    background-color: var(--color-primary-background-hover);
  }
  &:active {
    background-color: var(--color-primary-font-active);
  }
}

.footer {
  width: min(@width, 85vw);
}
.tips {
  padding: 8px 15px;
  font-size: 13px;
  line-height: 1.25;
  color: var(--color-font);
}

.noItem {
  position: relative;
  height: 200px;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  align-items: center;

  p {
    font-size: 16px;
    color: var(--color-font-label);
  }
}

</style>
