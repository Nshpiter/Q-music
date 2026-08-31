<template>
  <teleport to="#root">
    <section v-if="modelValue" ref="menuRef" :class="[$style.container, { [$style.dark]: dark }]" :style="menuStyle" role="dialog" :aria-label="$t('player__quality_title')" @click.stop>
      <div :class="$style.header">
        <div :class="$style.title">{{ $t('player__quality_title') }}</div>
        <div v-if="musicInfo" :class="$style.song">{{ musicInfo.name }} · {{ musicInfo.singer }}</div>
        <div v-if="activePlaybackSourceInfo" :class="$style.route">
          <source-icon :source="activePlaybackSourceInfo.resolvedSource" :size="18" />
          <span>
            <b>{{ resolvedSourceName }}</b>
            <small>{{ playbackModeText }}</small>
            <small v-if="activePlaybackSourceInfo.isFallback" :class="$style.requestedRoute">{{ $t('player__quality_route_requested') }}：{{ sourceName(activePlaybackSourceInfo.requestedSource) }}</small>
          </span>
        </div>
      </div>
      <div v-if="musicInfo && musicInfo.source != 'local'" :class="$style.sourceSwitch">
        <div :class="$style.sectionTitle">
          <span>{{ $t('search__source_select') }}</span>
          <small v-if="isSourceLoading">{{ $t('search__hot_search_loading') }}</small>
          <small v-else-if="isCustomApiSource()">{{ $t('player__quality_custom_preferred') }}</small>
        </div>
        <div :class="[$style.sourceOptions, { [$style.sourceOptionsCompact]: sourceOptions.length >= 5 }]" role="listbox" :aria-label="$t('search__source_select')">
          <button
            v-for="item in sourceOptions" :key="`${item.source}_${item.id}`" type="button"
            :class="[$style.sourceOption, { [$style.sourceActive]: effectiveSource == item.source }]"
            role="option"
            :title="sourceName(item.source)"
            :aria-label="sourceName(item.source)"
            :aria-selected="effectiveSource == item.source"
            @click="selectSource(item)"
          >
            <source-icon :source="item.source" :size="20" />
            <span :class="$style.sourceLabel">{{ sourceName(item.source) }}</span>
            <svg v-if="effectiveSource == item.source" :class="$style.sourceCheck" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
          </button>
        </div>
      </div>
      <div :class="$style.options">
        <button v-for="option in options" :key="option.value" type="button" :class="[$style.option, { [$style.active]: appSetting['player.playQuality'] == option.value }]" @click="selectQuality(option.value)">
          <span><b><source-icon v-if="resolvedSource" :source="resolvedSource" :size="15" />{{ option.label }}</b><small>{{ option.meta }}</small></span>
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
import { apiSource, qualityList, userApi } from '@renderer/store'
import { playbackSourceInfo } from '@renderer/store/player/state'
import SourceIcon from '@renderer/components/common/SourceIcon.vue'
import { getOtherSource, isCustomApiSource } from '@renderer/core/music/utils'

