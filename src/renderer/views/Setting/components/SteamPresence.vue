<template>
  <div class="p gap-top">
    <base-checkbox id="steam_presence" :model-value="enabled" :label="$t('steam_presence')" @update:model-value="updateSetting({ 'integrations.steam': $event })" />
    <div v-if="enabled" :class="$style.settings">
      <div role="status">{{ $t(steamState.status) }}</div>
      <img v-if="steamState.qr" :src="steamState.qr" :alt="$t('steam_scan')" width="180" height="180">
      <div><base-btn min @click="steamAction('login')">{{ $t('steam_login') }}</base-btn>
        <base-btn min @click="steamAction('logout')">{{ $t('steam_logout') }}</base-btn></div>
      <label>{{ $t('steam_prefix') }} <input maxlength="48" :value="appSetting['integrations.steamPrefix']" @change="updateSetting({ 'integrations.steamPrefix': $event.target.value })"></label>
      <base-checkbox v-for="item in options" :id="item.key" :key="item.key" :model-value="appSetting[item.key]" :label="$t(item.label)" @update:model-value="updateSetting({ [item.key]: $event })" />
    </div>
  </div>
</template>
<script setup>
import { computed, watch } from 'vue'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { steamState, steamAction } from '@renderer/core/useApp/useSteam'
const enabled = computed(() => appSetting['integrations.steam'])
const options = [{ key: 'integrations.steamArtist', label: 'steam_artist' }, { key: 'integrations.steamTime', label: 'steam_time' }, { key: 'integrations.steamPaused', label: 'steam_paused' }]
watch(enabled, (value, _, cleanup) => {
  if (!value) return
  const timer = setInterval(() => { void steamAction('status') }, 2000)
  cleanup(() => { clearInterval(timer) })
}, { immediate: true })
</script>
<style module>
.settings { display: grid; justify-items: start; gap: 8px; padding: 8px 0 10px; }
.settings input { color: var(--color-font); background: var(--color-content-background); border: 1px solid var(--q-border); border-radius: 5px; padding: 5px; }
</style>
