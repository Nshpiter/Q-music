<template>
  <div :class="$style.container">
    <div v-if="props.sourceId == 'all'" :class="$style.sortBar">
      <label>{{ $t('search_sort_label') }} <select v-model="sortMode"><option value="relevance">{{ $t('search_sort_relevance') }}</option><option value="quality">{{ $t('search_sort_quality') }}</option></select></label>
      <span :title="$t('search_sort_tip')">{{ $t('search_sort_tip') }}</span>
    </div>
    <material-online-list
      ref="listRef"
      :page="listInfo.page"
      :limit="listInfo.limit"
      :total="listInfo.total"
      :list="displayList"
      :no-item="listInfo.noItemLabel"
      :source-selector="props.sourceId == 'all'"
      :source-tag="props.sourceId != 'all'"
      :source-options="getSourceOptions"
      :source-name="getSourceName"
      check-api-source
      search-results
      :video-results="props.sourceId == 'bi'"
      @retry="search(searchText, props.sourceId, props.page)"
      @toggle-page="handleTogglePage"
      @play-list="handlePlayList"
      @source-change="handleSourceChange"
    />
  </div>
</template>

<script setup lang="ts">
import { watch } from '@common/utils/vueTools'
import { searchText } from '@renderer/store/search/state'
import { useRouter, useRoute } from '@common/utils/vueRouter'
import useList, { type SearchSource } from './useList'

interface Props {
  sourceId: SearchSource
  page: number
}

const props = defineProps<Props>()
const router = useRouter()
const route = useRoute()

const {
  listRef,
  sortMode,
  displayList,
  listInfo,
  search,
  handlePlayList,
  getSourceOptions,
  getSourceName,
  handleSourceChange,
} = useList()

watch(() => [searchText.value, props.sourceId, props.page] as const, ([text, sourceId, page]) => {
  search(text, sourceId, page || 1)
}, {
  immediate: true,
})

const handleTogglePage = (page: number) => {
  void router.replace({
    path: route.path,
    query: {
      ...route.query,
      page,
    },
  })
}


</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';
.container {
  display: flex;
  flex-direction: column;
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 4px 16px calc(@height-player - 6px);
}

.sortBar { display: flex; align-items: center; gap: 12px; padding: 6px 4px 10px; font-size: 12px; flex: none; }
.sortBar span { flex: 1; min-width: 0; font-size: 11px; color: var(--color-font-label); }
.sortBar select { color: var(--color-font); border-radius: 10px; padding: 6px; background: var(--color-content-background); }
.container > :last-child { flex: 1; min-height: 0; }
.list {
  overflow: hidden;
  height: 100%;
  flex: auto;
}

</style>
