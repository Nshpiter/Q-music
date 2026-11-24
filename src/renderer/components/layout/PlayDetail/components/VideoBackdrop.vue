<template>
  <video v-if="source && !failed" ref="video" :key="source" :src="source" :class="$style.video" aria-hidden="true" disablepictureinpicture playsinline :muted="!gain" loop @error="onError" @loadeddata="sync" />
  <CoverScene v-else-if="motion && appSetting['playDetail.coverMv']" />
</template>

<script setup lang="ts">
import { isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'
import { computed, onBeforeUnmount, ref, watch } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'
import { isPlay, playMusicInfo } from '@renderer/store/player/state'
import { playProgress } from '@renderer/store/player/playProgress'
import { volume, isMute } from '@renderer/store/player/volume'
import { bilibiliClient } from '@renderer/utils/musicSdk/bi'
import { transcodeBackdrop } from '@renderer/utils/videoTranscode'
import CoverScene from './CoverScene.vue'

const video = ref<HTMLVideoElement | null>(null)
const failed = ref(false)
const media = window.matchMedia('(prefers-reduced-motion: reduce)')
const reduce = ref(media.matches)
const updateMotion = () => { reduce.value = media.matches }
const motion = computed(() => !reduce.value && !appSetting['common.performanceMode'] && appSetting['common.isShowAnimation'])
const onlineVideo = ref('')
const convertedVideo = ref('')
let conversion: AbortController | null = null
const cancelConversion = () => {
  conversion?.abort()
  conversion = null
  convertedVideo.value = ''
}
watch([() => appSetting['playDetail.videoBackground'], motion, () => appSetting['playDetail.transcodeVideo']], () => { cancelConversion(); failed.value = false })
const source = computed(() => {
  const file = appSetting['playDetail.videoBackground']
  if (!motion.value) return ''
  return onlineVideo.value || convertedVideo.value || (file && isAbsolute(file) ? pathToFileURL(file).href : '')
})
watch([() => playMusicInfo.musicInfo, () => appSetting['playDetail.bilibiliVideo'], motion], async([item, enabled, animate], _, cleanup) => {
  onlineVideo.value = ''
  if (!item || !enabled || !animate) return
  const track = 'progress' in item ? item.metadata.musicInfo : item
  const controller = new AbortController()
  cleanup(() => { controller.abort() })
  try {
    const url = track.source === 'bi'
      ? await bilibiliClient.backgroundVideo(String(track.meta.songId), controller.signal)
      : await bilibiliClient.findBackgroundVideo(track.name, track.singer, controller.signal, track.interval)
    if (!controller.signal.aborted) onlineVideo.value = url
  } catch { /* 没有匹配的公开 MV 时沿用本地背景。 */ }
}, { immediate: true })
const gain = computed(() => !isMute.value && !onlineVideo.value ? volume.value * Math.max(0, Math.min(100, appSetting['playDetail.videoVolume'])) / 100 : 0)
const onError = async() => {
  if (onlineVideo.value) { onlineVideo.value = ''; return }
  if (convertedVideo.value || !appSetting['playDetail.transcodeVideo']) { failed.value = true; return }
  if (conversion) return
  const controller = conversion = new AbortController()
  try {
    const url = await transcodeBackdrop(appSetting['playDetail.videoBackground'], controller.signal)
    if (!controller.signal.aborted) convertedVideo.value = url
  } catch { if (!controller.signal.aborted) failed.value = true } finally {
    if (conversion === controller) conversion = null
  }
}
const sync = () => {
  const el = video.value
  if (!el) return
  el.volume = gain.value
  if (onlineVideo.value && Number.isFinite(el.duration) && el.duration > 0) {
    const position = playProgress.nowPlayTime % el.duration
    if (Math.abs(el.currentTime - position) > 1.5) el.currentTime = position
    el.playbackRate = appSetting['player.playbackRate']
  }
  if (document.hidden || !isPlay.value) {
    el.pause()
    return
  }
  if (!el.paused) return
  void el.play().catch((err: Error) => {
    if (err.name != 'AbortError' && video.value === el) void onError()
  })
}
watch(isPlay, sync)
watch(gain, () => { if (video.value) video.value.volume = gain.value })
watch(() => playProgress.nowPlayTime, () => { if (onlineVideo.value) sync() })
watch(source, () => { failed.value = false })
media.addEventListener('change', updateMotion)
document.addEventListener('visibilitychange', sync)
onBeforeUnmount(() => {
  cancelConversion()
  media.removeEventListener('change', updateMotion)
  document.removeEventListener('visibilitychange', sync)
  video.value?.pause()
})
</script>

<style module>
.video { position: absolute; inset: 0; z-index: -1; width: 100%; height: 100%; object-fit: cover; opacity: .3; pointer-events: none; }
</style>
