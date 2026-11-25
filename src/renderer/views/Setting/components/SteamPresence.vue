<template>
  <div class="p gap-top">
    <base-checkbox id="steam_presence" :model-value="enabled" :label="$t('steam_presence')" @update:model-value="updateSetting({ 'integrations.steam': $event })" />
    <div v-if="enabled" :class="$style.settings">
      <div :class="$style.statusBadge" role="status">{{ $t(steamState.status) }}</div>
      <div v-if="steamState.qr" :class="$style.qrCard">
        <img :src="steamState.qr" :alt="$t('steam_scan')" width="172" height="172">
      </div>
      <div :class="$style.actions">
        <base-btn min @click="steamAction('login')">{{ $t('steam_login') }}</base-btn>
        <base-btn min outline @click="steamAction('logout')">{{ $t('steam_logout') }}</base-btn>
      </div>
      <label :class="$style.prefixRow">
        <span>{{ $t('steam_prefix') }}</span>
        <input maxlength="48" :value="appSetting['integrations.steamPrefix']" @change="updateSetting({ 'integrations.steamPrefix': $event.target.value })">
      </label>
      <div :class="$style.checks">
        <base-checkbox v-for="item in options" :id="item.key" :key="item.key" :model-value="appSetting[item.key]" :label="$t(item.label)" @update:model-value="updateSetting({ [item.key]: $event })" />
      </div>
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
.settings {
  display: grid; justify-items: start; gap: 10px;
  margin: 8px 0 6px 24px; padding: 12px 14px; max-width: 520px;
  border-radius: 14px; background: var(--q-surface-soft); box-shadow: inset 0 0 0 1px var(--q-outline);
}
.statusBadge {
  padding: 2px 9px; border-radius: 999px; font-size: 12px;
  color: var(--color-primary-font); background: var(--color-primary-alpha-900);
}
.qrCard {
  padding: 10px; border-radius: 12px; background: #fff;
  box-shadow: 0 4px 14px rgba(0, 0, 0, .12);
}
.qrCard img { display: block; border-radius: 6px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
.prefixRow { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; font-size: 13px; }
.checks { display: grid; gap: 6px; }
</style>
