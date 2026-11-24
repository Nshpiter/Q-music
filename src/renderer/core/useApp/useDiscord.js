import { ref, watch } from '@common/utils/vueTools'
import { discordPresence } from '@common/utils/discordPresence'
import { appSetting } from '@renderer/store/setting'
import { isPlay, musicInfo } from '@renderer/store/player/state'
import { playProgress } from '@renderer/store/player/playProgress'

export const discordStatus = ref('')
export default function useDiscord() {
  watch([() => appSetting['integrations.discord'], () => appSetting['integrations.discordId']], ([enabled, id], _, cleanup) => {
    discordStatus.value = ''
    if (!enabled) return
    if (!/^\d{17,20}$/.test(id)) { discordStatus.value = 'discord_need_id'; return }
    const rpc = discordPresence(id, state => { discordStatus.value = state })
    let start = 0
    const stop = watch([isPlay, () => musicInfo.name, () => musicInfo.singer, () => playProgress.nowPlayTime, () => playProgress.maxPlayTime, () => appSetting['player.playbackRate']], ([playing, title, artist, progress, length, rate]) => {
      if (!playing || !title) { start = 0; rpc.set(null); return }
      const anchor = Math.floor(Date.now() / 1000 - progress / rate)
      if (!start || Math.abs(anchor - start) > 2) start = anchor
      const activity = { type: 2, details: (title.length === 1 ? '♫ ' + title : title).slice(0, 128), timestamps: { start } }
      if (artist) activity.state = (artist.length === 1 ? '♫ ' + artist : artist).slice(0, 128)
      if (length > 0) activity.timestamps.end = Math.ceil(start + length / rate)
      rpc.set(activity)
    }, { immediate: true })
    cleanup(() => { stop(); rpc.close(); discordStatus.value = '' })
  }, { immediate: true })
}
