<template lang="pug">
dt#play {{ $t('setting__play') }}
dd
  .gap-top
    base-checkbox(id="keyboard_seek" :model-value="appSetting['player.keyboardSeek']" :label="$t('keyboard_seek')" @update:model-value="updateSetting({ 'player.keyboardSeek': $event })")
    p(v-if="appSetting['player.keyboardSeek']" :class="$style.subTip") {{ $t('keyboard_seek_help') }}
  .gap-top(:class="$style.rangeRow")
    label(for="crossfade_seconds") {{ $t('crossfade_seconds') }}
    input#crossfade_seconds(type="range" min="0" max="8" step="1" :value="appSetting['player.crossfadeSeconds']" @input="updateSetting({ 'player.crossfadeSeconds': Number($event.target.value) })")
    span(:class="$style.rangeVal") {{ appSetting['player.crossfadeSeconds'] }} s
  .gap-top
    base-checkbox(id="setting_player_startup_auto_play" :model-value="appSetting['player.startupAutoPlay']" :label="$t('setting__play_startup_auto_play')" @update:model-value="updateSetting({'player.startupAutoPlay': $event})")
  .gap-top
    base-checkbox(id="setting_player_power_save_blocker" :model-value="appSetting['player.powerSaveBlocker']" :label="$t('setting__play_power_save_blocker')" @update:model-value="handleUpdatePowerSaveBlocker")
  .gap-top
    base-checkbox(id="setting_player_save_play_time" :model-value="appSetting['player.isSavePlayTime']" :label="$t('setting__play_save_play_time')" @update:model-value="updateSetting({'player.isSavePlayTime': $event})")
  .gap-top
    base-checkbox(id="setting_player_auto_clean_played_list" :model-value="appSetting['player.isAutoCleanPlayedList']" :label="$t('setting__play_auto_clean_played_list')" @update:model-value="updateSetting({'player.isAutoCleanPlayedList': $event})")
    svg-icon(class="help-icon" name="help-circle-outline" :aria-label="$t('setting__play_auto_clean_played_list_tip')")
  .gap-top
    base-checkbox(id="setting_player_footer_lyric" :model-value="appSetting['player.showFooterLyric']" :label="$t('setting__play_footer_lyric')" @update:model-value="updateSetting({'player.showFooterLyric': $event})")
    div(v-if="appSetting['player.showFooterLyric']" :class="$style.subCard")
      div(:class="$style.inlineRow")
        select(:aria-label="$t('setting__play_footer_lyric')" :value="appSetting['player.footerLyricLanguage']" @change="updateSetting({ 'player.footerLyricLanguage': $event.target.value })")
          option(v-for="kind in ['original', 'translation', 'roman', 'paired']" :key="kind" :value="kind") {{ $t('footer_text_' + kind) }}
        base-checkbox(id="footer_lyric_glass" :model-value="appSetting['player.footerLyricGlass']" :label="$t('footer_lyric_glass')" @update:model-value="updateSetting({ 'player.footerLyricGlass': $event })")
      details
        summary {{ $t('footer_text_style') }}
        div(:class="$style.footerStyles")
          div(v-for="kind in ['original', 'translation', 'roman']" :key="kind" :class="$style.footerStyleRow")
            span(:class="$style.footerKindLabel") {{ $t('footer_text_' + kind) }}
            input(type="range" min="10" max="22" :value="appSetting['player.footerSize.' + kind]" @change="updateSetting({ ['player.footerSize.' + kind]: Number($event.target.value) })")
            span(:class="$style.rangeVal") {{ appSetting['player.footerSize.' + kind] }} px
            base-checkbox(:id="'footer_bold_' + kind" :model-value="appSetting['player.footerBold.' + kind]" :label="$t('footer_bold')" @update:model-value="updateSetting({ ['player.footerBold.' + kind]: $event })")
            base-checkbox(:id="'footer_italic_' + kind" :model-value="appSetting['player.footerItalic.' + kind]" :label="$t('footer_italic')" @update:model-value="updateSetting({ ['player.footerItalic.' + kind]: $event })")
  .gap-top
    base-checkbox(id="setting_player_lyric_transition" :model-value="appSetting['player.isShowLyricTranslation']" :label="$t('setting__play_lyric_transition')" @update:model-value="updateSetting({'player.isShowLyricTranslation': $event})")
  .gap-top
    base-checkbox(id="setting_player_lyric_roma" :model-value="appSetting['player.isShowLyricRoma']" :label="$t('setting__play_lyric_roma')" @update:model-value="updateSetting({'player.isShowLyricRoma': $event})")
  .gap-top
    base-checkbox(id="setting_player_awap_lyric_trans_roma" :model-value="appSetting['player.isSwapLyricTranslationAndRoma']" :label="$t('setting__player_swap_lyric_trans_roma')" @update:model-value="updateSetting({'player.isSwapLyricTranslationAndRoma': $event})")
  .gap-top
    base-checkbox(id="setting_player_auto_skip_on_error" :model-value="appSetting['player.autoSkipOnError']" :label="$t('setting__play_auto_skip_on_error')" @update:model-value="updateSetting({'player.autoSkipOnError': $event})")
  .gap-top
    base-checkbox(id="setting_player_lyric_s2t" :model-value="appSetting['player.isS2t']" :label="$t('setting__play_lyric_s2t')" @update:model-value="updateSetting({'player.isS2t': $event})")
  .gap-top
    base-checkbox(id="setting_player_lyric_play_lxlrc" :model-value="appSetting['player.isPlayLxlrc']" :label="$t('setting__play_lyric_lxlrc')" @update:model-value="updateSetting({'player.isPlayLxlrc': $event})")
    svg-icon(class="help-icon" name="help-circle-outline" :aria-label="$t('setting__play_lyric_lxlrc_tip')")
  .gap-top
    base-checkbox(id="setting_player_showTaskProgess" :model-value="appSetting['player.isShowTaskProgess']" :label="$t('setting__play_task_bar')" @update:model-value="updateSetting({'player.isShowTaskProgess': $event})")
  .gap-top(v-if="isMac")
    base-checkbox(id="setting_player_showStatusBarLyric" :model-value="appSetting['player.isShowStatusBarLyric']" :label="$t('setting__play_statusbar_lyric')" @update:model-value="updateSetting({'player.isShowStatusBarLyric': $event})")
    svg-icon(class="help-icon" name="help-circle-outline" :aria-label="$t('setting__play_statusbar_lyric_tip')")
  .gap-top
    base-checkbox(id="setting_player_isMaxOutputChannelCount" :model-value="isMaxOutputChannelCount" :label="$t('setting__play_max_output_channel_count')" @update:model-value="handleUpdateMaxOutputChannelCount")
  .gap-top
    base-checkbox(id="setting_player_isMediaDeviceRemovedStopPlay" :model-value="appSetting['player.isMediaDeviceRemovedStopPlay']" :label="$t('setting__play_mediaDevice_remove_stop_play')" @update:model-value="updateSetting({'player.isMediaDeviceRemovedStopPlay': $event})")

