<template lang="pug">
dt#play_detail {{ $t('setting__play_detail') }}
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
  h3#play_detail_visualization {{ $t('setting__play_detail_visualization') }}
  div
    base-checkbox(id="setting_play_detail_visualization_enable" :model-value="appSetting['player.audioVisualization']" :label="$t('setting__play_detail_visualization_enable')" @update:model-value="updateSetting({ 'player.audioVisualization': $event })")
  div.gap-top
    base-checkbox.gap-left(id="setting_play_detail_visualization_ambient" :model-value="appSetting['player.audioVisualizationStyle']" need value="ambient" :label="$t('setting__play_detail_visualization_ambient')" @update:model-value="setVisualizationStyle")
    base-checkbox.gap-left(id="setting_play_detail_visualization_ribbon" :model-value="appSetting['player.audioVisualizationStyle']" need value="ribbon" :label="$t('setting__play_detail_visualization_ribbon')" @update:model-value="setVisualizationStyle")
    base-checkbox.gap-left(id="setting_play_detail_visualization_spectrum" :model-value="appSetting['player.audioVisualizationStyle']" need value="spectrum" :label="$t('setting__play_detail_visualization_spectrum')" @update:model-value="setVisualizationStyle")

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

export default {
  name: 'SettingPlayDetail',
  setup() {
    const setVisualizationStyle = style => {
      if (!style) return
      updateSetting({
        'player.audioVisualization': true,
        'player.audioVisualizationStyle': style,
      })
    }
    return {
      appSetting,
      updateSetting,
      setVisualizationStyle,
    }
  },
}
</script>
