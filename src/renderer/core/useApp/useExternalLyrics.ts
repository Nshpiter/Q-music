import { onBeforeUnmount, ref, watch } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'
import { isPlay, musicInfo } from '@renderer/store/player/state'
import { lyric } from '@renderer/store/player/lyric'
import { playProgress } from '@renderer/store/player/playProgress'
import { setDisableAutoPauseBySource } from '@renderer/core/lyric'

export const receiverState = { island: ref(''), screen: ref('') }
type Receiver = keyof typeof receiverState

const address = (target: Receiver) => {
  if (target == 'island') return 'http://127.0.0.1:50063/component/lyrics/lyrics/'
  const host = appSetting['integrations.keyboardHost'].trim()
  if (!host || !/^[\w.:[\]-]+$/.test(host)) throw new Error('invalid_host')
  return new URL('/music', `http://${host}`).href
}
const fit = (value: string, max: number) => {
  const bytes = new TextEncoder().encode(value)
  if (bytes.length <= max) return value
  return new TextDecoder().decode(bytes.slice(0, max)).replace(/\uFFFD$/, '')
}
const payload = (target: Receiver, clear: boolean) => {
  const active = !clear && !!musicInfo.id
  const playing = active && isPlay.value
  const current = lyric.lines[lyric.line]
  const next = lyric.lines[lyric.line + 1]?.text || ''
  if (target == 'island') {
    return {
      basic: playing ? lyric.text || musicInfo.name : '',
      extra: playing ? (lyric.text ? current?.extendedLyrics?.[0] || next : musicInfo.singer) : '',
    }
  }
  if (!active) return { active, playing }
  return {
    active,
    playing,
    title: fit(musicInfo.name, 92),
    artist: fit(musicInfo.singer, 76),
    lyric: fit(lyric.text || '', 188),
    next: fit(next, 188),
    position_ms: Math.max(0, Math.round(playProgress.nowPlayTime * 1000)),
    duration_ms: Math.max(0, Math.round(playProgress.maxPlayTime * 1000)),
  }
}

const send = async(target: Receiver, url: string, body: string, signal: AbortSignal) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': target == 'island' ? 'application/json' : 'text/plain;charset=UTF-8' },
    credentials: 'omit',
    redirect: 'error',
    referrerPolicy: 'no-referrer',
    body,
    signal,
  })
  if (!response.ok) throw new Error(String(response.status))
}

export default () => {
  const ready = ref(false)
  for (const target of ['island', 'screen'] as const) {
    const enabled = () => target == 'island' ? appSetting['integrations.lyricsIsland'] : appSetting['integrations.keyboardScreen']
    watch(() => [ready.value && enabled(), target == 'screen' ? appSetting['integrations.keyboardHost'] : ''], (_, __, cleanup) => {
      if (!ready.value || !enabled()) return
      let url: string
      try { url = address(target) } catch {
        receiverState[target].value = 'receiver_invalid'
        return
      }
      const controller = new AbortController()
      let timer: ReturnType<typeof setTimeout>
      let previous = ''
      let lastSent = 0
      const tick = async() => {
        let delay = 250
        try {
          const data = JSON.stringify(payload(target, false))
          if (receiverState[target].value != 'receiver_connected' || previous !== data || Date.now() - lastSent >= 5000) {
            previous = data
            lastSent = Date.now()
            await send(target, url, data, AbortSignal.any([controller.signal, AbortSignal.timeout(1800)]))
            if (controller.signal.aborted) return
            receiverState[target].value = 'receiver_connected'
          }
        } catch {
          if (controller.signal.aborted) return
          receiverState[target].value = 'receiver_retry'
          delay = 3000
        }
        if (!controller.signal.aborted) timer = setTimeout(() => { void tick() }, delay)
      }
      receiverState[target].value = 'receiver_connecting'
      setDisableAutoPauseBySource(true, target)
      void tick()
      cleanup(() => {
        controller.abort()
        clearTimeout(timer)
        setDisableAutoPauseBySource(false, target)
        receiverState[target].value = ''
        void send(target, url, JSON.stringify(payload(target, true)), AbortSignal.timeout(1200)).catch(() => {})
      })
    }, { immediate: true })
  }
  onBeforeUnmount(() => { ready.value = false })
  return () => { ready.value = true }
}
