import { createServer } from 'node:http'
import { open } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { computed, ref, watch } from '@common/utils/vueTools'
import { isPlay, musicInfo, playMusicInfo } from '@renderer/store/player/state'
import { playProgress } from '@renderer/store/player/playProgress'
import { isMute, volume } from '@renderer/store/player/volume'
import { appSetting } from '@renderer/store/setting'
import musicSdk from '@renderer/utils/musicSdk'
import { toOldMusicInfo } from '@renderer/utils'
import { coverOverride } from '@renderer/store/coverOverrides'

const cover = ref('')

function coverUrl(input, quality) {
  if (!/^https?:\/\//i.test(input)) return ''
  const url = new URL(input)
  if (/(^|\.)music\.126\.net$/i.test(url.hostname)) {
    url.search = '?imageView&enlarge=1&type=jpeg&quality=90' + (quality === 'max' ? '' : '&thumbnail=' + quality + 'y' + quality)
  }
  return url.href
}

async function embeddedCover(src, size, signal) {
  const limit = 24 * 1024 * 1024
  let blob
  if (src.startsWith('file:')) {
    const file = await open(fileURLToPath(src))
    try {
      const stat = await file.stat()
      if (!stat.isFile() || stat.size > limit) throw Error('cover')
      blob = new window.Blob([await file.readFile({ signal })])
    } finally { await file.close() }
  } else {
    const response = await fetch(src, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' })
    if (!response.ok || Number(response.headers.get('content-length')) > limit) throw Error('cover')
    blob = await response.blob()
  }
  if (blob.size > limit) throw Error('cover')
  const image = await window.createImageBitmap(blob)
  try {
    signal.throwIfAborted()
    const scale = Math.min(1, (size === 'max' ? 4096 : Number(size)) / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.9)
  } finally { image.close() }
}

export const sixKStatus = ref('')
const timeLabel = seconds => {
  const whole = Math.floor(seconds)
  const mins = Math.floor(whole / 60)
  const rest = String(whole % 60).padStart(2, '0')
  return mins < 60 ? mins + ':' + rest : Math.floor(mins / 60) + ':' + String(mins % 60).padStart(2, '0') + ':' + rest
}
const query = computed(() => {
  const item = playMusicInfo.musicInfo
  const track = item && ('progress' in item ? item.metadata.musicInfo : item)
  const hasSong = !!track && !!musicInfo.id
  const online = hasSong && track.source !== 'local'
  const duration = hasSong ? Math.max(0, playProgress.maxPlayTime || 0) : 0
  const position = Math.max(0, Math.min(duration, playProgress.nowPlayTime || 0))
  const repeat = appSetting['player.togglePlayMethod']
  return {
    player: {
      hasSong,
      isPaused: !hasSong || !isPlay.value,
      volumePercent: hasSong && !isMute.value ? volume.value * 100 : 0,
      seekbarCurrentPosition: position,
      seekbarCurrentPositionHuman: timeLabel(position),
      statePercent: duration > 0 ? position / duration : 0,
      likeStatus: 'INDIFFERENT',
      repeatType: hasSong && repeat === 'singleLoop' ? 'ONE' : hasSong && repeat === 'listLoop' ? 'ALL' : 'NONE',
    },
    track: {
      author: hasSong ? musicInfo.singer : '',
      title: hasSong ? musicInfo.name : '',
      album: hasSong ? musicInfo.album : '',
      cover: hasSong ? cover.value : '',
      duration,
      durationHuman: timeLabel(duration),
      url: online ? musicSdk[track.source]?.getMusicDetailPageUrl?.(toOldMusicInfo(track)) || '' : '',
      id: online ? String(track.meta.songId) : '',
      isVideo: online && track.source === 'bi',
      isAdvertisement: false,
      inLibrary: false,
    },
  }
})

export default function useSixK() {
  watch(() => appSetting['integrations.sixK'], (enabled, _, cleanup) => {
    if (!enabled) return
    const controller = new AbortController()
    const stopCover = watch([() => musicInfo.id, () => musicInfo.pic, () => appSetting['integrations.sixKCoverMode'], () => appSetting['integrations.sixKCoverSize']], async([id, pic, mode, size], _, stop) => {
      if (!id || !pic) { cover.value = ''; return }
      const controller = new AbortController()
      stop(() => { controller.abort() })
      try {
        const quality = size === 'max' ? size : String(Math.max(1, Math.min(4096, Math.round(Number(size)) || 256)))
        const url = coverUrl(pic, quality)
        if (mode !== 'base64url') { cover.value = url; return }
        const item = playMusicInfo.musicInfo
        const track = item && ('progress' in item ? item.metadata.musicInfo : item)
        const selected = track && coverOverride(track)
        const src = url || (selected === pic || /^data:image\/(png|jpeg|webp|gif|avif);base64,/i.test(pic) ? pic : '')
        const encoded = src ? await embeddedCover(src, quality, controller.signal) : ''
        if (!controller.signal.aborted) cover.value = encoded
      } catch { if (!controller.signal.aborted) cover.value = '' }
    }, { immediate: true })
    const server = createServer((request, response) => {
      response.setHeader('Access-Control-Allow-Origin', '*')
      response.setHeader('Cache-Control', 'no-store')
      if (request.method === 'OPTIONS') {
        response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' })
      } else if (request.url.split('?')[0] !== '/query') response.writeHead(404)
      else if (request.method !== 'GET') response.writeHead(405, { Allow: 'GET, OPTIONS' })
      else {
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        response.end(JSON.stringify(query.value))
        return
      }
      response.end()
    })
    sixKStatus.value = 'receiver_connecting'
    server.on('error', () => { if (!controller.signal.aborted) sixKStatus.value = 'sixk_error' })
    server.listen({ port: 9863, host: '127.0.0.1', signal: controller.signal }, () => {
      if (!controller.signal.aborted) sixKStatus.value = 'sixk_ready'
    })
    cleanup(() => {
      controller.abort()
      stopCover()
      cover.value = ''
      server.closeAllConnections()
      sixKStatus.value = ''
    })
  }, { immediate: true })
}
