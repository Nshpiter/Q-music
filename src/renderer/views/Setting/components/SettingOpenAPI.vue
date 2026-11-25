<template lang="pug">
dt#sync {{ $t('setting__open_api') }}
.q-section-nav
  button.q-section-pill(v-for="item in quickSections" :key="item.id" type="button" @click="focusSettingSection(item.id)") {{ item.literal ? item.label : $t(item.label) }}
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
    .p.gap-top(v-if="openAPI.address && openAPI.port" :class="$style.subCard")
      div(:class="$style.inlineRow")
        span(:class="$style.subTitle") {{ $t('obs_browser_source') }}
        select(v-model="obsLayout" :aria-label="$t('obs_layout')")
          option(v-for="layout in ['combined', 'card', 'lyrics']" :key="layout" :value="layout") {{ $t('obs_' + layout) }}
        label(:class="$style.inlineField") {{ $t('obs_radius') }}
          input(v-model.number="obsRadius" type="number" min="0" max="64" :class="$style.numInput")
      div(:class="$style.urlRow")
        input.select(:class="$style.urlInput" :value="overlayUrl" readonly @focus="$event.target.select()")
        base-btn(min @click="copyOverlayUrl") {{ obsCopied ? '✓' : $t('track_copy_link') }}
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
  .p.gap-top(:class="$style.checkRow")
    base-checkbox(id="live_requests" :model-value="appSetting['integrations.liveRequests']" :label="$t('live_requests')" @update:model-value="updateSetting({ 'integrations.liveRequests': $event })")
    span(v-if="liveStatus" :class="$style.statusBadge" role="status") {{ $t(liveStatus) }}
  div(v-if="appSetting['integrations.liveRequests']" :class="$style.subCard")
    input.select(:class="$style.wideInput" :aria-label="$t('live_room')" :placeholder="$t('live_room')" inputmode="numeric" maxlength="12" :value="appSetting['integrations.liveRoom']" @change="updateSetting({ 'integrations.liveRoom': $event.target.value.trim() })")
    p(:class="$style.helpText") {{ $t('live_help') }}
    p(v-if="lastRequest" :class="$style.statusNote" role="status") {{ lastRequest }}
  .p.gap-top(:class="$style.checkRow")
    base-checkbox(id="discord_enable" :model-value="appSetting['integrations.discord']" :label="$t('discord_activity')" @update:model-value="updateSetting({ 'integrations.discord': $event })")
    span(v-if="discordStatus" :class="$style.statusBadge" role="status") {{ $t(discordStatus) }}
  div(v-if="appSetting['integrations.discord']" :class="[$style.subCard, $style.inlineRow]")
    input.select(:class="$style.wideInput" aria-label="Discord Application ID" placeholder="Discord Application ID" inputmode="numeric" maxlength="20" :value="appSetting['integrations.discordId']" @change="updateSetting({ 'integrations.discordId': $event.target.value.trim() })")
    base-btn(min @click="openUrl('https://discord.com/developers/applications')") Discord Developer Portal
  .p.gap-top(:class="$style.checkRow")
    base-checkbox(id="sixk_enable" :model-value="appSetting['integrations.sixK']" label="6K Labs · Amuse" @update:model-value="updateSetting({ 'integrations.sixK': $event })")
    span(v-if="sixKStatus" :class="$style.statusBadge" role="status") {{ $t(sixKStatus) }}
  div(v-if="appSetting['integrations.sixK']" :class="$style.subCard")
    p(:class="$style.helpText") {{ $t('sixk_help') }}
    div(:class="$style.inlineRow")
      label(:class="$style.inlineField") {{ $t('sixk_cover') }}
        select(:value="appSetting['integrations.sixKCoverMode']" @change="updateSetting({ 'integrations.sixKCoverMode': $event.target.value })")
          option(value="url") URL
          option(value="base64url") Base64
      label(:class="$style.inlineField") {{ $t('sixk_cover_size') }}
        input.select(:class="$style.sizeInput" list="sixk-presets" size="5" :value="appSetting['integrations.sixKCoverSize']" @change="setCoverSize")
        datalist#sixk-presets
          option(v-for="size in ['128', '256', '512', '1024', 'max']" :key="size" :value="size")
  .p.gap-top(:class="$style.checkRow")
    base-checkbox(id="amll_enable" :model-value="appSetting['integrations.amll']" label="AMLL Player" @update:model-value="updateSetting({ 'integrations.amll': $event })")
    span(v-if="amllStatus" :class="$style.statusBadge" role="status") {{ $t(amllStatus) }}
  div(v-if="appSetting['integrations.amll']" :class="[$style.subCard, $style.inlineRow]")
    input.select(:class="$style.wideInput" :aria-label="$t('receiver_host')" :value="appSetting['integrations.amllUrl']" placeholder="ws://127.0.0.1:11444" @change="updateSetting({ 'integrations.amllUrl': $event.target.value.trim() })")
    select(aria-label="AMLL WebSocket" :value="appSetting['integrations.amllVersion']" @change="updateSetting({ 'integrations.amllVersion': $event.target.value })")
      option(value="v2") V2 · JSON
      option(value="v1") V1 · Binary
    base-checkbox(id="amll_audio" :model-value="appSetting['integrations.amllAudio']" :label="$t('amll_audio')" @update:model-value="updateSetting({ 'integrations.amllAudio': $event })")
    span(v-if="amllAudioError" :class="$style.statusNote" role="status") {{ $t('amll_audio_error') }}
  .p.gap-top(:class="$style.checkRow")
    base-checkbox(id="lyrics_island_enable" :model-value="appSetting['integrations.lyricsIsland']" label="LyricsIsland · ClassIsland / ClassWidgets" @update:model-value="updateSetting({ 'integrations.lyricsIsland': $event })")
    span(v-if="islandState" :class="$style.statusBadge" role="status") {{ $t(islandState) }}
  .p.gap-top(:class="$style.checkRow")
    base-checkbox(id="keyboard_screen_enable" :model-value="appSetting['integrations.keyboardScreen']" label="SKYLOONG GK4 / GK87" @update:model-value="updateSetting({ 'integrations.keyboardScreen': $event })")
    span(v-if="screenState" :class="$style.statusBadge" role="status") {{ $t(screenState) }}
  div(v-if="appSetting['integrations.keyboardScreen']" :class="$style.subCard")
    label(:class="$style.inlineField") {{ $t('receiver_host') }}
      input.select(:class="$style.wideInput" :value="appSetting['integrations.keyboardHost']" placeholder="skyloong-screen.local" @change="updateSetting({ 'integrations.keyboardHost': $event.target.value.trim() })")
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
import { focusSettingSection } from '../settingCatalog'

