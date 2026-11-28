<template>
  <div ref="dom_tabs" :class="$style.tabs" role="tablist">
    <span
      v-show="indicator.width > 0"
      :class="[$style.indicator, { [$style.indicatorReady]: indicatorReady }]"
      :style="{ width: `${indicator.width}px`, transform: `translateX(${indicator.left}px)` }"
      aria-hidden="true"
    />
    <button
      v-for="item in list" :key="item.id" type="button" role="tab"
      :data-sort-id="item.id"
      :class="[$style.tab, { [$style.active]: sortId == item.id }]"
      :aria-selected="sortId == item.id" @click="handleToggle(item.id)"
    >{{ item.name }}</button>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from '@common/utils/vueTools'
import { sortList } from '@renderer/store/songList/state'
import { useRouter } from '@common/utils/vueRouter'

const props = defineProps({
  source: { type: String, required: true },
  tagId: { type: String, required: true },
  sortId: { type: String, default: '' },
})
const router = useRouter()
const dom_tabs = ref(null)
const indicator = reactive({ left: 0, width: 0 })
const indicatorReady = ref(false)
const list = computed(() => sortList[props.source] ?? [])

const updateIndicator = () => {
  const root = dom_tabs.value
  const activeBtn = root?.querySelector('button[aria-selected="true"]')
  if (!root || !activeBtn) {
    indicator.width = 0
    return
  }
  const rootRect = root.getBoundingClientRect()
  const btnRect = activeBtn.getBoundingClientRect()
  indicator.left = btnRect.left - rootRect.left
  indicator.width = btnRect.width
}

watch([() => props.sortId, list], () => {
  void nextTick(updateIndicator)
}, { flush: 'post' })

let resizeObserver = null
let readyFrame = 0
onMounted(() => {
  updateIndicator()
  readyFrame = window.requestAnimationFrame(() => {
    indicatorReady.value = true
  })
  if (typeof ResizeObserver != 'undefined' && dom_tabs.value) {
    resizeObserver = new ResizeObserver(updateIndicator)
    resizeObserver.observe(dom_tabs.value)
  }
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.cancelAnimationFrame(readyFrame)
})

const handleToggle = (id) => {
  if (id == props.sortId) return
  void router.replace({
    path: '/songList/list',
    query: { source: props.source, tagId: props.tagId, sortId: id, page: '1' },
  })
}
</script>

<style lang="less" module>
.tabs {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 11px;
  background: var(--q-surface-soft);
  box-shadow: inset 0 0 0 1px var(--q-border);
}
.indicator {
  position: absolute;
  left: 0;
  top: 3px;
  bottom: 3px;
  border-radius: 8px;
  background: var(--color-content-background);
  box-shadow: 0 2px 8px rgba(24, 36, 31, .08), inset 0 0 0 1px var(--q-border);
  pointer-events: none;
}
.indicatorReady {
  transition: transform .3s cubic-bezier(.22, 1, .36, 1), width .3s cubic-bezier(.22, 1, .36, 1);
}
.tab {
  position: relative;
  z-index: 1;
  border: 0;
  min-height: 26px;
  padding: 4px 14px;
  border-radius: 8px;
  font: inherit;
  font-size: 12px;
  color: var(--color-font-label);
  background: transparent;
  cursor: pointer;
  transition: color .18s ease, transform .14s ease;
  &:hover { color: var(--color-font); }
  &:active { transform: scale(.96); }
  &:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
  &.active { color: var(--color-primary-dark-200); font-weight: 620; }
}
@media (prefers-reduced-motion: reduce) {
  .indicatorReady, .tab { transition: none; }
}
</style>
