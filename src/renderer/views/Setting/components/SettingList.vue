<template lang="pug">
dt#list {{ $t('setting__list') }}
dd
  .gap-top
    base-checkbox(id="setting_list_actionButtonsVisible_enable" :model-value="appSetting['list.actionButtonsVisible']" :label="$t('setting__list_action_btn')" @update:model-value="updateSetting({'list.actionButtonsVisible': $event})")
  .gap-top
    base-checkbox(id="setting_list_showSource_enable" :model-value="appSetting['list.isShowSource']" :label="$t('setting__list_source')" @update:model-value="updateSetting({'list.isShowSource': $event})")
  .gap-top
    base-checkbox(id="setting_list_scroll_enable" :model-value="appSetting['list.isSaveScrollLocation']" :label="$t('setting__list_scroll')" @update:model-value="updateSetting({'list.isSaveScrollLocation': $event})")
dd
  h3 {{ $t('setting_single_play') }}
  div
    base-checkbox(id="single_play_replace" name="single_play_mode" need :model-value="appSetting['list.singlePlayMode']" value="replace" :label="$t('setting_single_play_replace')" @update:model-value="updateSetting({'list.singlePlayMode': $event})")
    base-checkbox.gap-left(id="single_play_add" name="single_play_mode" need :model-value="appSetting['list.singlePlayMode']" value="add" :label="$t('setting_single_play_add')" @update:model-value="updateSetting({'list.singlePlayMode': $event})")
  p {{ $t('setting_single_play_tip') }}
  .gap-top
    base-checkbox(id="prefer_local" :model-value="appSetting['player.preferLocal']" :label="$t('setting_prefer_local')" @update:model-value="updateSetting({'player.preferLocal': $event})")
  p {{ $t('setting_prefer_local_tip') }}
dd(:aria-label="$t('setting__basic_sourcename_title')")
  h3#list_addMusicLocationType {{ $t('setting__list_add_music_location_type') }}
  div
    base-checkbox.gap-left(
      id="setting_list_add_music_location_type_top" name="setting_list_add_music_location_type" need
      :model-value="appSetting['list.addMusicLocationType']" value="top" :label="$t('setting__list_add_music_location_type_top')"
      @update:model-value="updateSetting({'list.addMusicLocationType': $event})")
    base-checkbox.gap-left(
      id="setting_list_add_music_location_type_bottom" name="setting_list_add_music_location_type" need
      :model-value="appSetting['list.addMusicLocationType']" value="bottom" :label="$t('setting__list_add_music_location_type_bottom')"
      @update:model-value="updateSetting({'list.addMusicLocationType': $event})")

QueuePreferences
</template>

<script>
// import { ref, onBeforeUnmount } from '@common/utils/vueTools'
import { appSetting, updateSetting } from '@renderer/store/setting'
import QueuePreferences from './QueuePreferences.vue'

export default {
  name: 'SettingList',
  components: { QueuePreferences },
  setup() {
    return {
      appSetting,
      updateSetting,
    }
  },
}
</script>
