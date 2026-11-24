<template lang="pug">
dt#sync {{ $t('setting__open_api') }}
dd.gap-top
  div
    .p
      base-checkbox(id="setting_open_api_enable" :model-value="appSetting['openAPI.enable']" :label="$t('setting__open_api_enable')" @update:model-value="updateSetting({ 'openAPI.enable': $event })")
    .p.gap-top
      base-checkbox(id="setting_open_api_bind_lan" :model-value="appSetting['openAPI.bindLan']" :label="$t('setting__open_api_bind_lan')" @update:model-value="updateSetting({ 'openAPI.bindLan': $event })")
    .p.gap-top.small
      | {{ $t('setting__open_api_address') }}
      span.select {{ openAPI.address }}
    .p.small(v-if="openAPI.message") {{ openAPI.message }}
    .p.gap-top(v-if="openAPI.address && openAPI.port")
      span {{ $t('obs_browser_source') }}
      select.gap-left(v-model="obsLayout" :aria-label="$t('obs_layout')")
        option(v-for="layout in ['combined', 'card', 'lyrics']" :key="layout" :value="layout") {{ $t('obs_' + layout) }}
      label.gap-left {{ $t('obs_radius') }}
        input(v-model.number="obsRadius" type="number" min="0" max="64" style="width: 4em")
      input.select(:value="overlayUrl" readonly @focus="$event.target.select()")
      base-btn(min @click="clipboardWriteText(overlayUrl)") {{ $t('track_copy_link') }}
    .p
      .p.small {{ $t('setting__open_api_port') }}
      div
        base-input.gap-left(:class="$style.portInput" :model-value="appSetting['openAPI.port']" type="number" :placeholder="$t('setting__open_api_port_tip')" @update:model-value="setPort")

dd.gap-top
  div
    .p
      | {{ $t('setting__open_api_tip') }}
      strong.hover.underline(aria-label="https://lyswhut.github.io/lx-music-doc/desktop/faq/open-api" @click="openUrl('https://lyswhut.github.io/lx-music-doc/desktop/open-api')") {{ $t('setting__open_api_tip_link') }}

