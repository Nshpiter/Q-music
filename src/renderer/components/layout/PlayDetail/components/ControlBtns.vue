<template lang="pug">
div(:class="[$style.footerLeftControlBtns, { [$style.detail]: detail }]")
  button(:class="[$style.footerLeftControlBtn, $style.lrcBtn, { [$style.active]: appSetting['desktopLyric.enable'] }]" :aria-label="toggleDesktopLyricBtnTitle" @click="toggleDesktopLyric" @contextmenu="toggleLockDesktopLyric")
    svg(viewBox="0 0 24 24" aria-hidden="true")
      path(d="M5 6h14")
      path(d="M5 11h9")
      path(d="M5 16h6")
      path(d="M16 15.5c1.9 0 3 1 3 2.3s-1.1 2.2-3 2.2-3-1-3-2.2 1.1-2.3 3-2.3z")
      path(d="M19 8v9.6")
  button(:class="[$style.footerLeftControlBtn, $style.appearanceBtn, { [$style.active]: appearanceMenuVisible }]" :aria-label="$t('play_detail_appearance_menu')" @click.stop="showAppearanceMenu")
    svg(viewBox="0 0 24 24" aria-hidden="true")
      path(d="M4 13v-2")
      path(d="M8 16V8")
      path(d="M12 19V5")
      path(d="M16 16V8")
      path(d="M20 13v-2")
    span(:class="$style.menuIndicator" aria-hidden="true")
  button(:class="[$style.footerLeftControlBtn, $style.qualityBtn, { [$style.active]: qualityMenuVisible }]" :aria-label="$t('player__quality_title')" @click.stop="showQualityMenu")
    span(:class="$style.qualityLabel") {{ currentQualityBadge }}
    span(:class="$style.menuIndicator" aria-hidden="true")
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
  //- 面板开关 | 播放设置 | 动作 三组之间的细分隔
  span(:class="$style.toolDivider" aria-hidden="true")
  common-sound-effect-btn
  common-playback-rate-btn
  common-volume-btn
  common-toggle-play-mode-btn
  span(:class="$style.toolDivider" aria-hidden="true")
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
  PlayerAppearanceMenu(
    v-model="appearanceMenuVisible"
    :dark="detail"
    :anchor="appearanceMenuAnchor"
    @select-layout="selectDetailLayout"
    @select-visualization="selectVisualization"
  )
  PlayerQualityMenu(
    v-model="qualityMenuVisible"
    :dark="detail"
    :anchor="qualityMenuAnchor"
    :music-info="currentMusicInfo"
    @select="selectQuality"
    @select-source="selectPlaybackSource"
  )

</template>

<script>
import { computed, onBeforeUnmount, onMounted, ref, watch } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'

import {
  isShowLrcSelectContent,
  isShowPlayComment,
  isShowPlayerDetail,
  playMusicInfo,
  isPlay,
} from '@renderer/store/player/state'
import {
  setShowPlayerDetail,
  setShowPlayLrcSelectContentLrc,
  setShowPlayComment,
} from '@renderer/store/player/action'

import useNextTogglePlay from '@renderer/utils/compositions/useNextTogglePlay'
import useToggleDesktopLyric from '@renderer/utils/compositions/useToggleDesktopLyric'
import { dialog } from '@renderer/plugins/Dialog'
import { getCurrentTime, onCanplay, setCurrentTime, setMediaDeviceId, setPause, setPlay } from '@renderer/plugins/player'
import { setMusicUrl } from '@renderer/core/player/action'
import { appSetting, saveMediaDeviceId, updateSetting } from '@renderer/store/setting'
import { addListMusics, checkListExistMusic, removeListMusics } from '@renderer/store/list/action'
import { loveList } from '@renderer/store/list/state'
import PlayerAppearanceMenu from './PlayerAppearanceMenu.vue'
import PlayerQualityMenu from './PlayerQualityMenu.vue'

