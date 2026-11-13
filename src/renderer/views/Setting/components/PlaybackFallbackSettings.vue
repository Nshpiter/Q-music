<template lang="pug">
dd.fallback-settings
  h3#play_fallback {{ $t('playback_fallback_title') }}
  .gap-top
    base-checkbox(id="fallback_quality" :model-value="appSetting['player.autoQualityFallback']" :label="$t('playback_fallback_quality')" @update:model-value="updateSetting({'player.autoQualityFallback': $event})")
  .gap-top
    base-checkbox(id="fallback_source" :model-value="appSetting['player.autoSourceFallback']" :label="$t('playback_fallback_source')" @update:model-value="updateSetting({'player.autoSourceFallback': $event})")
  template(v-if="appSetting['player.autoSourceFallback']")
    .fallback-order
      base-checkbox(v-for="value in ['source', 'quality']" :id="`fallback_order_${value}`" :key="value" name="fallback_order" need :model-value="appSetting['player.fallbackOrder']" :value="value" :label="$t(`playback_fallback_${value}_first`)" @update:model-value="updateSetting({'player.fallbackOrder': $event})")
    p.hint {{ $t('playback_fallback_platforms') }}
    ol.platforms
      li(v-for="(source, index) in platforms" :key="source")
        span {{ index + 1 }}. {{ names[source] }}
        .actions
          button(type="button" :disabled="index == 0" :aria-label="`${names[source]} ${$t('playback_fallback_up')}`" @click="move(index, -1)") ↑
          button(type="button" :disabled="index == platforms.length - 1" :aria-label="`${names[source]} ${$t('playback_fallback_down')}`" @click="move(index, 1)") ↓
  p.hint {{ $t('playback_fallback_hint') }}
</template>

<script setup lang="ts">
import { computed } from '@common/utils/vueTools'
import { fallbackPlatformOrder } from '@common/utils/playbackPolicy'
import { appSetting, updateSetting } from '@renderer/store/setting'

const names: Record<string, string> = { wy: '网易云音乐', tx: 'QQ 音乐', kg: '酷狗音乐', kw: '酷我音乐', mg: '咪咕音乐' }
const platforms = computed(() => fallbackPlatformOrder(appSetting['player.fallbackPlatforms']))
const move = (index: number, step: number) => {
  const list = [...platforms.value]
  const target = index + step
  if (target < 0 || target >= list.length) return
  ;[list[index], list[target]] = [list[target], list[index]]
  updateSetting({ 'player.fallbackPlatforms': list.join(',') })
}
</script>

<style lang="less" scoped>
.fallback-order { display: flex; flex-wrap: wrap; gap: 12px 24px; margin-top: 16px; }
.hint { font-size: 12px; line-height: 1.7; opacity: .65; margin-top: 14px; }
.platforms { max-width: 420px; margin-top: 8px; display: grid; gap: 6px; }
.platforms li { display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--q-outline); border-radius: 10px; padding: 4px 12px; }
.actions { display: flex; gap: 4px; }
.actions button { width: 32px; height: 32px; border: 0; background: transparent; border-radius: 8px; color: inherit; font: inherit; cursor: pointer; }
.actions button:hover:not(:disabled), .actions button:focus-visible { background: var(--color-primary-light-100-alpha-300); }
.actions button:disabled { opacity: .25; cursor: default; }
</style>
