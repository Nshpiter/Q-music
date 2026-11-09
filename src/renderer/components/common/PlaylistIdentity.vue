<template>
  <span :class="$style.identity">
    <SourceIcon v-if="source" :source="source" :size="22" />
    <span v-else :class="$style.local" aria-hidden="true"><svg-icon :name="list.id == 'love' ? 'love' : 'music'" /></span>
    <span :class="$style.copy">
      <span :class="$style.name">{{ name || list.name }}</span>
      <span v-if="subtitle" :class="$style.source">{{ localCopy && source ? $t('favorite_local_copy', { source: sourceName }) : sourceName }}</span>
    </span>
  </span>
</template>

<script>
import { computed } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'
import SourceIcon from './SourceIcon.vue'

export default {
  components: { SourceIcon },
  props: {
    list: { type: Object, required: true },
    name: { type: String, default: '' },
    subtitle: { type: Boolean, default: false },
    localCopy: { type: Boolean, default: false },
  },
  setup(props) {
    const t = useI18n()
    const source = computed(() => props.list.source)
    const sourceName = computed(() => ({ bi: '哔哩哔哩', tx: 'QQ音乐', wy: '网易云音乐', kg: '酷狗音乐', kw: '酷我音乐', mg: '咪咕音乐', bd: '百度音乐' })[source.value] || source.value || t('playlist_local'))
    return { source, sourceName }
  },
}
</script>

<style lang="less" module>
.identity { display: inline-flex; width: 100%; min-width: 0; align-items: center; gap: 10px; text-align: left; }
.local { width: 22px; height: 22px; flex: none; display: grid; place-items: center; color: var(--color-font-label); }
.local svg { width: 18px; height: 18px; }
.copy { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 4px; line-height: 1.25; }
.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.source { font-size: 10px; font-weight: 400; color: var(--color-font-label); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