export default {
  components: { PlayerAppearanceMenu, PlayerQualityMenu },
  props: {
    detail: Boolean,
  },
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
    const appearanceMenuVisible = ref(false)
    const qualityMenuVisible = ref(false)
    const appearanceMenuAnchor = ref(null)
    const qualityMenuAnchor = ref(null)
    const isLoveMusic = ref(false)
    const isTogglingLove = ref(false)
    let loveCheckId = 0
    let cancelQualityResume = null
    let qualityResumeTimeout = null

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
      cancelQualityResume?.()
      if (qualityResumeTimeout) clearTimeout(qualityResumeTimeout)
    })

    const ensureVisualizationAudioDevice = async() => {
      if (appSetting['player.mediaDeviceId'] != 'default') {
        const confirm = await dialog.confirm({
          message: t('setting__player_audio_visualization_tip'),
          cancelButtonText: t('cancel_button_text'),
          confirmButtonText: t('confirm_button_text'),
        })
        if (!confirm) return false
        await setMediaDeviceId('default').catch(_ => _)
        saveMediaDeviceId('default')
      }
      return true
    }
    const getMenuAnchor = event => {
      const rect = event.currentTarget.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top }
    }
    const showAppearanceMenu = event => {
      qualityMenuVisible.value = false
      appearanceMenuAnchor.value = getMenuAnchor(event)
      appearanceMenuVisible.value = !appearanceMenuVisible.value
    }
    const currentQualityBadge = computed(() => ({
      '128k': 'STD',
      '320k': 'HQ',
      flac: 'SQ',
      flac24bit: 'Hi-Res',
    })[appSetting['player.playQuality']] ?? 'HQ')
    const showQualityMenu = event => {
      appearanceMenuVisible.value = false
      qualityMenuAnchor.value = getMenuAnchor(event)
      qualityMenuVisible.value = !qualityMenuVisible.value
    }
    const reloadCurrentMusic = quality => {
      const musicInfo = playMusicInfo.musicInfo
      const position = getCurrentTime()
      const shouldResume = isPlay.value
      if (!musicInfo || 'progress' in musicInfo || musicInfo.source == 'local') return

      cancelQualityResume?.()
      if (qualityResumeTimeout) clearTimeout(qualityResumeTimeout)
      const musicId = musicInfo.id
      cancelQualityResume = onCanplay(() => {
        cancelQualityResume?.()
        cancelQualityResume = null
        if (qualityResumeTimeout) clearTimeout(qualityResumeTimeout)
        qualityResumeTimeout = null
        if (playMusicInfo.musicInfo?.id != musicId) return
        setCurrentTime(position)
        shouldResume ? setPlay() : setPause()
      })
      qualityResumeTimeout = setTimeout(() => {
        cancelQualityResume?.()
        cancelQualityResume = null
        qualityResumeTimeout = null
      }, 20_000)
      setPause()
      window.app_event.pause()
      setMusicUrl(musicInfo, true, quality)
    }
    const selectQuality = quality => {
      if (appSetting['player.playQuality'] == quality) return
      updateSetting({ 'player.playQuality': quality })
      reloadCurrentMusic(quality)
    }
    const selectPlaybackSource = musicInfo => {
      const current = currentMusicInfo.value
      if (!current || current.source == 'local') return
      const currentSource = current.meta.toggleMusicInfo?.source ?? current.source
      const nextSource = musicInfo?.source ?? current.source
      if (currentSource == nextSource) return
      current.meta.toggleMusicInfo = musicInfo
      reloadCurrentMusic(appSetting['player.playQuality'])
    }
    const selectDetailLayout = layout => {
      updateSetting({ 'playDetail.style.layout': layout })
    }
    const selectVisualization = async(style) => {
      if (style == 'off') {
        updateSetting({ 'player.audioVisualization': false })
        return
      }
      if (!await ensureVisualizationAudioDevice()) return
      updateSetting({
        'player.audioVisualization': true,
        'player.audioVisualizationStyle': style,
      })
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
      appearanceMenuVisible,
      appearanceMenuAnchor,
      showAppearanceMenu,
      selectDetailLayout,
      selectVisualization,
      qualityMenuVisible,
      qualityMenuAnchor,
      currentQualityBadge,
      showQualityMenu,
      selectQuality,
      selectPlaybackSource,
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
  --q-footer-tool-size: 30px;
  width: 100%;
  display: flex;
  flex-flow: row nowrap;
  justify-content: flex-end;
  align-items: center;
  gap: 3px;
  height: 64px;
  padding: 4px 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;

  button {
    flex: none;
    width: var(--q-footer-tool-size);
    height: var(--q-footer-tool-size);
    color: var(--color-font);
    border-radius: 50%;
    opacity: .74;
    transition: opacity @transition-normal, color @transition-fast, background-color @transition-fast, transform @transition-fast;

    &:hover {
      opacity: 1;
      color: var(--color-primary-font);
      background-color: var(--q-icon-btn-hover-bg) !important;
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
      color: var(--color-primary-font);
      background-color: var(--q-icon-btn-hover-bg);
    }

    &.active {
      color: var(--color-primary);
      opacity: 1;
      background-color: var(--color-primary-alpha-800);
      box-shadow: 0 8px 18px var(--color-primary-alpha-800);
    }
  }

  .toolDivider {
    flex: none;
    width: 1px;
    height: 14px;
    margin: 0 4px;
    border-radius: 1px;
    background: rgb(from var(--color-font) r g b / .16);
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

  .appearanceBtn {
    position: relative;
  }

  .qualityBtn {
    position: relative;
  }

  .qualityLabel {
    font-size: 8px;
    font-weight: 800;
    letter-spacing: -.02em;
    white-space: nowrap;
  }

  .menuIndicator {
    position: absolute;
    right: 1px;
    bottom: 2px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: currentColor;
    opacity: .72;
  }

  :global {
    .material-popup-btn,
    .popup-btn {
      height: var(--q-footer-tool-size);
    }
  }
}

.detail {
  height: 46px;
  padding: 0;
  gap: 2px;

  button {
    width: 32px;
    height: 32px;
    color: rgba(255, 255, 255, .82);

    &:hover {
      color: #fff;
      background-color: rgba(255, 255, 255, .2) !important;
      box-shadow: 0 8px 20px rgba(0, 0, 0, .18);
    }
  }

  .footerLeftControlBtn.active {
    color: rgba(20, 24, 27, .96);
    background-color: rgba(255, 255, 255, .94);
    box-shadow: 0 10px 24px rgba(0, 0, 0, .24), inset 0 1px 0 #fff;

    &:hover {
      color: rgba(10, 14, 17, 1);
      background-color: #fff !important;
    }
  }

  .toolDivider {
    background: rgba(255, 255, 255, .18);
  }
}

@media (max-width: 1280px) {
  .footerLeftControlBtns {
    --q-footer-tool-size: 28px;
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

@media (max-width: 980px) {
  .footerLeftControlBtns {
    --q-footer-tool-size: 24px;
    gap: 1px;
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
