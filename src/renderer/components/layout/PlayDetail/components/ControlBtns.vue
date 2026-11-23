<template lang="pug">
div(:class="[$style.footerLeftControlBtns, { [$style.detail]: detail }]")
  button.q-player-tool(v-if="isShowPlayerDetail && musicInfo.tlrc" :aria-label="$t('setting__play_lyric_transition')" :aria-pressed="appSetting['player.isShowLyricTranslation']" :title="$t('setting__play_lyric_transition')" @click="toggleTranslation")
    svg(viewBox="0 0 24 24" aria-hidden="true")
      path(d="M3.5 7h11M9 4v3m3.5 0c-1.1 4.1-3.7 7.2-8 9.5M6 10c1.2 2.4 3 4.4 5.3 5.9m1.4 3.7L17 9l4.3 10.6m-7.1-3.4h5.6")
  button.q-player-tool(:aria-label="toggleDesktopLyricBtnTitle" :aria-pressed="appSetting['desktopLyric.enable']" @click="toggleDesktopLyric" @contextmenu="toggleLockDesktopLyric")
    svg(viewBox="0 0 24 24" aria-hidden="true")
      path(d="M4 5.5h16M4 11h9m-9 5.5h5m10.5-.2V9")
      ellipse(cx="16.7" cy="17.4" rx="2.8" ry="2.1")
  button.q-player-tool(:aria-label="$t('play_detail_appearance_menu')" :aria-expanded="appearanceMenuVisible" @click.stop="showAppearanceMenu")
    svg(viewBox="0 0 24 24" aria-hidden="true")
      path(d="M4 10.5v3m4-6v9m4-12v15m4-12v9m4-6v3")
  button.q-player-tool(:class="$style.qualityBtn" :aria-label="$t('player__quality_title')" :aria-expanded="qualityMenuVisible" @click.stop="showQualityMenu")
    span(:class="$style.qualityLabel") {{ currentQualityBadge }}
  button.q-player-tool(:aria-label="$t('lyric__select')" :aria-pressed="isShowLrcSelectContent" @click="toggleVisibleLrc")
    svg(viewBox="0 0 24 24" aria-hidden="true")
      rect(x="3.5" y="5.5" width="17" height="13" rx="2.5")
      path(d="M7 10h10M7 14h6")
  button.q-player-tool(:aria-label="$t('comment__show')" :aria-pressed="isShowPlayComment" @click="toggleVisibleComment")
    svg(viewBox="0 0 24 24" aria-hidden="true")
      path(d="M6.5 4.8h11a3 3 0 0 1 3 3v6.5a3 3 0 0 1-3 3h-6.2l-4.8 3v-3a3 3 0 0 1-3-3V7.8a3 3 0 0 1 3-3Z")
      path(d="M8 10.8h8")
  span(:class="[$style.toolDivider, $style.panelDivider]" aria-hidden="true")
  common-sound-effect-btn
  common-playback-rate-btn
  common-volume-btn
  common-toggle-play-mode-btn
  span(:class="$style.toolDivider" aria-hidden="true")
  button.q-player-tool(:aria-label="downloadTitle" :title="downloadTitle" :disabled="isDownloadDisabled || downloadOpening" @click.stop="showCurrentDownload")
    svg(viewBox="0 0 24 24" aria-hidden="true")
      path(d="M12 4v10.5m-4-4 4 4 4-4M4.5 16v3.5h15V16")
  common-download-modal(v-if="downloadMusicInfo" v-model:show="downloadVisible" :music-info="downloadMusicInfo")
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
import { computed, onBeforeUnmount, ref } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'

