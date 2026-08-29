<template>
  <teleport to="#root">
    <section v-if="modelValue" ref="menuRef" :class="[$style.container, { [$style.dark]: dark }]" :style="menuStyle" role="dialog" :aria-label="$t('player__quality_title')" @click.stop>
      <div :class="$style.header">
        <div :class="$style.title">{{ $t('player__quality_title') }}</div>
        <div v-if="musicInfo" :class="$style.song">{{ musicInfo.name }} · {{ musicInfo.singer }}</div>
        <div v-if="playbackSourceInfo" :class="$style.route">
          <source-icon :source="playbackSourceInfo.resolvedSource" :size="18" />
          <span><b>{{ resolvedSourceName }}</b><small>{{ playbackModeText }}</small></span>
        </div>
      </div>
      <div v-if="musicInfo && musicInfo.source != 'local'" :class="$style.sourceSwitch">
        <div :class="$style.sectionTitle"><span>{{ $t('search__source_select') }}</span><small v-if="isSourceLoading">{{ $t('search__hot_search_loading') }}</small></div>
        <div :class="$style.sourceOptions">
          <button
            v-for="item in sourceOptions" :key="`${item.source}_${item.id}`" type="button"
            :class="{ [$style.sourceActive]: effectiveSource == item.source }" :title="sourceName(item.source)"
            @click="selectSource(item)"
          >
            <source-icon :source="item.source" :size="20" />
            <span>{{ sourceName(item.source) }}</span>
          </button>
        </div>
      </div>
      <div :class="$style.options">
        <button v-for="option in options" :key="option.value" type="button" :class="[$style.option, { [$style.active]: appSetting['player.playQuality'] == option.value }]" @click="selectQuality(option.value)">
          <span><b><source-icon v-if="effectiveSource" :source="effectiveSource" :size="15" />{{ option.label }}</b><small>{{ option.meta }}</small></span>
          <svg v-if="appSetting['player.playQuality'] == option.value" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4 4L19 7" /></svg>
        </button>
      </div>
      <p v-if="needsMembershipHint" :class="$style.hint">{{ $t('player__quality_membership_hint') }}</p>
    </section>
  </teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'
import { appSetting } from '@renderer/store/setting'
import { playbackSourceInfo } from '@renderer/store/player/state'
import SourceIcon from '@renderer/components/common/SourceIcon.vue'
import { getOtherSource } from '@renderer/core/music/utils'

const props = defineProps({ modelValue: Boolean, dark: Boolean, anchor: { type: Object, default: null }, musicInfo: { type: Object, default: null } })
const emit = defineEmits(['update:modelValue', 'select', 'select-source'])
const t = useI18n()
const menuRef = ref(null)
const otherSources = shallowRef([])
const isSourceLoading = ref(false)
let sourceRequestId = 0
const menuStyle = computed(() => {
  const width = 292
  if (!props.anchor) return { left: `calc(50vw - ${width / 2}px)`, bottom: '84px' }
  const left = Math.max(12, Math.min(props.anchor.x - width / 2, window.innerWidth - width - 12))
  return { left: `${left}px`, bottom: `${Math.max(12, window.innerHeight - props.anchor.y + 10)}px` }
})
const parseDuration = interval => {
  if (!interval) return 0
  const parts = interval.split(':').map(Number)
  return parts.some(Number.isNaN) ? 0 : parts.reduce((seconds, value) => seconds * 60 + value, 0)
}
const formatSize = size => {
  if (!size) return ''
  const value = String(size).trim()
  if (/^[\d.]+m$/i.test(value)) return `${parseFloat(value).toFixed(2)} MB`
  if (/^[\d.]+k$/i.test(value)) return `${parseFloat(value).toFixed(0)} KB`
  return value.replace(/mb$/i, ' MB').replace(/kb$/i, ' KB')
}
const qualityKeys = quality => quality == 'flac' ? ['flac', 'ape', 'wav'] : [quality]
const getQualityEntry = quality => {
  const qualitys = props.musicInfo?.meta?._qualitys ?? {}
  for (const key of qualityKeys(quality)) {
    if (qualitys[key]) return qualitys[key]
  }
  return null
}
const estimateSize = bitrate => {
  const seconds = parseDuration(props.musicInfo?.interval)
  return seconds && bitrate ? `${t('player__quality_estimated')} ${(seconds * bitrate * 1000 / 8 / 1024 / 1024).toFixed(2)} MB` : ''
}
const getSize = (quality, bitrate) => {
  const entry = getQualityEntry(quality)
  if (!entry) return t('player__quality_not_listed')
  const size = formatSize(entry.size)
  if (size) return size
  return estimateSize(bitrate) || t('player__quality_available_size_unknown')
}
const options = computed(() => [
  { value: '128k', label: t('player__quality_standard'), meta: `128 kbps · ${getSize('128k', 128)}` },
  { value: '320k', label: t('player__quality_high'), meta: `320 kbps · ${getSize('320k', 320)}` },
  { value: 'flac', label: t('player__quality_lossless'), meta: `FLAC · ${getSize('flac')}` },
  { value: 'flac24bit', label: t('player__quality_hires'), meta: `24-bit · ${getSize('flac24bit')}` },
])
const sourceOptions = computed(() => {
  if (!props.musicInfo) return []
  const list = [props.musicInfo, props.musicInfo.meta?.toggleMusicInfo, ...otherSources.value]
  const seen = new Set()
  return list.filter(item => {
    if (!item?.source || seen.has(item.source)) return false
    seen.add(item.source)
    return true
  })
})
const effectiveSource = computed(() => props.musicInfo?.meta?.toggleMusicInfo?.source ?? props.musicInfo?.source)
const loadOtherSources = async() => {
  const musicInfo = props.musicInfo
  const requestId = ++sourceRequestId
  otherSources.value = []
  if (!props.modelValue || !musicInfo || musicInfo.source == 'local') return
  isSourceLoading.value = true
  try {
    const list = await getOtherSource(musicInfo)
    if (requestId == sourceRequestId) otherSources.value = list
  } catch {
    if (requestId == sourceRequestId) otherSources.value = []
  } finally {
    if (requestId == sourceRequestId) isSourceLoading.value = false
  }
}
watch(() => [props.modelValue, props.musicInfo?.id], () => { void loadOtherSources() }, { immediate: true })
const sourceName = source => source == 'local' ? t('player__quality_local_file') : t(`source_${source}`)
const resolvedSourceName = computed(() => sourceName(playbackSourceInfo.value?.resolvedSource))
const playbackModeText = computed(() => {
  const info = playbackSourceInfo.value
  if (!info) return ''
  const quality = info.quality ? ` · ${info.quality == 'flac24bit' ? 'Hi-Res' : info.quality.toUpperCase()}` : ''
  const fallback = info.isFallback ? ` · ${t('player__quality_route_fallback')}` : ''
  return `${t(`player__quality_route_${info.mode}`)}${fallback}${quality}`
})
const needsMembershipHint = computed(() => ['tx', 'wy'].includes(props.musicInfo?.source))
const close = () => { emit('update:modelValue', false) }
const handleOutside = event => { if (props.modelValue && !menuRef.value?.contains(event.target)) close() }
onMounted(() => { document.addEventListener('click', handleOutside) })
onBeforeUnmount(() => { document.removeEventListener('click', handleOutside) })
const selectQuality = value => { emit('select', value); close() }
const selectSource = item => { emit('select-source', item.source == props.musicInfo?.source ? null : item) }
</script>

