<template lang="pug">
div(:class="$style.footerLeftControlBtns")
  button(:class="[$style.footerLeftControlBtn, $style.lrcBtn, { [$style.active]: appSetting['desktopLyric.enable'] }]" :aria-label="toggleDesktopLyricBtnTitle" @click="toggleDesktopLyric" @contextmenu="toggleLockDesktopLyric")
    svg(viewBox="0 0 24 24" aria-hidden="true")
      path(d="M5 6h14")
      path(d="M5 11h9")
      path(d="M5 16h6")
      path(d="M16 15.5c1.9 0 3 1 3 2.3s-1.1 2.2-3 2.2-3-1-3-2.2 1.1-2.3 3-2.3z")
      path(d="M19 8v9.6")
  button(:class="[$style.footerLeftControlBtn, { [$style.active]: appSetting['player.audioVisualization'] }]" :aria-label="$t('audio_visualization')" @click="toggleAudioVisualization")
    svg(viewBox="0 0 24 24" aria-hidden="true")
      path(d="M4 13v-2")
      path(d="M8 16V8")
      path(d="M12 19V5")
      path(d="M16 16V8")
      path(d="M20 13v-2")
  button(:class="[$style.footerLeftControlBtn, { [$style.active]: isShowLrcSelectContent }]" :aria-label="$t('lyric__select')" @click="toggleVisibleLrc")
    svg(viewBox="0 0 24 24" aria-hidden="true")
      path(d="M6 7h12")
      path(d="M6 12h12")
      path(d="M6 17h8")
  button(:class="[$style.footerLeftControlBtn, {[$style.active]: isShowPlayComment}]" :aria-label="$t('comment__show')" @click="toggleVisibleComment")
    svg(viewBox="0 0 24 24" aria-hidden="true")
      path(d="M6.5 6.5h11a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2h-6l-4.2 3v-3h-.8a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2z")
      path(d="M8 10h8")
      path(d="M8 13h5")
  common-sound-effect-btn
  common-playback-rate-btn
  common-volume-btn
  common-toggle-play-mode-btn
  button(
    :class="[$style.footerLeftControlBtn, $style.loveBtn, { [$style.loved]: isLoveMusic, [$style.pending]: isTogglingLove }]"
    :aria-label="isLoveMusic ? $t('setting__hot_key_player_music_unlove') : $t('setting__hot_key_player_music_love')"
    :disabled="isLoveDisabled"
    @click="toggleLoveMusic"
    @contextmenu.prevent="showAddMusicTo"
  )
    svg(viewBox="0 0 24 24" aria-hidden="true")
      path(:class="$style.heartFill" d="M12 20s-7-4.2-7-9a4 4 0 0 1 7-2.7A4 4 0 0 1 19 11c0 4.8-7 9-7 9z")
      path(v-if="!isLoveMusic" d="M18 17v4")
      path(v-if="!isLoveMusic" d="M16 19h4")
  common-list-add-modal(v-model:show="isShowAddMusicTo" :music-info="currentMusicInfo")

</template>

<script>
import { computed, onBeforeUnmount, onMounted, ref, watch } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'

import {
  isShowLrcSelectContent,
  isShowPlayComment,
  isShowPlayerDetail,
  playMusicInfo,
} from '@renderer/store/player/state'
import {
  setShowPlayerDetail,
  setShowPlayLrcSelectContentLrc,
  setShowPlayComment,
} from '@renderer/store/player/action'

import useNextTogglePlay from '@renderer/utils/compositions/useNextTogglePlay'
import useToggleDesktopLyric from '@renderer/utils/compositions/useToggleDesktopLyric'
import { dialog } from '@renderer/plugins/Dialog'
import { setMediaDeviceId } from '@renderer/plugins/player'
import { appSetting, saveMediaDeviceId, setEnableAudioVisualization } from '@renderer/store/setting'
import { addListMusics, checkListExistMusic, removeListMusics } from '@renderer/store/list/action'
import { loveList } from '@renderer/store/list/state'

