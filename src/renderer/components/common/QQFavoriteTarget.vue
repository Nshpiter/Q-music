<template>
  <section v-if="provider" :class="[$style.target, { [$style.compact]: compact }]" :aria-busy="working">
    <h3 :class="$style.label">{{ $t('favorite_platform_section') }}</h3>
    <div :class="$style.card">
    <div :class="$style.row">
      <SourceIcon :source="provider" :size="28" />
      <div :class="$style.copy">
        <strong>{{ $t('favorite_destination_title') }}</strong>
        <span>{{ $t('favorite_destination_hint') }}</span>
      </div>
      <span v-if="status == 'added'" :class="$style.done" :aria-label="$t(actionLabel)"><span aria-hidden="true">✓</span> {{ $t('favorite_action_added') }}</span>
      <base-btn v-else type="button" :class="$style.action" :aria-label="$t(actionLabel)" :disabled="disabled || working || loadingTargets || !supported" @click="submit">
        {{ $t(buttonLabel) }}
      </base-btn>
    </div>
    <button type="button" :class="$style.destination" :disabled="disabled || working" :aria-expanded="showTargets" @click="toggleTargets">
      <span>{{ targetName || $t('favorite_destination_liked') }}</span><span aria-hidden="true">{{ showTargets ? '⌃' : '⌄' }}</span>
    </button>
    <div v-if="showTargets" :class="$style.destinations" :aria-label="$t('favorite_destination_title')">
      <button type="button" :disabled="working" :aria-pressed="!playlistId" @click="selectTarget('')">{{ $t('favorite_destination_liked') }}<span v-if="!playlistId">✓</span></button>
      <p v-if="loadingTargets" role="status">{{ $t('favorite_destination_loading') }}</p>
      <template v-else>
        <button v-for="list in targets" :key="list.id" type="button" :disabled="working" :aria-pressed="playlistId == list.id" @click="selectTarget(list.id)"><span>{{ list.name }}</span><span v-if="playlistId == list.id">✓</span></button>
        <p v-if="targetError" role="status">{{ $t(targetError) }} <button type="button" @click="loadTargets">{{ $t('favorite_destination_retry') }}</button></p>
        <KugouVerifyButton v-if="provider == 'kg' && targetError == 'kugou__verification_required'" :disabled="working || loadingTargets" @verified="loadTargets" />
        <p v-else-if="!targets.length">{{ $t('favorite_destination_empty') }}</p>
      </template>
    </div>
    <div v-if="status || !supported" :class="$style.feedback">
      <p role="status" :class="$style.message">{{ $t(['added', 'unconfirmed', 'not_found'].includes(status) ? 'favorite_destination_' + status : prefix + (status || 'supported')) }}<span v-if="errorCode != null"> {{ $t(prefix + 'error_code', { code: errorCode }) }}</span></p>
      <p v-if="localSync" role="status" :class="$style.message">{{ $t(localSync) }}</p>
    </div>
    </div>
  </section>
</template>

<script>
import { computed, ref, watch, onBeforeUnmount } from '@common/utils/vueTools'
import { addQQFavoriteSong, addNeteaseFavoriteSong, addKugouFavoriteSong, loginMusicAccount, getMusicAccountPlaylists } from '@renderer/utils/ipc'
import { syncQQFavorites } from '@renderer/store/list/syncSourceList'
import SourceIcon from './SourceIcon.vue'
import KugouVerifyButton from './KugouVerifyButton.vue'

