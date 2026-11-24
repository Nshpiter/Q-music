<template lang="pug">
dt#play_detail {{ $t('setting__play_detail') }}
dd
  lyric-font-setting
  .gap-top
    base-checkbox(id="japanese_font" :model-value="appSetting['playDetail.japaneseFont']" :label="$t('japanese_font')" @update:model-value="updateSetting({ 'playDetail.japaneseFont': $event })")
  .gap-top
    base-checkbox(id="lyric_furigana" :model-value="appSetting['playDetail.furigana']" :label="$t('lyric_furigana')" @update:model-value="updateSetting({ 'playDetail.furigana': $event })")
  .gap-top(v-if="appSetting['playDetail.furigana']")
    label(for="lyric_readings") {{ $t('lyric_readings') }}
    div
      textarea#lyric_readings(rows="3" maxlength="8000" placeholder="明日=あした" :value="appSetting['playDetail.furiganaReadings']" @change="updateSetting({ 'playDetail.furiganaReadings': $event.target.value })")
dd
  lyric-translation
dd
  lyric-dictionaries
dd
  h3#lyric_arrangement {{ $t('lyric_arrangement') }}
  lyric-arrangement
dd
  label(for="lyric_edge_fade") {{ $t('lyric_edge_fade') }} · {{ appSetting['playDetail.lyricEdgeFade'] }}%
  div
    input#lyric_edge_fade(type="range" min="0" max="36" step="1" :value="appSetting['playDetail.lyricEdgeFade']" @input="updateSetting({ 'playDetail.lyricEdgeFade': Number($event.target.value) })")
dd
  .gap-top
    base-checkbox(id="setting_play_detail_font_zoom_enable" :model-value="appSetting['playDetail.isZoomActiveLrc']" :label="$t('setting__play_detail_font_zoom')" @update:model-value="updateSetting({'playDetail.isZoomActiveLrc': $event})")
  .gap-top
    base-checkbox(id="setting_play_detail_lyric_delayScroll" :model-value="appSetting['playDetail.isDelayScroll']" :label="$t('setting__play_detail_lyric_delay_scroll')" @update:model-value="updateSetting({ 'playDetail.isDelayScroll': $event })")
  .gap-top
    base-checkbox(id="setting_play_detail_lyric_progress_enable" :model-value="appSetting['playDetail.isShowLyricProgressSetting']" :label="$t('setting__play_detail_lyric_progress')" @update:model-value="updateSetting({'playDetail.isShowLyricProgressSetting': $event})")

dd
  h3#play_detail_layout {{ $t('setting__play_detail_layout') }}
  div
    base-checkbox.gap-left(id="setting_play_detail_layout_classic" :model-value="appSetting['playDetail.style.layout']" need value="classic" :label="$t('setting__play_detail_layout_classic')" @update:model-value="updateSetting({ 'playDetail.style.layout': $event })")
    base-checkbox.gap-left(id="setting_play_detail_layout_immersive" :model-value="appSetting['playDetail.style.layout']" need value="immersive" :label="$t('setting__play_detail_layout_immersive')" @update:model-value="updateSetting({ 'playDetail.style.layout': $event })")

dd
  h3#play_detail_video {{ $t('detail_video') }}
  .gap-top
    base-checkbox(id="cover_mv" :model-value="appSetting['playDetail.coverMv']" :label="$t('cover_mv')" @update:model-value="updateSetting({ 'playDetail.coverMv': $event })")
  .gap-top
    base-checkbox(id="bilibili_video" :model-value="appSetting['playDetail.bilibiliVideo']" :label="$t('bilibili_video')" @update:model-value="updateSetting({ 'playDetail.bilibiliVideo': $event })")
  div
    base-btn.btn(min @click="chooseVideo") {{ $t('detail_video_select') }}
    template(v-if="appSetting['playDetail.videoBackground']")
      span.gap-left {{ videoName }}
      base-btn.btn.gap-left(min @click="updateSetting({ 'playDetail.videoBackground': '' })") {{ $t('setting__basic_glass_bg_clear') }}
  .gap-top(v-if="appSetting['playDetail.videoBackground']")
    base-checkbox(id="video_transcode" :model-value="appSetting['playDetail.transcodeVideo']" :label="$t('video_transcode')" @update:model-value="updateSetting({ 'playDetail.transcodeVideo': $event })")
    label(for="bg_video_volume") {{ $t('bg_video_volume') }} · {{ appSetting['playDetail.videoVolume'] }}%
    input#bg_video_volume(type="range" min="0" max="100" :value="appSetting['playDetail.videoVolume']" @input="updateSetting({ 'playDetail.videoVolume': Number($event.target.value) })")