dd
  h3#basic_play_quality {{ $t('setting__play_playQuality') }}
  div
    base-checkbox.gap-left(
      v-for="item in playQualityList" :id="`setting_play_quality_${item}`" :key="item"
      name="setting_play_quality" need :model-value="appSetting['player.playQuality']" :value="item" :label="item"
      @update:model-value="updateSetting({'player.playQuality': $event})")

playback-fallback-settings

dd(:aria-label="$t('setting__play_mediaDevice_title')")
  h3#play_mediaDevice {{ $t('setting__play_mediaDevice') }}
  div
    base-selection.gap-left(v-model="mediaDeviceId" :list="mediaDevices" item-key="deviceId" item-name="label" @change="handleMediaDeviceIdChnage")
</template>

<script>
import { ref, onBeforeUnmount, watch } from '@common/utils/vueTools'
import { hasInitedAdvancedAudioFeatures, setMediaDeviceId } from '@renderer/plugins/player'
import { dialog } from '@renderer/plugins/Dialog'
import { useI18n } from '@renderer/plugins/i18n'
import { appSetting, saveMediaDeviceId, updateSetting } from '@renderer/store/setting'
import { setPowerSaveBlocker } from '@renderer/core/player/utils'
import { isPlay } from '@renderer/store/player/state'
import { TRY_QUALITYS_LIST } from '@renderer/core/music/utils'
import { isMac } from '@common/utils'
import PlaybackFallbackSettings from './PlaybackFallbackSettings.vue'


