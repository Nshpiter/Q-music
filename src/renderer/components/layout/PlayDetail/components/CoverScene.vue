<template>
  <div v-if="musicInfo.pic" class="q-cover-scene" :class="$style.stage" aria-hidden="true">
    <img :class="$style.backdrop" :src="musicInfo.pic" alt="" draggable="false">
    <div ref="camera" :class="$style.camera">
      <img v-for="plane in 2" :key="plane" :src="musicInfo.pic" alt="" draggable="false">
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getAnalyser, getCurrentTime, getPlaybackRate } from '@renderer/plugins/player'
import { appSetting } from '@renderer/store/setting'
import { musicInfo, isPlay, playMusicInfo } from '@renderer/store/player/state'
import { getFileMetadata } from '@renderer/utils/music'
import { lyric } from '@renderer/store/player/lyric'
import { playProgress } from '@renderer/store/player/playProgress'

// 用歌词段落间隔确定切镜位置。纯音乐每十二秒换景，拖动进度后直接落在对应镜头。
const cuts = computed(() => {
  const points = [0]
  let previous = 0
  for (const line of lyric.lines) {
    const t = line.time / 1000
    const age = t - points[points.length - 1]
    if (age >= 18 || (age >= 6 && t - previous > 2.5)) points.push(t)
    previous = t
  }
  return points
})
const camera = ref<HTMLDivElement>()
// 本地文件优先使用实际流派标签。在线曲目可从专辑、曲名中的明确标注识别。
const movement = ref(1)
watch(() => playMusicInfo.musicInfo, async(item, _, cleanup) => {
  let active = true
  cleanup(() => { active = false })
  movement.value = 1
  if (!item) return
  const track = 'progress' in item ? item.metadata.musicInfo : item
  const metadata = track.source === 'local' ? await getFileMetadata(track.meta.filePath).catch(() => null) : null
  if (!active) return
  const text = [metadata?.common.genre?.join(' '), track.meta.albumName, track.name].filter(Boolean).join(' ')
  if (/classical|ambient|acoustic|ballad|piano|古典|钢琴|钢琴曲|抒情|氛围/i.test(text)) movement.value = 0.5
  else if (/rock|metal|electronic|dance|edm|trance|摇滚|舞曲|电音/i.test(text)) movement.value = 1.5
}, { immediate: true })
let frame = 0
let lastFrame = 0
let visualTime = 0
let nextSample = 0
let targetLevel = 0
let level = 0
let sectionIndex = 0
const bass = new Uint8Array(4)
function draw(now: number) {
  frame = 0
  const el = camera.value
  if (!el || document.hidden) return
  const mediaTime = getCurrentTime()
  const elapsed = (now - lastFrame) / 1000
  const rate = getPlaybackRate()
  const predicted = visualTime + elapsed * rate
  // 声卡分块推进媒体时钟。高刷屏在块间插值，缓冲时最多前探一小段，定位则立即对齐。
  if (!lastFrame || !isPlay.value || Math.abs(predicted - mediaTime) > 0.15 * rate) {
    visualTime = mediaTime
  } else {
    const correction = (mediaTime - predicted) * (1 - Math.exp(-elapsed / 0.12))
    visualTime = Math.min(mediaTime + 0.04 * rate, predicted + correction)
  }
  const time = visualTime
  const points = cuts.value
  if (sectionIndex >= points.length || time < points[sectionIndex] || time >= points[sectionIndex + 1]) {
    sectionIndex = Math.max(0, points.findLastIndex(point => point <= time))
  }
  const start = points[sectionIndex]
  const duration = (points[sectionIndex + 1] ?? start + 12) - start
  const phase = Math.PI * (sectionIndex + (time - start) / duration)
  if (isPlay.value && now >= nextSample) {
    // 自选音频设备时保持原输出，镜头仍按歌曲时间推进。
    const analyser = appSetting['player.mediaDeviceId'] === 'default' ? getAnalyser() : null
    nextSample = now + 80
    if (analyser) {
      analyser.getByteFrequencyData(bass)
      targetLevel = (bass[1] + bass[2] + bass[3]) / 765
    } else targetLevel = 0
  }
  if (lastFrame) level += (targetLevel - level) * (1 - Math.exp(-(now - lastFrame) / 180))
  lastFrame = now
  const yaw = Math.cos(phase) * 14 * movement.value
  const pitch = Math.sin(phase) * 5
  const depth = 32 + Math.sin(phase * 0.5) * 24 + level * 12 * movement.value
  el.style.transform = `translateZ(${depth.toFixed(3)}px) rotateY(${yaw.toFixed(4)}deg) rotateX(${pitch.toFixed(4)}deg)`
  if (isPlay.value && !document.hidden) frame = requestAnimationFrame(draw)
}
function sync() {
  cancelAnimationFrame(frame)
  lastFrame = 0
  if (camera.value && !document.hidden) frame = requestAnimationFrame(draw)
}
watch([camera, isPlay, cuts, movement], sync, { flush: 'post' })
watch(() => playMusicInfo.musicInfo, () => {
  sectionIndex = nextSample = level = targetLevel = 0
  sync()
})
watch(() => playProgress.nowPlayTime, () => { if (!isPlay.value) sync() })
onMounted(() => { document.addEventListener('visibilitychange', sync); sync() })
onBeforeUnmount(() => { document.removeEventListener('visibilitychange', sync); cancelAnimationFrame(frame) })
</script>
<style module>
.stage { position: absolute; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; perspective: 850px; opacity: .24; mask-image: linear-gradient(to right, #000 16%, rgba(0,0,0,.72) 44%, rgba(0,0,0,.28) 72%); }
.backdrop { position: absolute; inset: -3%; width: 106%; height: 106%; object-fit: cover; filter: blur(12px); }
.camera { position: absolute; inset: -9%; transform-style: preserve-3d; will-change: transform; }
.camera img { position: absolute; left: 20%; top: 10%; width: 60%; height: 80%; object-fit: cover; border-radius: 2%; }
.camera img:first-child { transform: translateX(-61%) rotateY(27deg) translateZ(-48px); opacity: .55; }
.camera img:last-child { transform: translateX(22%) translateZ(12px); }
</style>
