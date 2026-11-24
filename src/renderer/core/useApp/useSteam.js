import { computed, ref, watch } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'
import { isPlay, musicInfo } from '@renderer/store/player/state'
import { playProgress } from '@renderer/store/player/playProgress'
import { steamCommand } from '@renderer/utils/ipc'

export const steamState = ref({ status: 'steam_sign_in', qr: '' })
let revision = 0
export async function steamAction(action) {
  const current = ++revision
  try {
    const state = await steamCommand(action)
    if (current === revision) steamState.value = state
  } catch {
    if (current === revision) steamState.value = { status: 'steam_failed', qr: '' }
  }
}
const formatTime = seconds => Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0')
export const activity = computed(() => {
  if (!musicInfo.name || (!isPlay.value && !appSetting['integrations.steamPaused'])) return ''
  const prefix = [appSetting['integrations.steamPrefix'], !isPlay.value && 'Ⅱ'].filter(Boolean).join(' ')
  const title = [musicInfo.name, appSetting['integrations.steamArtist'] && musicInfo.singer].filter(Boolean).join(' · ')
  const time = appSetting['integrations.steamTime'] && formatTime(Math.floor(playProgress.nowPlayTime / 5) * 5)
  return [prefix, title, time].filter(Boolean).join(' ')
})

export default function useSteam() {
  watch(() => appSetting['integrations.steam'], (enabled, _, cleanup) => {
    if (!enabled) return
    steamAction('enable')
    const stop = watch(activity, text => { steamCommand('activity', text).catch(() => {}) }, { immediate: true })
    cleanup(() => { stop(); steamAction('disable') })
  }, { immediate: true })
}