const props = defineProps({ modelValue: Boolean, dark: Boolean, anchor: { type: Object, default: null }, musicInfo: { type: Object, default: null } })
const emit = defineEmits(['update:modelValue', 'select', 'select-source'])
const t = useI18n()
const menuRef = ref(null)
const viewport = ref({
  width: typeof window == 'undefined' ? 1024 : window.innerWidth,
  height: typeof window == 'undefined' ? 768 : window.innerHeight,
})
const otherSources = shallowRef([])
const isSourceLoading = ref(false)
let sourceRequestId = 0
const menuMetrics = computed(() => {
  // 窗口缩放后重新计算面板尺寸；CSS 的 max-width/max-height 作为首屏兜底。
  const width = Math.min(292, Math.max(176, viewport.value.width - 24))
  const maxHeight = Math.max(0, Math.min(560, viewport.value.height - 24))
  return { width, maxHeight }
})
const menuStyle = computed(() => {
  const { width, maxHeight } = menuMetrics.value
  const viewportWidth = viewport.value.width
  const viewportHeight = viewport.value.height
  const left = props.anchor
    ? Math.max(12, Math.min(props.anchor.x - width / 2, viewportWidth - width - 12))
    : Math.max(12, (viewportWidth - width) / 2)
  const preferredBottom = props.anchor ? viewportHeight - props.anchor.y + 10 : 84
  // 为整个面板预留边距，避免平台列表较长时顶部超出窗口。
  const maxBottom = Math.max(12, viewportHeight - maxHeight - 12)
  const bottom = Math.max(12, Math.min(preferredBottom, maxBottom))
  return { left: `${left}px`, bottom: `${bottom}px`, width: `${width}px`, maxHeight: `${maxHeight}px` }
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
// 请求源是用户选择的平台，解析源是当前实际拿到音频地址的平台。
// 官方音源不可用时两者可能不同，面板需要同时展示这两个状态。
const requestedSource = computed(() => props.musicInfo?.meta?.toggleMusicInfo?.source ?? props.musicInfo?.source)
// 源选择高亮表示用户请求的平台；实际解析到的平台单独在顶部 route 中展示。
// 保留这个别名供模板复用，避免请求源与解析源混淆。
const effectiveSource = requestedSource
const getMusicKey = music => music ? `${music.source}:${music.id}` : ''
const activePlaybackSourceInfo = computed(() => {
  const info = playbackSourceInfo.value
  if (!info || !props.musicInfo || info.musicKey != getMusicKey(props.musicInfo)) return null
  return info
})
const resolvedSource = computed(() => activePlaybackSourceInfo.value?.resolvedSource ?? requestedSource.value)
const getResolvedMusicInfo = () => {
  const source = resolvedSource.value
  if (!source || !props.musicInfo) return props.musicInfo
  const candidates = [props.musicInfo, props.musicInfo.meta?.toggleMusicInfo, ...otherSources.value]
  return candidates.find(item => item?.source == source) ?? props.musicInfo
}
const qualityKeys = quality => quality == 'flac' ? ['flac', 'ape', 'wav'] : [quality]
const getQualityEntry = quality => {
  const qualitys = getResolvedMusicInfo()?.meta?._qualitys ?? {}
  for (const key of qualityKeys(quality)) {
    if (qualitys[key]) return qualitys[key]
  }
  return null
}
const isCustomApiQualitySupported = quality => {
  if (!isCustomApiSource()) return false
  const source = resolvedSource.value
  return !!source && (qualityList.value[source] ?? []).includes(quality)
}
const estimateSize = bitrate => {
  const seconds = parseDuration(getResolvedMusicInfo()?.interval)
  return seconds && bitrate ? `${t('player__quality_estimated')} ${(seconds * bitrate * 1000 / 8 / 1024 / 1024).toFixed(2)} MB` : ''
}
const getSize = (quality, bitrate) => {
  const entry = getQualityEntry(quality)
  if (!entry && isCustomApiQualitySupported(quality)) return t('player__quality_available_size_unknown')
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
watch(() => [props.modelValue, props.musicInfo?.source, props.musicInfo?.id], ([visible, musicSource, musicId], previous) => {
  const previousMusicKey = `${previous?.[1] ?? ''}:${previous?.[2] ?? ''}`
  const musicKey = `${musicSource ?? ''}:${musicId ?? ''}`
  if (visible && musicId && previous?.[2] && musicKey != previousMusicKey) close()
  void loadOtherSources()
}, { immediate: true })
const sourceName = source => source == 'local' ? t('player__quality_local_file') : t(`source_${source}`)
const resolvedSourceName = computed(() => sourceName(activePlaybackSourceInfo.value?.resolvedSource))
const getCustomApiName = source => {
  const id = source ?? appSetting['common.apiSource'] ?? apiSource.value
  if (!id || !isCustomApiSource(id)) return ''
  return userApi.list.find(api => api.id == id)?.name ?? t('player__quality_custom_source')
}
const playbackModeText = computed(() => {
  const info = activePlaybackSourceInfo.value
  if (!info) return ''
  const quality = info.quality ? ` · ${info.quality == 'flac24bit' ? 'Hi-Res' : info.quality.toUpperCase()}` : ''
  const fallback = info.isFallback ? ` · ${t('player__quality_route_fallback')}` : ''
  // API/缓存结果会带上 provider id；有旧状态没有该字段时，仅对 API
  // 线路回退到当前设置，避免把内置接口误标成自定义接口。
  const providerId = info.cacheProviderId ?? (info.mode == 'api' ? appSetting['common.apiSource'] || apiSource.value : '')
  const customApi = isCustomApiSource(providerId) ? getCustomApiName(providerId) : ''
  const customApiText = customApi ? ` · ${t('player__quality_route_custom_api', { name: customApi })}` : ''
  return `${t(`player__quality_route_${info.mode}`)}${customApiText}${fallback}${quality}`
})
const needsMembershipHint = computed(() => {
  const mode = activePlaybackSourceInfo.value?.mode
  // 自定义源优先时，尚未解析出线路前不显示官方会员提示；只有实际回退到
  // 官方直连后再提示，避免面板信息与当前首选线路相互矛盾。
  return ['tx', 'wy'].includes(requestedSource.value) && (mode == 'official' || (!mode && !isCustomApiSource()))
})
const close = () => { emit('update:modelValue', false) }
const handleOutside = event => { if (props.modelValue && !menuRef.value?.contains(event.target)) close() }
const handleResize = () => {
  viewport.value = { width: window.innerWidth, height: window.innerHeight }
}
onMounted(() => {
  document.addEventListener('click', handleOutside)
  window.addEventListener('resize', handleResize)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutside)
  window.removeEventListener('resize', handleResize)
})
const selectQuality = value => { emit('select', value); close() }
const selectSource = item => {
  emit('select-source', item.source == requestedSource.value ? null : item)
  close()
}
</script>

<style lang="less" module>
.container { position: fixed; z-index: 81; width: min(292px, calc(100vw - 24px)); max-width: calc(100vw - 24px); max-height: calc(100vh - 24px); overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; padding: 14px; box-sizing: border-box; color: var(--color-font); border: 1px solid rgb(from var(--color-font) r g b / .11); border-radius: 17px; background: rgb(from var(--color-content-background) r g b / .95); box-shadow: 0 18px 50px rgba(20,28,32,.2), inset 0 1px 0 rgba(255,255,255,.72); backdrop-filter: blur(24px) saturate(1.18); animation: popIn .16s cubic-bezier(.2,.8,.2,1); transform-origin: 50% 100%; scrollbar-width: thin; scrollbar-color: rgb(from currentColor r g b / .2) transparent; &::-webkit-scrollbar { width: 5px; } &::-webkit-scrollbar-track { background: transparent; } &::-webkit-scrollbar-thumb { border-radius: 99px; background: rgb(from currentColor r g b / .2); } }
.dark { color: rgba(255,255,255,.94); border-color: rgba(255,255,255,.12); background: rgba(24,29,32,.92); box-shadow: 0 22px 54px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.08); }
.header { padding: 1px 2px 10px; border-bottom: 1px solid rgb(from currentColor r g b / .09); }
.title { font-size: 14px; font-weight: 720; }
.song { margin-top: 3px; overflow: hidden; font-size: 10px; opacity: .46; text-overflow: ellipsis; white-space: nowrap; }
.route { margin-top: 9px; min-height: 29px; display: flex; align-items: center; gap: 8px; span { min-width: 0; display: flex; flex-direction: column; } b { overflow: hidden; font-size: 11px; font-weight: 680; text-overflow: ellipsis; white-space: nowrap; } small { margin-top: 1px; font-size: 9px; opacity: .52; } .requestedRoute { color: var(--color-primary); opacity: .72; } }
.sourceSwitch { padding: 9px 0 7px; border-bottom: 1px solid rgb(from currentColor r g b / .09); }
.sectionTitle { padding: 0 2px 7px; display: flex; align-items: center; justify-content: space-between; span { font-size: 10px; font-weight: 680; opacity: .62; } small { font-size: 9px; opacity: .42; } }
.sourceOptions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; max-height: min(154px, max(72px, calc(100vh - 270px))); overflow-x: hidden; overflow-y: auto; padding: 1px; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: transparent transparent; transition: scrollbar-color .16s ease; &:hover { scrollbar-color: rgb(from currentColor r g b / .16) transparent; } &::-webkit-scrollbar { width: 4px; } &::-webkit-scrollbar-track { background: transparent; } &::-webkit-scrollbar-thumb { border-radius: 99px; background: transparent; transition: background-color .16s ease; } &:hover::-webkit-scrollbar-thumb { background: rgb(from currentColor r g b / .16); } }
.sourceOption { position: relative; min-width: 0; min-height: 45px; padding: 5px 4px 4px; display: flex; flex-flow: column nowrap; align-items: center; justify-content: center; gap: 3px; color: currentColor; border: 1px solid transparent; border-radius: 10px; background: rgb(from currentColor r g b / .045); cursor: pointer; opacity: .7; transition: color .14s ease, background-color .14s ease, border-color .14s ease, transform .14s ease; &:hover { color: var(--color-primary); border-color: var(--color-primary-alpha-500); background: var(--color-primary-alpha-900); opacity: 1; } &:active { transform: scale(.97); } &:focus-visible { outline: 2px solid var(--color-primary-alpha-500); outline-offset: 1px; } }
.sourceLabel { width: 100%; min-width: 0; overflow: hidden; font-size: 9px; line-height: 1.1; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
.sourceOptionsCompact { grid-template-columns: repeat(auto-fit, minmax(44px, 1fr)); gap: 4px; }
.sourceOptionsCompact .sourceOption { min-height: 38px; padding: 4px; }
.sourceOptionsCompact .sourceLabel { display: none; }
.sourceCheck { position: absolute; top: 4px; right: 4px; width: 11px; height: 11px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.sourceOptions .sourceActive { color: var(--color-primary); border-color: var(--color-primary-alpha-600); background: var(--color-primary-alpha-800); opacity: 1; }
.dark .sourceActive { color: #fff; border-color: rgba(255,255,255,.22); background: rgba(255,255,255,.14); }
.dark .sourceOption:hover { color: #fff; border-color: rgba(255,255,255,.24); background: rgba(255,255,255,.12); }
.options { display: grid; gap: 4px; padding-top: 7px; }
.option { min-height: 43px; padding: 5px 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px; color: currentColor; border: 1px solid transparent; border-radius: 11px; background: transparent; cursor: pointer; text-align: left; transition: background-color .14s ease, border-color .14s ease; &:hover { background: rgb(from currentColor r g b / .075); } > span { min-width: 0; display: flex; flex-direction: column; gap: 2px; } b { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; } small { overflow: hidden; font-size: 9px; opacity: .5; text-overflow: ellipsis; white-space: nowrap; } > svg { flex: none; width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; } }
.hint { margin: 8px 4px 0; font-size: 9px; line-height: 1.45; opacity: .48; }
.active { color: var(--color-primary); border-color: var(--color-primary-alpha-600); background: var(--color-primary-alpha-800); }
.dark .active { color: #fff; border-color: rgba(255,255,255,.22); background: rgba(255,255,255,.14); }
@keyframes popIn { from { opacity: 0; transform: translateY(7px) scale(.97); } to { opacity: 1; transform: none; } }
</style>