export default {
  setup() {
    const t = useI18n()
    // const setting = useRefGetter('setting')
    // const setAudioVisualization = useCommit('setAudioVisualization')
    // const saveMediaDeviceId = useCommit('setMediaDeviceId')

    const toggleVisibleLrc = () => {
      if (!isShowPlayerDetail.value) setShowPlayerDetail(true)
      setShowPlayLrcSelectContentLrc(!isShowLrcSelectContent.value)
    }
    const toggleVisibleComment = () => {
      if (!isShowPlayerDetail.value) setShowPlayerDetail(true)
      setShowPlayComment(!isShowPlayComment.value)
    }
    const {
      nextTogglePlayName,
      toggleNextPlayMode,
    } = useNextTogglePlay()

    const {
      toggleDesktopLyricBtnTitle,
      toggleDesktopLyric,
      toggleLockDesktopLyric,
    } = useToggleDesktopLyric()

    const isShowAddMusicTo = ref(false)
    const isLoveMusic = ref(false)
    const isTogglingLove = ref(false)
    let loveCheckId = 0

    const currentMusicInfo = computed(() => {
      const info = playMusicInfo.musicInfo
      if (!info) return null
      return 'progress' in info ? info.metadata.musicInfo : info
    })
    const isLoveDisabled = computed(() => !currentMusicInfo.value || isTogglingLove.value)

    const refreshLoveStatus = async() => {
      const musicInfo = currentMusicInfo.value
      const checkId = ++loveCheckId
      if (!musicInfo) {
        isLoveMusic.value = false
        return
      }

      const status = await checkListExistMusic(loveList.id, musicInfo.id).catch(() => false)
      if (checkId != loveCheckId || currentMusicInfo.value?.id != musicInfo.id) return
      isLoveMusic.value = status
    }

    const toggleLoveMusic = async() => {
      const musicInfo = currentMusicInfo.value
      if (!musicInfo || isTogglingLove.value) return

      const nextStatus = !isLoveMusic.value
      isTogglingLove.value = true
      isLoveMusic.value = nextStatus
      try {
        if (nextStatus) {
          await addListMusics(loveList.id, [musicInfo])
        } else {
          await removeListMusics({ listId: loveList.id, ids: [musicInfo.id] })
        }
        await refreshLoveStatus()
      } catch (_) {
        isLoveMusic.value = !nextStatus
      } finally {
        isTogglingLove.value = false
      }
    }

    const showAddMusicTo = () => {
      if (!currentMusicInfo.value) return
      isShowAddMusicTo.value = true
    }

    const handleMyListUpdate = listIds => {
      if (!listIds.includes(loveList.id)) return
      void refreshLoveStatus()
    }

    watch(() => currentMusicInfo.value?.id, () => {
      void refreshLoveStatus()
    }, { immediate: true })

    onMounted(() => {
      window.app_event.on('myListUpdate', handleMyListUpdate)
    })
    onBeforeUnmount(() => {
      window.app_event.off('myListUpdate', handleMyListUpdate)
    })

    const toggleAudioVisualization = async() => {
      const newSetting = !appSetting['player.audioVisualization']
      if (newSetting && appSetting['player.mediaDeviceId'] != 'default') {
        const confirm = await dialog.confirm({
          message: t('setting__player_audio_visualization_tip'),
          cancelButtonText: t('cancel_button_text'),
          confirmButtonText: t('confirm_button_text'),
        })
        if (!confirm) return
        await setMediaDeviceId('default').catch(_ => _)
        saveMediaDeviceId('default')
      }
      setEnableAudioVisualization(newSetting)
    }

    return {
      appSetting,
      isShowLrcSelectContent,
      toggleVisibleLrc,
      isShowPlayComment,
      toggleVisibleComment,
      nextTogglePlayName,
      toggleNextPlayMode,
      toggleDesktopLyricBtnTitle,
      toggleDesktopLyric,
      toggleLockDesktopLyric,
      toggleAudioVisualization,
      isShowAddMusicTo,
      playMusicInfo,
      currentMusicInfo,
      isLoveMusic,
      isLoveDisabled,
      isTogglingLove,
      toggleLoveMusic,
      showAddMusicTo,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.footerLeftControlBtns {
  --q-footer-tool-size: 34px;
  width: 100%;
  display: flex;
  flex-flow: row nowrap;
  justify-content: center;
  align-items: center;
  gap: 6px;
  height: 64px;
  padding: 4px 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;

  button {
    width: var(--q-footer-tool-size);
    height: var(--q-footer-tool-size);
    color: rgba(29, 34, 38, .7);
    border-radius: 50%;
    opacity: .82;
    transition: opacity @transition-normal, color @transition-fast, background-color @transition-fast, transform @transition-fast;

    &:hover {
      opacity: 1;
      color: rgba(29, 34, 38, .9);
      background-color: rgba(29, 34, 38, .06) !important;
    }

    &:active {
      transform: scale(.94);
    }

    &:disabled {
      cursor: default;
      opacity: .45;
      transform: none;
    }

    svg {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      filter: none;
      opacity: 1;
    }
  }

  .footerLeftControlBtn {
    // width: 18px;
    // height: 18px;
    opacity: .8;
    cursor: pointer;
    transition: opacity @transition-normal, color @transition-fast, background-color @transition-fast, transform @transition-fast;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: transparent;
    border: none;
    padding: 0;
    border-radius: 50%;

    &:hover {
      opacity: 1;
      color: rgba(29, 34, 38, .9);
      background-color: rgba(29, 34, 38, .06);
    }

    &.active {
      color: #6374ff;
      opacity: 1;
      background-color: rgba(99, 116, 255, .12);
      box-shadow: 0 8px 18px rgba(99, 116, 255, .1);
    }
  }

  .loveBtn {
    .heartFill {
      fill: transparent;
      transition: fill @transition-fast, stroke @transition-fast;
    }

    &.loved {
      color: #ff4f76;
      opacity: 1;
      background-color: rgba(255, 79, 118, .12);
      box-shadow: 0 8px 18px rgba(255, 79, 118, .12);

      .heartFill {
        fill: currentColor;
        stroke: currentColor;
      }
    }

    &.pending {
      pointer-events: none;
    }
  }

  .lrcBtn {
    width: var(--q-footer-tool-size);
  }

  :global {
    .material-popup-btn,
    .popup-btn {
      height: var(--q-footer-tool-size);
    }
  }
}

@media (max-width: 1280px) {
  .footerLeftControlBtns {
    --q-footer-tool-size: 30px;
    gap: 3px;
    height: 64px;
    padding: 4px 0;

    button {
      width: var(--q-footer-tool-size);
      height: var(--q-footer-tool-size);
    }

    .lrcBtn {
      width: var(--q-footer-tool-size);
    }

    :global {
      .material-popup-btn,
      .popup-btn {
        height: var(--q-footer-tool-size);
      }
    }
  }
}

@media (max-width: 980px) {
  .footerLeftControlBtns {
    --q-footer-tool-size: 26px;
    gap: 2px;
    height: 64px;
    padding: 4px 0;

    button {
      width: var(--q-footer-tool-size);
      height: var(--q-footer-tool-size);
    }

    .lrcBtn {
      width: var(--q-footer-tool-size);
    }

    :global {
      .material-popup-btn,
      .popup-btn {
        height: var(--q-footer-tool-size);
      }
    }
  }
}

</style>
