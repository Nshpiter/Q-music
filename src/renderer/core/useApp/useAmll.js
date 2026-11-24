import { ref, watch } from '@common/utils/vueTools'
import { amllCommand, amllLines, amllState } from '@common/utils/amllProtocol'
import { play, pause, playPrev, playNext } from '@renderer/core/player/action'
import { playProgress } from '@renderer/store/player/playProgress'
import { lyric } from '@renderer/store/player/lyric'
import { musicInfo, playMusicInfo, isPlay } from '@renderer/store/player/state'
import { volume, isMute } from '@renderer/store/player/volume'
import { appSetting, setTogglePlayMode } from '@renderer/store/setting'
import { attachAmllAudio } from '@renderer/plugins/player/amllPcm'

export const amllStatus = ref('')
export const amllAudioError = ref(false)
export default function useAmll() {
  watch([() => appSetting['integrations.amll'], () => appSetting['integrations.amllUrl'], () => appSetting['integrations.amllVersion']], ([enabled, address, version], _, cleanup) => {
    if (!enabled) return
    let url
    try {
      url = new URL(address)
      if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password || url.hash) throw Error()
    } catch { amllStatus.value = 'receiver_invalid'; return }
    let socket
    let retry
    let stopped = false
    let subscriptions = []
    const ms = seconds => Math.max(0, Math.round(seconds * 1000)) || 0
    const send = state => {
      if (socket?.readyState !== window.WebSocket.OPEN) return
      const data = amllState(version, state)
      if (data != null) socket.send(data)
    }
    const unsubscribe = () => {
      for (const stop of subscriptions) stop()
      subscriptions = []
      amllAudioError.value = false
    }
    const publish = () => {
      unsubscribe()
      subscriptions.push(watch([() => appSetting['integrations.amllAudio'], isPlay], ([enabled, playing], _, cleanup) => {
        amllAudioError.value = false
        if (!enabled || !playing) return
        const controller = new AbortController()
        cleanup(() => { controller.abort() })
        attachAmllAudio(version, socket, controller.signal).catch(() => {
          if (!controller.signal.aborted) amllAudioError.value = true
        })
      }, { immediate: true }))
      const observe = (sources, update) => { subscriptions.push(watch(sources, update, { immediate: true })) }
      observe([() => musicInfo.id, () => musicInfo.name, () => musicInfo.album, () => musicInfo.singer, () => playProgress.maxPlayTime], () => {
        const current = playMusicInfo.musicInfo
        const track = current && ('progress' in current ? current.metadata.musicInfo : current)
        const id = track?.source === 'local' ? 'local:' + musicInfo.name + '/' + musicInfo.singer : String(musicInfo.id || '')
        send({ update: 'setMusic', musicId: id, musicName: musicInfo.name, albumId: String(track?.meta?.albumId ?? ''), albumName: musicInfo.album, artists: musicInfo.singer.split('、').filter(Boolean).map(name => ({ id: '', name })), duration: ms(playProgress.maxPlayTime) })
      })
      observe(() => musicInfo.pic, pic => send({ update: 'setCover', source: 'uri', url: /^(https?:\/\/|data:image\/)/i.test(pic || '') ? pic : '' }))
      observe([() => musicInfo.id, () => musicInfo.lrc, () => musicInfo.lxlrc, () => musicInfo.tlrc, () => musicInfo.rlrc, () => lyric.offset + lyric.tempOffset, () => playProgress.maxPlayTime], () => {
        send({ update: 'setLyric', format: 'structured', lines: amllLines(musicInfo, ms(playProgress.maxPlayTime), lyric.offset + lyric.tempOffset) })
      })
      observe([isPlay, () => musicInfo.id], () => send({ update: isPlay.value ? 'resumed' : 'paused' }))
      observe(() => playProgress.nowPlayTime, time => send({ update: 'progress', progress: ms(time) }))
      observe([volume, isMute], () => send({ update: 'volume', volume: isMute.value ? 0 : volume.value }))
      observe(() => appSetting['player.togglePlayMethod'], mode => send({ update: 'modeChanged', repeat: mode === 'listLoop' ? 'all' : mode === 'singleLoop' ? 'one' : 'off', shuffle: mode === 'random' }))
    }
    const receive = ({ data }) => {
      const message = amllCommand(data, version)
      switch (message?.command) {
        case 'initialize': publish(); break
        case 'ping': socket.send(version === 'v2' ? '{"type":"pong"}' : Uint8Array.of(1, 0)); break
        case 'pause': pause(); break
        case 'resume': play(); break
        case 'forwardSong': return playNext()
        case 'backwardSong': return playPrev()
        case 'setVolume': if (Number.isFinite(message.volume)) window.app_event.setVolume(Math.min(1, Math.max(0, message.volume))); break
        case 'seekPlayProgress': if (Number.isFinite(message.progress)) window.app_event.setProgress(Math.max(0, Math.min(playProgress.maxPlayTime, message.progress / 1000))); break
        case 'setRepeatMode': if (['all', 'one', 'off'].includes(message.mode)) setTogglePlayMode({ all: 'listLoop', one: 'singleLoop', off: 'list' }[message.mode]); break
        case 'setShuffleMode': if (typeof message.enabled === 'boolean') setTogglePlayMode(message.enabled ? 'random' : 'list'); break
      }
    }
    const connect = () => {
      amllStatus.value = 'receiver_connecting'
      try { socket = new window.WebSocket(url) } catch { amllStatus.value = 'receiver_invalid'; return }
      socket.binaryType = 'arraybuffer'
      socket.onopen = () => {
        amllStatus.value = 'receiver_connected'
        publish()
      }
      socket.onmessage = receive
      socket.onclose = () => {
        unsubscribe()
        if (stopped) return
        amllStatus.value = 'receiver_retry'
        retry = setTimeout(connect, 3000)
      }
    }
    connect()
    cleanup(() => {
      stopped = true
      clearTimeout(retry)
      unsubscribe()
      if (socket) {
        socket.onopen = socket.onmessage = socket.onclose = null
        socket.close()
      }
      amllStatus.value = ''
    })
  }, { immediate: true })
}