export default {
  name: 'SettingOpenAPI',
  components: { SteamPresence },
  setup() {
    const obsLayout = ref('combined')
    const obsRadius = ref(18)
    const obsCopied = ref(false)
    let obsCopyTimer = null
    const overlayUrl = computed(() => `http://127.0.0.1:${openAPI.port}/obs?layout=${obsLayout.value}&radius=${Math.min(64, Math.max(0, Number(obsRadius.value) || 0))}`)
    const copyOverlayUrl = () => {
      clipboardWriteText(overlayUrl.value)
      obsCopied.value = true
      if (obsCopyTimer) clearTimeout(obsCopyTimer)
      obsCopyTimer = setTimeout(() => { obsCopied.value = false }, 1600)
    }
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
      obsCopied,
      overlayUrl,
      copyOverlayUrl,
      updateSetting,
      openAPI,
      openUrl,
      setPort,
      focusSettingSection,
      quickSections: [
        { id: 'setting_open_api_enable', label: 'obs_browser_source', literal: false },
        { id: 'steam_presence', label: 'Steam', literal: true },
        { id: 'live_requests', label: 'live_requests', literal: false },
        { id: 'discord_enable', label: 'Discord', literal: true },
        { id: 'sixk_enable', label: '6K Labs', literal: true },
        { id: 'amll_enable', label: 'AMLL Player', literal: true },
      ],
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';
.portInput[disabled], .hostInput[disabled] {
  opacity: .8 !important;
}
.checkRow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
}
.statusBadge {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--color-primary-font);
  background: var(--color-primary-alpha-900);
}
.subCard {
  display: grid;
  gap: 10px;
  margin: 6px 0 8px 24px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--q-surface-soft);
  box-shadow: inset 0 0 0 1px var(--q-outline);
  max-width: 620px;
}
.subTitle {
  font-size: 13px;
  font-weight: 600;
}
.inlineRow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
}
.inlineField {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.urlRow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.urlInput {
  flex: 1;
  min-width: 200px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}
.wideInput {
  min-width: 220px;
  max-width: 300px;
}
.numInput {
  width: 64px;
}
.sizeInput {
  width: 80px;
}
.helpText {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-font-label);
}
.statusNote {
  margin: 0;
  font-size: 12px;
  color: var(--color-primary-font);
}
</style>
