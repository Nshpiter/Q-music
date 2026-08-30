<template>
  <span
    :class="[$style.icon, $style[source]]" :style="iconStyle"
    role="img" :aria-label="sourceLabel" :title="sourceLabel"
  >
    <img v-if="showOfficialIcon" :src="officialIcon" alt="" aria-hidden="true" @error="handleImageError">
    <span v-else>{{ source.toUpperCase() }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from '@common/utils/vueTools'

const props = withDefaults(defineProps<{
  source: string
  size?: number
  label?: string
}>(), {
  size: 16,
  label: '',
})

const sourceLabels: Record<string, string> = {
  tx: 'QQ音乐',
  wy: '网易云音乐',
  kg: '酷狗音乐',
  kw: '酷我音乐',
  mg: '咪咕音乐',
  spotify: 'Spotify',
  local: '本地音乐',
}
const officialIcons: Record<string, string> = {
  tx: 'https://y.qq.com/favicon.ico',
  wy: 'https://s1.music.126.net/style/favicon.ico?v20180823',
  kg: 'https://www.kugou.com/favicon.ico',
  kw: 'https://h5s.kuwo.cn/favicon.ico',
  mg: 'https://h5.nf.migu.cn/app/favicon.ico',
  spotify: 'https://open.spotifycdn.com/cdn/images/favicon32.b64ecc03.png',
}
const sourceLabel = computed(() => props.label || sourceLabels[props.source] || props.source)
const officialIcon = computed(() => officialIcons[props.source] ?? '')
const iconStyle = computed(() => ({ width: `${props.size}px`, height: `${props.size}px` }))
const imageFailed = ref(false)
const showOfficialIcon = computed(() => Boolean(officialIcon.value) && !imageFailed.value)
const handleImageError = () => { imageFailed.value = true }
watch(() => props.source, () => { imageFailed.value = false })
</script>

<style lang="less" module>
.icon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: -.18em;

  img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;
    image-rendering: auto;
    transform: translateZ(0);
  }
  > span {
    color: var(--color-font-label);
    font-size: 8px;
    font-weight: 700;
    line-height: 1;
  }
}
</style>
