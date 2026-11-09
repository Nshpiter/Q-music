<template>
  <dd>
    <h3>{{ $t('favorite_default_target') }}</h3>
    <select :value="favoriteId" :aria-label="$t('favorite_default_target')" @change="setFavoriteTarget">
      <option :value="loveList.id">{{ $t(loveList.name) }}</option>
      <option :value="defaultList.id">{{ $t(defaultList.name) }}</option>
      <option v-for="list in favoriteLists" :key="list.id" :value="list.id">{{ list.name }}</option>
    </select>
    <p>{{ $t('favorite_default_tip') }}</p>
    <h3>{{ $t('queue_play_all_mode') }}</h3>
    <base-checkbox v-for="mode in ['replace', 'append']" :id="`queue_all_${mode}`" :key="mode" class="gap-left" name="queue_all_mode" need :model-value="appSetting['list.playAllMode']" :value="mode" :label="$t(`queue_play_all_${mode}`)" @update:model-value="updateSetting({ 'list.playAllMode': $event })" />
    <h3 class="gap-top">{{ $t('play_history_limit') }}</h3>
    <select :value="limit" :aria-label="$t('play_history_limit')" @change="setLimit">
      <option v-for="value in [0, 100, 500, 1000, 5000]" :key="value" :value="value">{{ value || $t('play_history_unlimited') }}</option>
    </select>
    <p>{{ $t('play_history_limit_tip') }}</p>
    <p v-if="error" role="alert">{{ $t('play_history_failed') }}</p>
  </dd>
</template>
<script lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { defaultList, loveList, userLists } from '@renderer/store/list/state'
import { getFavoriteListId } from '@renderer/core/localFavorite'
import { playHistory } from '@renderer/core/playHistory'
export default {
  setup() {
    const favoriteId = computed(getFavoriteListId)
    const favoriteLists = computed(() => userLists.filter(item => !item.source))
    const setFavoriteTarget = (event: Event) => { updateSetting({ 'list.favoriteTargetId': (event.target as HTMLSelectElement).value }) }
    const limit = ref(playHistory.snapshot().limit)
    const error = ref(false)
    const unsubscribe = playHistory.subscribe(() => { limit.value = playHistory.snapshot().limit })
    onBeforeUnmount(unsubscribe)
    onMounted(() => { void playHistory.load().catch(() => { error.value = true }) })
    const setLimit = async(event: Event) => {
      error.value = false
      try { await playHistory.setLimit(Number((event.target as HTMLSelectElement).value)) } catch { error.value = true }
    }
    return { favoriteId, favoriteLists, setFavoriteTarget, limit, error, setLimit, appSetting, updateSetting, defaultList, loveList }
  },
}
</script>
<style scoped lang="less">
select { border-radius: 8px; padding: 8px 12px; color: var(--color-font); border: 1px solid var(--q-outline); background: var(--color-content-background); }
</style>