export default {
  components: { SourceIcon, KugouVerifyButton },
  props: {
    musicInfo: { type: Object, required: true },
    disabled: { type: Boolean, default: false },
    compact: { type: Boolean, default: false },
  },
  emits: ['busy'],
  setup(props, { emit }) {
    const status = ref('')
    const errorCode = ref(null)
    const working = ref(false)
    const localSync = ref('')
    const needsCheck = computed(() => status.value == 'unknown' || status.value == 'unconfirmed' || status.value == 'verification_expired')
    const provider = computed(() => ['tx', 'wy', 'kg'].includes(props.musicInfo.source) ? props.musicInfo.source : null)
    const prefix = computed(() => ({ tx: 'qq_favorite_', wy: 'wy_favorite_', kg: 'kg_favorite_' })[provider.value])
    const needsVerify = computed(() => provider.value == 'kg' && status.value.startsWith('verification_') && status.value != 'verification_expired' && status.value != 'verification_unsupported')
    const needsLogin = computed(() => status.value == 'login_required' || status.value == 'verification_unsupported')
    const actionLabel = computed(() => working.value ? prefix.value + 'working' : status.value == 'added' ? 'favorite_action_added' : needsLogin.value ? prefix.value + 'login' : needsVerify.value ? 'kg_favorite_verify' : needsCheck.value ? prefix.value + 'check' : 'favorite_action_add')
    const buttonLabel = computed(() => working.value ? 'favorite_action_working' : needsLogin.value ? 'favorite_action_login' : needsVerify.value ? 'favorite_action_verify' : needsCheck.value ? 'favorite_action_check' : 'favorite_action_add')
    const supported = computed(() => provider.value == 'kg' ? /^[a-f0-9]{32}$/i.test(String(props.musicInfo.meta?.hash ?? '')) : props.musicInfo.source == 'wy' ? /^[1-9]\d*$/.test(String(props.musicInfo.meta?.songId ?? '')) : props.musicInfo.source == 'tx' && /^[a-zA-Z0-9]{1,64}$/.test(String(props.musicInfo.meta?.songId ?? '')))
    let generation = 0
    const playlistId = ref('')
    const targets = ref(/** @type {Array<{id: string, name: string}>} */ ([]))
    const showTargets = ref(false)
    const loadingTargets = ref(false)
    const targetError = ref('')
    const results = new Map()
    const targetName = computed(() => {
      const target = targets.value.filter(list => list.id == playlistId.value)[0]
      return target?.name ?? ''
    })
    const selectTarget = id => {
      results.set(playlistId.value, { status: status.value, errorCode: errorCode.value, localSync: localSync.value })
      playlistId.value = id
      const saved = results.get(id)
      status.value = saved?.status ?? ''; errorCode.value = saved?.errorCode ?? null; localSync.value = saved?.localSync ?? ''
      showTargets.value = false
    }
    const loadTargets = async() => {
      if (loadingTargets.value) return
      const current = generation
      loadingTargets.value = true; targetError.value = ''
      try {
        const result = await getMusicAccountPlaylists(provider.value)
        if (current != generation) return
        if (result.status != 'available') {
          targetError.value = result.status == 'verification_required' ? 'kugou__verification_required' : 'favorite_destination_' + (result.status == 'login_required' ? 'login' : 'error')
          if (result.status == 'login_required') status.value = 'login_required'
        } else targets.value = result.playlists.filter(list => list.kind == 'created' && (provider.value != 'kg' || list.writable === true) && list.id != 'dir:201')
      } catch { if (current == generation) targetError.value = 'favorite_destination_error' } finally { if (current == generation) loadingTargets.value = false }
    }
    const toggleTargets = () => { showTargets.value = !showTargets.value; if (showTargets.value) void loadTargets() }
    watch(() => props.musicInfo, () => { generation++; status.value = ''; errorCode.value = null; localSync.value = ''; playlistId.value = ''; targets.value = []; results.clear(); loadingTargets.value = false; showTargets.value = false })
    onBeforeUnmount(() => { generation++ })
    const submit = async() => {
      if (props.disabled || working.value || loadingTargets.value || !supported.value || status.value == 'added') return
      const current = generation
      const loggingIn = needsLogin.value
      const songMid = String(props.musicInfo.meta.songId)
      working.value = true
      errorCode.value = null
      emit('busy', true)
      try {
        if (loggingIn) {
          const result = await loginMusicAccount(provider.value)
          if (generation == current) status.value = result.status == 'connected' ? 'ready' : 'login_required'
        } else {
          const checking = needsCheck.value
          const action = checking ? 'check' : 'add'
          const result = await (provider.value == 'kg'
            ? addKugouFavoriteSong({ hash: props.musicInfo.meta.hash, name: [props.musicInfo.singer, props.musicInfo.name].filter(Boolean).join(' - '), albumId: props.musicInfo.meta.albumId || undefined, playlistId: playlistId.value || undefined, action: needsVerify.value ? 'verify' : action })
            : (provider.value == 'wy' ? addNeteaseFavoriteSong : addQQFavoriteSong)(songMid, action, playlistId.value || undefined))
          if (provider.value == 'tx' && !playlistId.value && result.status == 'added' && result.accountId) {
            // 本地同步失败不能改变已经确认的云端收藏结果。
            if (generation == current) localSync.value = 'list_sync_favorite_pending'
            void syncQQFavorites(result.accountId).then(sync => {
              if (generation == current) localSync.value = sync.failed ? 'list_sync_favorite_failed' : sync.total ? 'list_sync_favorite_done' : 'list_sync_favorite_unlinked'
            }).catch(() => { if (generation == current) localSync.value = 'list_sync_favorite_failed' })
          }
          if (generation == current) {
            // 核对失败仍保留只读核对入口，不把下一次点击隐式变成重新写入。
            status.value = checking && result.status == 'unavailable' ? 'unknown' : result.status
            errorCode.value = result.code ?? null
          }
        }
      } catch {
        if (generation == current) status.value = loggingIn ? 'unavailable' : 'unknown'
      } finally {
        working.value = false
        emit('busy', false)
      }
    }
    return { provider, prefix, status, errorCode, working, supported, actionLabel, buttonLabel, submit, localSync, playlistId, targets, showTargets, loadingTargets, targetError, targetName, selectTarget, loadTargets, toggleTargets }
  },
}
</script>