dd
  h3 {{ $t('receiver_title') }}
  steam-presence
  .p.gap-top
    base-checkbox(id="live_requests" :model-value="appSetting['integrations.liveRequests']" :label="$t('live_requests')" @update:model-value="updateSetting({ 'integrations.liveRequests': $event })")
    span.gap-left.small(v-if="liveStatus" role="status") {{ $t(liveStatus) }}
  template(v-if="appSetting['integrations.liveRequests']")
    .p.gap-top
      input.select(:aria-label="$t('live_room')" :placeholder="$t('live_room')" inputmode="numeric" maxlength="12" :value="appSetting['integrations.liveRoom']" @change="updateSetting({ 'integrations.liveRoom': $event.target.value.trim() })")
    p.small {{ $t('live_help') }}
    p.small(v-if="lastRequest" role="status") {{ lastRequest }}
  .p.gap-top
    base-checkbox(id="discord_enable" :model-value="appSetting['integrations.discord']" :label="$t('discord_activity')" @update:model-value="updateSetting({ 'integrations.discord': $event })")
    span.gap-left.small(v-if="discordStatus" role="status") {{ $t(discordStatus) }}
  .p.gap-top(v-if="appSetting['integrations.discord']")
    input.select(aria-label="Discord Application ID" placeholder="Discord Application ID" inputmode="numeric" maxlength="20" :value="appSetting['integrations.discordId']" @change="updateSetting({ 'integrations.discordId': $event.target.value.trim() })")
    base-btn.gap-left(min @click="openUrl('https://discord.com/developers/applications')") Discord Developer Portal
  .p.gap-top
    base-checkbox(id="sixk_enable" :model-value="appSetting['integrations.sixK']" label="6K Labs · Amuse" @update:model-value="updateSetting({ 'integrations.sixK': $event })")
    span.gap-left.small(v-if="sixKStatus" role="status") {{ $t(sixKStatus) }}
  .p.small(v-if="appSetting['integrations.sixK']") {{ $t('sixk_help') }}
  .p.gap-top(v-if="appSetting['integrations.sixK']")
    label {{ $t('sixk_cover') }}
      select.gap-left(:value="appSetting['integrations.sixKCoverMode']" @change="updateSetting({ 'integrations.sixKCoverMode': $event.target.value })")
        option(value="url") URL
        option(value="base64url") Base64
    label.gap-left {{ $t('sixk_cover_size') }}
      input.select.gap-left(list="sixk-presets" size="5" :value="appSetting['integrations.sixKCoverSize']" @change="setCoverSize")
      datalist#sixk-presets
        option(v-for="size in ['128', '256', '512', '1024', 'max']" :key="size" :value="size")
  .p.gap-top
    base-checkbox(id="amll_enable" :model-value="appSetting['integrations.amll']" label="AMLL Player" @update:model-value="updateSetting({ 'integrations.amll': $event })")
    span.gap-left.small(v-if="amllStatus" role="status") {{ $t(amllStatus) }}
  .p.gap-top(v-if="appSetting['integrations.amll']")
    input.select(:aria-label="$t('receiver_host')" :value="appSetting['integrations.amllUrl']" placeholder="ws://127.0.0.1:11444" @change="updateSetting({ 'integrations.amllUrl': $event.target.value.trim() })")
    select.gap-left(aria-label="AMLL WebSocket" :value="appSetting['integrations.amllVersion']" @change="updateSetting({ 'integrations.amllVersion': $event.target.value })")
      option(value="v2") V2 · JSON
      option(value="v1") V1 · Binary
    base-checkbox.gap-left(id="amll_audio" :model-value="appSetting['integrations.amllAudio']" :label="$t('amll_audio')" @update:model-value="updateSetting({ 'integrations.amllAudio': $event })")
    span.small(v-if="amllAudioError" role="status") {{ $t('amll_audio_error') }}
  .p.gap-top
    base-checkbox(id="lyrics_island_enable" :model-value="appSetting['integrations.lyricsIsland']" label="LyricsIsland · ClassIsland / ClassWidgets" @update:model-value="updateSetting({ 'integrations.lyricsIsland': $event })")
    span.gap-left.small(v-if="islandState" role="status") {{ $t(islandState) }}
  .p.gap-top
    base-checkbox(id="keyboard_screen_enable" :model-value="appSetting['integrations.keyboardScreen']" label="SKYLOONG GK4 / GK87" @update:model-value="updateSetting({ 'integrations.keyboardScreen': $event })")
    span.gap-left.small(v-if="screenState" role="status") {{ $t(screenState) }}
  label.p.gap-top(v-if="appSetting['integrations.keyboardScreen']")
    | {{ $t('receiver_host') }}
    input.select.gap-left(:value="appSetting['integrations.keyboardHost']" placeholder="skyloong-screen.local" @change="updateSetting({ 'integrations.keyboardHost': $event.target.value.trim() })")
</template>

<script>
// import { computed } from '@common/utils/vueTools'
import { openAPI } from '@renderer/store'
import { openUrl, clipboardWriteText } from '@common/utils/electron'
import { computed, ref } from '@common/utils/vueTools'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { debounce } from '@common/utils'
import { receiverState } from '@renderer/core/useApp/useExternalLyrics'
import { amllStatus, amllAudioError } from '@renderer/core/useApp/useAmll'
import { sixKStatus } from '@renderer/core/useApp/useSixK'
import { discordStatus } from '@renderer/core/useApp/useDiscord'
import SteamPresence from './SteamPresence.vue'
import { liveStatus, lastRequest } from '@renderer/core/useApp/useLiveRequests'

export default {
  name: 'SettingOpenAPI',
  components: { SteamPresence },
  setup() {
    const obsLayout = ref('combined')
    const obsRadius = ref(18)
    const setPort = debounce(port => {
      updateSetting({ 'openAPI.port': port.trim() })
    }, 500)

    return {
      appSetting,
      islandState: receiverState.island,
      amllStatus,
      amllAudioError,
      sixKStatus,
      setCoverSize(event) {
        const value = event.target.value.trim().toLowerCase()
        const size = value === 'max' ? value : String(Math.min(4096, Math.max(1, Math.round(Number(value)) || 256)))
        event.target.value = size
        updateSetting({ 'integrations.sixKCoverSize': size })
      },
      discordStatus,
      liveStatus,
      lastRequest,
      screenState: receiverState.screen,
      obsLayout,
      obsRadius,
      overlayUrl: computed(() => `http://127.0.0.1:${openAPI.port}/obs?layout=${obsLayout.value}&radius=${Math.min(64, Math.max(0, Number(obsRadius.value) || 0))}`),
      clipboardWriteText,
      updateSetting,
      openAPI,
      openUrl,
      setPort,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';
.portInput[disabled], .hostInput[disabled] {
  opacity: .8 !important;
}
</style>
