import { watch } from '@common/utils/vueTools'
import { setLyric, setVertical, setPlaybackRate } from '@lyric/core/lyric'
import { getStatus } from '@lyric/core/mainWindowChannel'
import { isPlay, musicInfo, setting } from '@lyric/store/state'
import { lyric } from '@lyric/store/lyric'
import { hasDisplayLyrics } from '@common/utils/lyricStatus'
import { setEmptyHidden } from '@lyric/utils/ipc'
import useFurigana from '../../renderer/utils/compositions/useFurigana'

export default () => {
  useFurigana(lyric, setting, () => window.dispatchEvent(new Event('lyric-layout-updated')))
  watch(() => (setting['desktopLyric.hideEmpty'] && !hasDisplayLyrics(lyric.lines, musicInfo.name)) ||
    (setting['desktopLyric.hidePausedWindow'] && !isPlay.value), setEmptyHidden, { immediate: true })
  watch(() => setting['player.isShowLyricTranslation'], setLyric)
  watch(() => setting['player.isShowLyricRoma'], setLyric)
  watch(() => setting['player.isSwapLyricTranslationAndRoma'], setLyric)
  watch(() => setting['player.isPlayLxlrc'], setLyric)
  watch(() => setting['player.playbackRate'], (rate) => {
    setPlaybackRate(rate)
    if (isPlay.value) {
      setTimeout(() => {
        getStatus()
      })
    }
  })
  watch(() => setting['desktopLyric.direction'], (direction) => {
    setVertical(direction == 'vertical')
    // if (isPlay.value)
  })
}