<style lang="less" module>
.target { flex: none; margin: 0 20px 18px; }
.label { margin: 0 0 10px; font-size: 11px; font-weight: 600; color: inherit; opacity: .6; }
.card { padding: 14px; border: 1px solid rgb(from currentColor r g b / .1); border-radius: 14px; background: rgb(from currentColor r g b / .025); }
.destination { width: 100%; margin-top: 12px; padding: 9px 12px; display: flex; justify-content: space-between; gap: 12px; border: 1px solid var(--q-outline); border-radius: 9px; background: var(--q-surface-raised); color: inherit; cursor: pointer; text-align: left; }
.destination span:first-child { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.destinations { max-height: 180px; overflow-y: auto; margin-top: 6px; border: 1px solid var(--q-outline); border-radius: 10px; padding: 4px; }
.destinations button { display: flex; justify-content: space-between; gap: 10px; width: 100%; border: none; padding: 10px; border-radius: 7px; color: inherit; background: transparent; cursor: pointer; text-align: left; line-height: 1.4; overflow-wrap: anywhere; }
.destinations button:hover, .destinations button[aria-pressed=true] { background: var(--q-outline); color: var(--color-primary); }
.destinations p { padding: 8px; font-size: 12px; line-height: 1.6; }
.row { display: flex; align-items: center; gap: 12px; }
.copy { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 5px; line-height: 1.5; }
.copy strong { font-size: 13px; font-weight: 600; color: inherit; }
.copy span, .message { font-size: 11px; line-height: 1.6; color: inherit; opacity: .65; overflow-wrap: anywhere; }
.action { flex: none; min-width: 64px; min-height: 36px; border-radius: 10px !important; padding: 7px 12px !important; font-size: 12px; }
.done { flex: none; font-size: 12px; color: var(--color-primary); }
.feedback { border-top: 1px solid rgb(from currentColor r g b / .08); margin-top: 12px; padding-top: 10px; }
.message { margin: 0; }
.message + .message { margin-top: 6px; }
.compact { margin: 14px 0 0; }
.compact .card { padding: 12px; }
.compact .row { gap: 10px; }
</style>