import {
  isShowLrcSelectContent,
  isShowPlayComment,
  isShowPlayerDetail,
  musicInfo,
  playMusicInfo,
  playbackSourceInfo,
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
    const toggleTranslation = () => {
      updateSetting({ 'player.isShowLyricTranslation': !appSetting['player.isShowLyricTranslation'] })
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

    const appearanceMenuVisible = ref(false)
    const qualityMenuVisible = ref(false)
    const appearanceMenuAnchor = ref(null)
    const qualityMenuAnchor = ref(null)
    let cancelQualityResume = null
    let qualityResumeTimeout = null

    const currentMusicInfo = computed(() => {
      const info = playMusicInfo.musicInfo
      if (!info) return null
      return 'progress' in info ? info.metadata.musicInfo : info
    })
    const downloadVisible = ref(false)
    const downloadOpening = ref(false)
    const downloadMusicInfo = ref(null)
    const isLocalPlayback = computed(() => currentMusicInfo.value?.source == 'local' || (!!playMusicInfo.musicInfo && 'progress' in playMusicInfo.musicInfo))
    const isDownloadDisabled = computed(() => !currentMusicInfo.value || isLocalPlayback.value)
    const downloadTitle = computed(() => t(isLocalPlayback.value ? 'player_download_local' : 'player_download_current'))
    const showCurrentDownload = async() => {
      if (isDownloadDisabled.value || downloadOpening.value) return
      // 保留点击时的歌曲，弹窗期间切歌不会改变待下载对象。
      const selected = JSON.parse(JSON.stringify(currentMusicInfo.value))
      downloadOpening.value = true
      try {
        if (!appSetting['download.enable']) {
          if (!await dialog.confirm({ message: t('player_download_enable'), confirmButtonText: t('player_download_enable_confirm') })) return
          updateSetting({ 'download.enable': true })
        }
        downloadMusicInfo.value = selected
        downloadVisible.value = true
      } finally { downloadOpening.value = false }
    }

    onBeforeUnmount(() => {
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
      if (appSetting['player.playQuality'] == quality && (!playbackSourceInfo.value || playbackSourceInfo.value.quality == quality)) return
      updateSetting({ 'player.playQuality': quality })
      reloadCurrentMusic(quality)
    }
    const selectPlaybackSource = musicInfo => {
      const current = currentMusicInfo.value
      if (!current || current.source == 'local') return
      const original = current
      const selected = musicInfo ?? null
      const currentToggle = current.meta.toggleMusicInfo
      const isOriginalSelection = selected && selected.source == original.source && selected.id == original.id
      // 选择原始平台（或再次点当前平台）应清掉显式覆盖；不能只比较
      // source，否则同一平台的不同歌曲会被误判为“无需切换”。
      if (!selected || isOriginalSelection) {
        if (!currentToggle && (!playbackSourceInfo.value || playbackSourceInfo.value.resolvedSource == original.source)) return
        current.meta.toggleMusicInfo = null
      } else {
        if (currentToggle?.source == selected.source && currentToggle?.id == selected.id && playbackSourceInfo.value?.resolvedSource == selected.source) return
        current.meta.toggleMusicInfo = selected
      }
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
      downloadVisible,
      downloadOpening,
      downloadMusicInfo,
      isDownloadDisabled,
      downloadTitle,
      showCurrentDownload,
      isShowLrcSelectContent,
      toggleVisibleLrc,
      toggleTranslation,
      isShowPlayerDetail,
      musicInfo,
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
      playMusicInfo,
      currentMusicInfo,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.footerLeftControlBtns {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--q-footer-tool-gap);
}

.qualityBtn {
  // 按最长的 Hi-Res 预留点击区域，边框由内部标签随文字撑开。
  font-size: 9px;
  min-width: 4.1em;
}
.qualityLabel {
  display: grid;
  place-items: center;
  height: 15px;
  padding: 0 2px;
  box-sizing: border-box;
  border: 1.4px solid currentColor;
  border-radius: 4px;
  font-family: Arial, sans-serif;
  font-size: inherit;
  font-weight: 650;
  line-height: 1;
  white-space: nowrap;
}

.toolDivider {
  flex: none;
  width: 1px;
  height: 14px;
  margin: 0 3px;
  background: currentColor;
  opacity: .18;
}

@media (max-width: 1100px) {
  .footerLeftControlBtns:not(.detail) .toolDivider { display: none; }
  .footerLeftControlBtns:not(.detail) .panelDivider {
    display: block;
    flex-basis: 100%;
    height: 0;
    margin: 0;
  }
}

</style>