<style lang="less" module>
.container { position: fixed; z-index: 81; width: 292px; padding: 14px; box-sizing: border-box; color: var(--color-font); border: 1px solid rgb(from var(--color-font) r g b / .11); border-radius: 17px; background: rgb(from var(--color-content-background) r g b / .95); box-shadow: 0 18px 50px rgba(20,28,32,.2), inset 0 1px 0 rgba(255,255,255,.72); backdrop-filter: blur(24px) saturate(1.18); animation: popIn .16s cubic-bezier(.2,.8,.2,1); transform-origin: 50% 100%; }
.dark { color: rgba(255,255,255,.94); border-color: rgba(255,255,255,.12); background: rgba(24,29,32,.92); box-shadow: 0 22px 54px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.08); }
.header { padding: 1px 2px 10px; border-bottom: 1px solid rgb(from currentColor r g b / .09); }
.title { font-size: 14px; font-weight: 720; }
.song { margin-top: 3px; overflow: hidden; font-size: 10px; opacity: .46; text-overflow: ellipsis; white-space: nowrap; }
.route { margin-top: 9px; min-height: 29px; display: flex; align-items: center; gap: 8px; span { min-width: 0; display: flex; flex-direction: column; } b { overflow: hidden; font-size: 11px; font-weight: 680; text-overflow: ellipsis; white-space: nowrap; } small { margin-top: 1px; font-size: 9px; opacity: .52; } }
.sourceSwitch { padding: 9px 0 7px; border-bottom: 1px solid rgb(from currentColor r g b / .09); }
.sectionTitle { padding: 0 2px 7px; display: flex; align-items: center; justify-content: space-between; span { font-size: 10px; font-weight: 680; opacity: .62; } small { font-size: 9px; opacity: .42; } }
.sourceOptions { display: flex; gap: 5px; overflow-x: auto; button { flex: none; min-width: 55px; height: 36px; padding: 0 8px; display: flex; align-items: center; justify-content: center; gap: 5px; color: currentColor; border: 1px solid transparent; border-radius: 10px; background: rgb(from currentColor r g b / .045); cursor: pointer; opacity: .65; } button:hover, .sourceActive { color: var(--color-primary); border-color: var(--color-primary-alpha-600); background: var(--color-primary-alpha-800); opacity: 1; } span { font-size: 9px; white-space: nowrap; } }
.dark .sourceActive { color: #fff; border-color: rgba(255,255,255,.22); background: rgba(255,255,255,.14); }
.options { display: grid; gap: 4px; padding-top: 7px; }
.option { min-height: 43px; padding: 5px 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px; color: currentColor; border: 1px solid transparent; border-radius: 11px; background: transparent; cursor: pointer; text-align: left; transition: background-color .14s ease, border-color .14s ease; &:hover { background: rgb(from currentColor r g b / .075); } > span { min-width: 0; display: flex; flex-direction: column; gap: 2px; } b { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; } small { overflow: hidden; font-size: 9px; opacity: .5; text-overflow: ellipsis; white-space: nowrap; } > svg { flex: none; width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; } }
.hint { margin: 8px 4px 0; font-size: 9px; line-height: 1.45; opacity: .48; }
.active { color: var(--color-primary); border-color: var(--color-primary-alpha-600); background: var(--color-primary-alpha-800); }
.dark .active { color: #fff; border-color: rgba(255,255,255,.22); background: rgba(255,255,255,.14); }
@keyframes popIn { from { opacity: 0; transform: translateY(7px) scale(.97); } to { opacity: 1; transform: none; } }
</style>
