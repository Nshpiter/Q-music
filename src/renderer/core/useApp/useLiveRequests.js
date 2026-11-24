import { createRequestQueue, livePacket, readLivePackets } from '@common/utils/liveRequests'
import { ref, watch } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'
import { addTempPlayList } from '@renderer/store/player/action'
import { tempPlayList } from '@renderer/store/player/state'
import { toNewMusicInfo } from '@renderer/utils'
import musicSdk from '@renderer/utils/musicSdk'
const WebSocket = window.WebSocket

export const liveStatus = ref('')
export const lastRequest = ref('')
async function liveApi(path, signal) {
  const response = await fetch('https://api.live.bilibili.com' + path, { signal, credentials: 'omit' })
  if (!response.ok) throw Error('live_connection_failed')
  const json = await response.json()
  if (json.code !== 0 || !json.data) throw Error('live_connection_failed')
  return json.data
}

export default function useLiveRequests() {
  watch([() => appSetting['integrations.liveRequests'], () => appSetting['integrations.liveRoom']], ([enabled, room], _, cleanup) => {
    liveStatus.value = lastRequest.value = ''
    if (!enabled) return
    if (!/^[1-9]\d{0,11}$/.test(room)) { liveStatus.value = 'live_need_room'; return }
    const controller = new AbortController()
    let client, retry, deadline
    let attempts = 0
    let heartbeat
    const requestSong = createRequestQueue(async keyword => (await musicSdk.wy.musicSearch.search(keyword, 1, 5)).list?.[0], (hit, keyword) => {
      if (!hit) { lastRequest.value = window.i18n.t('search__empty') + ' · ' + keyword; return }
      const track = toNewMusicInfo(hit)
      if (!tempPlayList.some(item => item.musicInfo.id === track.id)) addTempPlayList([{ listId: null, musicInfo: track }])
      lastRequest.value = track.name + ' · ' + track.singer
    }, keyword => { lastRequest.value = window.i18n.t('list__load_failed') + ' · ' + keyword }, () => 40 - tempPlayList.length, controller.signal)
    const reconnect = () => {
      clearTimeout(deadline)
      clearTimeout(retry)
      clearInterval(heartbeat)
      if (controller.signal.aborted) return
      liveStatus.value = 'receiver_retry'
      retry = setTimeout(connect, Math.min(60000, 3000 * 2 ** Math.min(attempts++, 5)))
    }
    const connect = async() => {
      liveStatus.value = 'receiver_connecting'
      try {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12000)])
        const { room_id: id } = await liveApi('/room/v1/Room/room_init?id=' + room, signal)
        if (!Number.isSafeInteger(id) || id <= 0) throw Error('live_room')
        const info = await liveApi('/xlive/web-room/v1/index/getDanmuInfo?id=' + id + '&type=0', signal)
        const host = info.host_list?.find(item => /^[a-z\d-]+(?:\.[a-z\d-]+)*\.bilibili\.com$/i.test(item.host) && Number(item.wss_port) === 443)
        if (!host || !info.token) throw Error('live_connection_failed')
        if (controller.signal.aborted) return
        const ws = client = new WebSocket('wss://' + host.host + '/sub')
        ws.binaryType = 'arraybuffer'
        let authenticated = false
        const armDeadline = timeout => { clearTimeout(deadline); deadline = setTimeout(() => ws.close(), timeout) }
        armDeadline(15000)
        ws.onopen = () => {
          if (!controller.signal.aborted) ws.send(livePacket(7, { uid: 0, roomid: id, protover: 3, platform: 'web', type: 2, key: info.token }))
        }
        ws.onmessage = event => {
          if (controller.signal.aborted || ws.readyState !== WebSocket.OPEN) return
          try {
            readLivePackets(Buffer.from(event.data), (operation, data) => {
              if (ws.readyState !== WebSocket.OPEN) return
              if (operation === 8) {
                if (data?.code !== 0 || authenticated) { ws.close(); return }
                authenticated = true
                attempts = 0
                liveStatus.value = 'receiver_connected'
                ws.send(livePacket(2))
                heartbeat = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(livePacket(2)) }, 30000)
                armDeadline(45000)
              } else if (authenticated && operation === 3) armDeadline(45000)
              else if (authenticated && /^DANMU_MSG(?:$|:)/.test(data?.cmd)) requestSong(data.info?.[1])
            })
          } catch { ws.close() }
        }
        ws.onclose = reconnect
      } catch { reconnect() }
    }
    connect()
    cleanup(() => {
      controller.abort()
      clearTimeout(retry)
      clearTimeout(deadline)
      clearInterval(heartbeat)
      client?.close()
    })
  }, { immediate: true })
}