export default {
  name: 'SettingPlay',
  components: { PlaybackFallbackSettings },
  setup() {
    const t = useI18n()
    const playQualityList = [...TRY_QUALITYS_LIST, '128k'].reverse()

    const mediaDevices = ref([])
    const getMediaDevice = async() => {
      const devices = await navigator.mediaDevices.enumerateDevices()
      let audioDevices = devices.filter(device => device.kind === 'audiooutput')
      mediaDevices.value = audioDevices
      // console.log(this.mediaDevices)
    }
    void getMediaDevice()

    navigator.mediaDevices.addEventListener('devicechange', getMediaDevice)
    onBeforeUnmount(() => {
      navigator.mediaDevices.removeEventListener('devicechange', getMediaDevice)
    })

    const mediaDeviceId = ref(appSetting['player.mediaDeviceId'])
    const handleMediaDeviceIdChnage = async() => {
      if (hasInitedAdvancedAudioFeatures()) {
        await dialog({
          message: t('setting__play_media_device_error_tip'),
          confirmButtonText: t('alert_button_text'),
        })
        mediaDeviceId.value = appSetting['player.mediaDeviceId']
      } else if (appSetting['player.audioVisualization']) {
        const confirm = await dialog.confirm({
          message: t('setting__play_media_device_tip'),
          cancelButtonText: t('cancel_button_text'),
          confirmButtonText: t('confirm_button_text'),
        })
        if (confirm) {
          updateSetting({
            'player.audioVisualization': false,
            'player.mediaDeviceId': mediaDeviceId.value,
          })
        } else {
          mediaDeviceId.value = appSetting['player.mediaDeviceId']
        }
      } else {
        appSetting['player.mediaDeviceId'] = mediaDeviceId.value
      }
    }
    watch(() => appSetting['player.mediaDeviceId'], val => {
      mediaDeviceId.value = val
    })

    const handleUpdatePowerSaveBlocker = (enabled) => {
      if (enabled) {
        if (isPlay.value) setPowerSaveBlocker(true, true)
      } else {
        setPowerSaveBlocker(false, true)
      }
      updateSetting({ 'player.powerSaveBlocker': enabled })
    }

    const isMaxOutputChannelCount = ref(appSetting['player.isMaxOutputChannelCount'])
    const handleUpdateMaxOutputChannelCount = async(enabled) => {
      isMaxOutputChannelCount.value = enabled
      if (appSetting['player.mediaDeviceId'] != 'default') {
        const confirm = await dialog.confirm({
          message: t('setting__play_advanced_audio_features_tip'),
          cancelButtonText: t('cancel_button_text'),
          confirmButtonText: t('confirm_button_text'),
        })
        if (!confirm) {
          isMaxOutputChannelCount.value = false
          return
        }
        await setMediaDeviceId('default').catch(_ => _)
        saveMediaDeviceId('default')
      }
      updateSetting({ 'player.isMaxOutputChannelCount': enabled })
    }


    return {
      appSetting,
      updateSetting,
      mediaDevices,
      mediaDeviceId,
      handleMediaDeviceIdChnage,
      handleUpdatePowerSaveBlocker,
      isMaxOutputChannelCount,
      handleUpdateMaxOutputChannelCount,
      playQualityList,
      isMac,
    }
  },
}
</script>

<style lang="less" module>
.subTip {
  margin: 6px 0 0 26px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--color-font-label);
}
.rangeRow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
  font-size: 13px;
}
.rangeVal {
  min-width: 3.4em;
  font-size: 12.5px;
  color: var(--color-primary-font);
  font-variant-numeric: tabular-nums;
}
.subCard {
  display: grid;
  gap: 10px;
  margin: 8px 0 4px 24px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--q-surface-soft);
  box-shadow: inset 0 0 0 1px var(--q-outline);
}
.inlineRow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
}
.footerStyles {
  display: grid;
  gap: 10px;
  padding-top: 8px;
}
.footerStyleRow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
}
.footerKindLabel {
  min-width: 4.5em;
  font-size: 13px;
  color: var(--color-font);
}
</style>