dd
  h3#play_detail_visualization {{ $t('setting__play_detail_visualization') }}
  div
    base-checkbox(id="setting_play_detail_visualization_enable" :model-value="appSetting['player.audioVisualization']" :label="$t('setting__play_detail_visualization_enable')" @update:model-value="updateSetting({ 'player.audioVisualization': $event })")
  div.gap-top
    base-checkbox.gap-left(id="setting_play_detail_visualization_ambient" :model-value="appSetting['player.audioVisualizationStyle']" need value="ambient" :label="$t('setting__play_detail_visualization_ambient')" @update:model-value="setVisualizationStyle")
    base-checkbox.gap-left(id="setting_play_detail_visualization_ribbon" :model-value="appSetting['player.audioVisualizationStyle']" need value="ribbon" :label="$t('setting__play_detail_visualization_ribbon')" @update:model-value="setVisualizationStyle")
    base-checkbox.gap-left(id="setting_play_detail_visualization_spectrum" :model-value="appSetting['player.audioVisualizationStyle']" need value="spectrum" :label="$t('setting__play_detail_visualization_spectrum')" @update:model-value="setVisualizationStyle")
  details.gap-top(v-if="appSetting['player.audioVisualization']")
    summary {{ $t('spectrum_options') }}
    label.p.gap-top {{ $t('spectrum_resolution') }}
      select.gap-left(:value="appSetting['player.spectrumResolution']" @change="updateSetting({ 'player.spectrumResolution': $event.target.value })")
        option(value="auto") {{ $t('spectrum_default') }}
        option(value="2048") 2048
        option(value="multi") {{ $t('spectrum_multi') }}
    label.p.gap-top {{ $t('spectrum_response') }}
      select.gap-left(:value="appSetting['player.spectrumResponse']" @change="updateSetting({ 'player.spectrumResponse': $event.target.value })")
        option(value="normal") {{ $t('spectrum_default') }}
        option(value="fast") {{ $t('spectrum_fast') }}
        option(value="slow") {{ $t('spectrum_slow') }}
    .p.gap-top
      base-checkbox(id="spectrum_weighting" :model-value="appSetting['player.spectrumAWeighting']" :label="$t('spectrum_weighting')" @update:model-value="updateSetting({ 'player.spectrumAWeighting': $event })")
    label.p.gap-top(for="spectrum_smoothing") {{ $t('spectrum_smoothing') }} · {{ appSetting['player.spectrumSmoothing'] }}
      input#spectrum_smoothing.gap-left(type="range" min="0" max="8" step="0.25" :value="appSetting['player.spectrumSmoothing']" @change="updateSetting({ 'player.spectrumSmoothing': Number($event.target.value) })")

dd
  h3#play_detail_align {{ $t('setting__play_detail_align') }}
  div
    base-checkbox.gap-left(id="setting_play_detail_align_left" :model-value="appSetting['playDetail.style.align']" need value="left" :label="$t('setting__play_detail_align_left')" @update:model-value="updateSetting({ 'playDetail.style.align': $event })")
    base-checkbox.gap-left(id="setting_play_detail_align_center" :model-value="appSetting['playDetail.style.align']" need value="center" :label="$t('setting__play_detail_align_center')" @update:model-value="updateSetting({ 'playDetail.style.align': $event })")
    base-checkbox.gap-left(id="setting_play_detail_align_right" :model-value="appSetting['playDetail.style.align']" need value="right" :label="$t('setting__play_detail_align_right')" @update:model-value="updateSetting({ 'playDetail.style.align': $event })")

</template>

<script>
// import { ref, onBeforeUnmount } from '@common/utils/vueTools'
import { appSetting, updateSetting } from '@renderer/store/setting'
import LyricFontSetting from '@renderer/components/common/LyricFontSetting.vue'
import LyricArrangement from '@renderer/components/common/LyricArrangement.vue'
import LyricTranslation from './LyricTranslation.vue'
import LyricDictionaries from './LyricDictionaries.vue'
import { computed } from '@common/utils/vueTools'
import { basename } from 'node:path'
import { showSelectDialog } from '@renderer/utils/ipc'
import { useI18n } from '@renderer/plugins/i18n'

export default {
  name: 'SettingPlayDetail',
  components: { LyricFontSetting, LyricArrangement, LyricTranslation, LyricDictionaries },
  setup() {
    const t = useI18n()
    const chooseVideo = async() => {
      const result = await showSelectDialog({
        title: t('detail_video_select'),
        properties: ['openFile'],
        filters: [{ name: t('detail_video'), extensions: ['mp4', 'webm', 'm4v', 'ogv', 'mkv', 'mov', 'avi', 'wmv'] }],
      })
      if (!result.canceled && result.filePaths[0]) updateSetting({ 'playDetail.videoBackground': result.filePaths[0] })
    }
    const setVisualizationStyle = style => {
      if (!style) return
      updateSetting({
        'player.audioVisualization': true,
        'player.audioVisualizationStyle': style,
      })
    }
    return {
      appSetting,
      chooseVideo,
      videoName: computed(() => basename(appSetting['playDetail.videoBackground'] || '')),
      updateSetting,
      setVisualizationStyle,
    }
  },
}
</script>
