<template>
  <material-modal :show="visible" bg-close teleport="#view" width="680px" max-width="calc(100% - 32px)" @close="handleClose">
    <div :class="$style.header">
      <h2>{{ $t('playlist_import_modal__title') }}</h2>
      <p>{{ $t('playlist_import_modal__subtitle') }}</p>
    </div>
    <main class="scroll" :class="$style.main">
      <div :class="$style.modeTabs">
        <button type="button" :class="{ [$style.active]: mode == 'account' }" :disabled="isLoading" @click="mode = 'account'">
          {{ $t('playlist_import_modal__account_tab') }}
        </button>
        <button type="button" :class="{ [$style.active]: mode == 'link' }" :disabled="isLoading" @click="mode = 'link'">
          {{ $t('playlist_import_modal__link_tab') }}
        </button>
      </div>

      <template v-if="mode == 'account'">
        <section :class="$style.accountSection">
          <div :class="$style.accountProviders">
            <button
              v-for="item in accountProviderOptions" :key="item.id" type="button"
              :class="[$style.accountProvider, { [$style.active]: accountProvider == item.id, [$style.connected]: accountStatus[item.id] }]"
              :disabled="isLoading || isAccountLoading" @click="handleAccountProvider(item.id)"
            >
              <span :class="$style.providerMark"><source-icon :source="item.id" :size="30" :label="$t(item.name)" /></span>
              <span>
                <strong>{{ $t(item.name) }}</strong>
                <small>{{ accountStatus[item.id] ? $t('playlist_import_modal__account_connected') : $t('playlist_import_modal__account_login') }}</small>
              </span>
              <em>{{ accountStatus[item.id] ? '✓' : '›' }}</em>
            </button>
          </div>

          <div :class="$style.accountPlaylistHeader">
            <div>
              <h3>{{ $t('playlist_import_modal__account_playlists') }}</h3>
              <p>{{ $t('playlist_import_modal__account_playlists_tip') }}</p>
            </div>
            <button type="button" :disabled="isAccountLoading || !accountStatus[accountProvider]" @click="loadAccountPlaylists(accountProvider)">
              {{ $t('playlist_import_modal__refresh') }}
            </button>
          </div>

          <div v-if="isAccountLoading" :class="$style.accountState">{{ $t('playlist_import_modal__account_loading') }}</div>
          <div v-else-if="accountPlaylists.length" :class="$style.accountPlaylists">
            <button
              v-for="playlist in accountPlaylists" :key="`${accountProvider}_${playlist.id}`" type="button"
              :class="[$style.accountPlaylist, { [$style.active]: selectedAccountPlaylistId == playlist.id }]"
              :disabled="isLoading" @click="selectedAccountPlaylistId = playlist.id"
            >
              <img v-if="playlist.cover" :src="playlist.cover" loading="lazy" @error="$event.currentTarget.style.visibility = 'hidden'">
              <span v-else :class="$style.playlistPlaceholder"><svg-icon name="music" /></span>
              <span :class="$style.playlistCopy">
                <strong>{{ playlist.name }}</strong>
                <small>
                  {{ $t('playlist_import_modal__track_count', { count: playlist.trackCount }) }}
                  <i v-if="playlist.kind">{{ $t(playlist.kind == 'created' ? 'playlist_import_modal__created' : 'playlist_import_modal__favorite') }}</i>
                </small>
              </span>
              <em>{{ selectedAccountPlaylistId == playlist.id ? '✓' : '›' }}</em>
            </button>
          </div>
          <div v-else :class="$style.accountState">
            {{ accountStatus[accountProvider] ? $t('playlist_import_modal__account_empty') : $t('playlist_import_modal__account_login_tip') }}
          </div>
        </section>
      </template>

      <template v-else>
        <section :class="$style.field">
          <h3 :class="$style.label">{{ $t('playlist_import_modal__source') }}</h3>
          <div :class="$style.sourceBtns">
            <button
              v-for="item in sourceOptions" :key="item.id" type="button"
              :class="[$style.sourceBtn, { [$style.active]: source == item.id }]"
              :aria-label="item.name" :title="item.name"
              :disabled="isLoading"
              @click="source = item.id"
            >
              <source-icon :source="item.id" :size="22" :label="item.name" />
            </button>
          </div>
        </section>

        <section :class="$style.field">
          <h3 :class="$style.label">{{ inputLabel }}</h3>
          <base-input
            v-model="text"
            :class="$style.input"
            :disabled="isLoading || (source == 'spotify' && spotifySavedTracks)"
            :placeholder="inputPlaceholder"
            :auto-paste="true"
          />
        </section>

        <section v-if="source == 'wy'" :class="$style.field">
          <h3 :class="$style.label">{{ $t('playlist_import_modal__netease_token') }}</h3>
          <base-input
            v-model="neteaseToken"
            :class="$style.input"
            :disabled="isLoading"
            type="password"
            :placeholder="$t('playlist_import_modal__netease_token_placeholder')"
          />
        </section>

        <section v-if="source == 'spotify'" :class="$style.field">
          <h3 :class="$style.label">{{ $t('playlist_import_modal__spotify_token') }}</h3>
          <base-input
            v-model="spotifyAccessToken"
            :class="$style.input"
            :disabled="isLoading"
            type="password"
            :placeholder="$t('playlist_import_modal__spotify_token_placeholder')"
          />
          <base-checkbox
            id="playlist_import_spotify_saved_tracks"
            v-model="spotifySavedTracks"
            :class="$style.checkbox"
            :disabled="isLoading"
            :label="$t('playlist_import_modal__spotify_liked')"
          />
        </section>
      </template>

      <section :class="$style.field">
        <h3 :class="$style.label">{{ $t('playlist_import_modal__target') }}</h3>
        <div :class="$style.radioGroup">
          <base-checkbox
            v-for="item in targetOptions" :id="`playlist_import_target_${item.id}`" :key="item.id"
            v-model="target" need name="playlist_import_target" :value="item.id" :disabled="isLoading" :label="item.name"
          />
        </div>
      </section>

      <section v-if="mode == 'link' && target == 'new'" :class="$style.field">
        <h3 :class="$style.label">{{ $t('playlist_import_modal__list_name') }}</h3>
        <base-input
          v-model="listName"
          :class="$style.input"
          :disabled="isLoading"
          :placeholder="defaultListName"
        />
      </section>

      <div v-if="statusText" :class="$style.status">{{ statusText }}</div>
    </main>
    <footer :class="$style.footer">
      <base-btn outline :disabled="cancelRequested" @click="handleClose">{{ $t('btn_cancel') }}</base-btn>
      <base-btn :disabled="!canSubmit" @click="handleSubmit">{{ submitText }}</base-btn>
    </footer>
  </material-modal>
</template>

<script>
import { computed, ref, watch } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'
import { defaultList, loveList, userLists } from '@renderer/store/list/state'
import { dialog } from '@renderer/plugins/Dialog'
import { getMusicAccountPlaylists, getMusicAccountStatus, loginMusicAccount } from '@renderer/utils/ipc'
import { ExternalImportError, importAccountPlaylist, importExternalPlaylist } from '../importPlaylist'
import SourceIcon from '@renderer/components/common/SourceIcon.vue'

const sourceOptions = [
  { id: 'tx', name: 'QQ音乐' },
  { id: 'wy', name: '网易云' },
  { id: 'kg', name: '酷狗' },
  { id: 'spotify', name: 'Spotify' },
]

const sourceNames = {
  tx: 'QQ音乐',
  wy: '网易云音乐',
  kg: '酷狗音乐',
  spotify: 'Spotify',
}

const accountProviderOptions = [
  { id: 'tx', name: 'source_tx' },
  { id: 'wy', name: 'source_wy' },
]

export default {
  components: { SourceIcon },
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    listId: {
      type: String,
      required: true,
    },
  },
  emits: ['update:visible'],
  setup(props, { emit }) {
    const t = useI18n()
    const mode = ref('account')
    const source = ref('tx')
    const text = ref('')
    const listName = ref('')
    const target = ref('new')
    const neteaseToken = ref('')
    const spotifyAccessToken = ref('')
    const spotifySavedTracks = ref(false)
    const isLoading = ref(false)
    const cancelRequested = ref(false)
    const statusText = ref('')
    const accountProvider = ref('tx')
    const accountStatus = ref({ tx: false, wy: false })
    const accountPlaylists = ref(/** @type {import('@renderer/utils/ipc').MusicAccountPlaylist[]} */ ([]))
    const selectedAccountPlaylistId = ref('')
    const isAccountLoading = ref(false)
    const progressStageKeys = {
      fetch: 'playlist_import_modal__stage_fetch',
      match: 'playlist_import_modal__stage_match',
      save: 'playlist_import_modal__stage_save',
    }
    const errorMessageKeys = {
      missing_token: 'playlist_import_modal__error_missing_token',
      invalid_link: 'playlist_import_modal__error_invalid_link',
      no_match: 'playlist_import_modal__error_no_match',
      account_unavailable: 'playlist_import_modal__account_unavailable',
    }

    const currentListName = computed(() => {
      switch (props.listId) {
        case defaultList.id:
          return t(defaultList.name)
        case loveList.id:
          return t(loveList.name)
        default:
          return userLists.find(list => list.id == props.listId)?.name ?? t(defaultList.name)
      }
    })

    const targetOptions = computed(() => [
      {
        id: 'new',
        name: t(mode.value == 'account' ? 'playlist_import_modal__target_account_new' : 'playlist_import_modal__target_new'),
      },
      {
        id: 'current',
        name: t('playlist_import_modal__target_current', { name: currentListName.value }),
      },
      {
        id: 'love',
        name: t(loveList.name),
      },
    ])

    const inputLabel = computed(() => {
      if (source.value == 'spotify' && spotifySavedTracks.value) return t('playlist_import_modal__spotify_liked')
      return t('playlist_import_modal__link')
    })

    const inputPlaceholder = computed(() => {
      if (source.value == 'spotify') return t('playlist_import_modal__spotify_link_placeholder')
      return t('playlist_import_modal__link_placeholder')
    })

    const defaultListName = computed(() => {
      if (source.value == 'spotify' && spotifySavedTracks.value) return 'Spotify 喜欢的歌曲'
      return `${sourceNames[source.value]}导入歌单`
    })

    const selectedAccountPlaylist = computed(() => {
      for (const playlist of accountPlaylists.value) {
        if (playlist.id == selectedAccountPlaylistId.value) return playlist
      }
      return null
    })

    const canSubmit = computed(() => {
      if (isLoading.value) return false
      if (mode.value == 'account') return !!accountStatus.value[accountProvider.value] && !!selectedAccountPlaylist.value
      if (source.value == 'spotify') {
        if (!spotifyAccessToken.value.trim()) return false
        return spotifySavedTracks.value || !!text.value.trim()
      }
      return !!text.value.trim()
    })

    const submitText = computed(() => {
      if (isLoading.value) return t('playlist_import_modal__importing')
      return t(mode.value == 'account' ? 'playlist_import_modal__sync_submit' : 'playlist_import_modal__submit')
    })

    const reset = () => {
      text.value = ''
      listName.value = ''
      neteaseToken.value = ''
      spotifyAccessToken.value = ''
      spotifySavedTracks.value = false
      statusText.value = ''
    }

    const refreshAccountStatus = async() => {
      accountStatus.value = await getMusicAccountStatus().catch(() => ({ tx: false, wy: false }))
    }

    const loadAccountPlaylists = async(provider = accountProvider.value) => {
      accountProvider.value = provider
      selectedAccountPlaylistId.value = ''
      accountPlaylists.value = []
      if (!accountStatus.value[provider]) return

      isAccountLoading.value = true
      try {
        const result = await getMusicAccountPlaylists(provider)
        if (result.status == 'available') {
          accountPlaylists.value = result.playlists
          selectedAccountPlaylistId.value = result.playlists[0]?.id ?? ''
        } else if (result.status == 'login_required') {
          accountStatus.value = { ...accountStatus.value, [provider]: false }
        }
      } catch {
        accountPlaylists.value = []
      } finally {
        isAccountLoading.value = false
      }
    }

    const handleAccountProvider = async(provider) => {
      if (isLoading.value || isAccountLoading.value) return
      accountProvider.value = provider
      if (!accountStatus.value[provider]) {
        const result = await loginMusicAccount(provider).catch(() => ({ status: 'cancelled' }))
        if (result.status != 'connected') return
        await refreshAccountStatus()
      }
      await loadAccountPlaylists(provider)
    }

    const setProgress = (value) => {
      const stageText = t(progressStageKeys[value.stage])
      statusText.value = value.total
        ? `${stageText} ${String(value.current)}/${String(value.total)}`
        : stageText
    }

    const handleClose = () => {
      if (isLoading.value) {
        // 导入中点击取消/关闭：请求中止当前导入，由导入流程在下一个检查点退出
        if (!cancelRequested.value) {
          cancelRequested.value = true
          statusText.value = t('playlist_import_modal__cancelling')
        }
        return
      }
      emit('update:visible', false)
    }

    const getErrorMessage = (error) => {
      if (error instanceof ExternalImportError && errorMessageKeys[error.code]) {
        return t(errorMessageKeys[error.code])
      }
      return error.message || String(error)
    }

    const handleSubmit = async() => {
      if (!canSubmit.value) return
      isLoading.value = true
      cancelRequested.value = false
      setProgress({
        stage: 'fetch',
        current: 0,
        total: 0,
      })

      try {
        let result
        if (mode.value == 'account') {
          result = await importAccountPlaylist({
            provider: accountProvider.value,
            playlist: selectedAccountPlaylist.value,
            target: target.value,
            currentListId: props.listId,
          }, value => {
            setProgress(value)
          }, () => cancelRequested.value)
        } else {
          result = await importExternalPlaylist({
            source: source.value,
            text: text.value.trim(),
            listName: listName.value.trim() || defaultListName.value,
            target: target.value,
            currentListId: props.listId,
            neteaseToken: neteaseToken.value,
            spotifyAccessToken: spotifyAccessToken.value,
            spotifySavedTracks: spotifySavedTracks.value,
          }, value => {
            setProgress(value)
          }, () => cancelRequested.value)
        }
        let message = t('playlist_import_modal__success', result)
        if (result.sourceTotal > result.total) message += ' ' + t('playlist_import_modal__success_partial', result)
        await dialog({
          teleport: '#view',
          message,
        })
        reset()
        emit('update:visible', false)
      } catch (error) {
        if (!(error instanceof ExternalImportError && error.code == 'cancelled')) {
          await dialog({
            teleport: '#view',
            message: t('playlist_import_modal__failed', { message: getErrorMessage(error) }),
          })
        }
      } finally {
        isLoading.value = false
        cancelRequested.value = false
        statusText.value = ''
      }
    }

    watch(source, () => {
      reset()
    })

    watch(() => props.visible, async(visible) => {
      if (!visible) return
      mode.value = 'account'
      target.value = 'new'
      await refreshAccountStatus()
      const preferredProvider = accountStatus.value.tx ? 'tx' : accountStatus.value.wy ? 'wy' : 'tx'
      await loadAccountPlaylists(preferredProvider)
    })

    watch(spotifySavedTracks, (enabled) => {
      if (enabled) text.value = ''
    })

    return {
      sourceOptions,
      accountProviderOptions,
      mode,
      source,
      text,
      listName,
      target,
      neteaseToken,
      spotifyAccessToken,
      spotifySavedTracks,
      isLoading,
      cancelRequested,
      targetOptions,
      inputLabel,
      inputPlaceholder,
      defaultListName,
      canSubmit,
      submitText,
      statusText,
      accountProvider,
      accountStatus,
      accountPlaylists,
      selectedAccountPlaylistId,
      selectedAccountPlaylist,
      isAccountLoading,
      loadAccountPlaylists,
      handleAccountProvider,
      handleClose,
      handleSubmit,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.header {
  flex: none;
  padding: 16px 20px 6px;
  text-align: center;

  h2 {
    font-size: 18px;
    line-height: 1.4;
  }

  p {
    margin-top: 3px;
    color: var(--color-font-label);
    font-size: 12px;
    line-height: 1.5;
  }
}

.main {
  flex: auto;
  width: 680px;
  max-height: min(66vh, 570px);
  max-width: calc(100vw - 32px);
  padding: 10px 20px 0;
  box-sizing: border-box;
}

.modeTabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  margin-bottom: 16px;
  padding: 4px;
  border-radius: 12px;
  background: var(--color-primary-background);

  button {
    height: 34px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: var(--color-font-label);
    cursor: pointer;
    font-size: 13px;
    transition: @transition-fast;

    &.active {
      background: var(--color-primary-background-hover);
      color: var(--color-primary);
      box-shadow: 0 5px 16px rgba(0, 0, 0, .06);
      font-weight: 600;
    }

    &:disabled {
      cursor: default;
      opacity: .5;
    }
  }
}

.accountSection {
  margin-bottom: 16px;
}

.accountProviders {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.accountProvider {
  display: grid;
  grid-template-columns: 38px 1fr auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: rgba(255, 255, 255, .48);
  color: var(--color-button-font);
  text-align: left;
  cursor: pointer;
  transition: @transition-fast;

  > span:nth-child(2) {
    min-width: 0;
  }

  strong, small {
    display: block;
    .mixin-ellipsis-1();
  }

  strong {
    font-size: 13px;
    line-height: 1.6;
  }

  small {
    color: var(--color-font-label);
    font-size: 11px;
  }

  em {
    color: var(--color-font-label);
    font-size: 16px;
    font-style: normal;
  }

  &:hover, &.active {
    border-color: var(--color-primary-alpha-600);
    background: var(--color-primary-background-hover);
  }

  &.connected em {
    color: var(--color-primary);
  }

  &:disabled {
    cursor: default;
    opacity: .58;
  }
}

.providerMark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: rgba(255, 255, 255, .46);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .58);
}

.accountPlaylistHeader {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin: 16px 2px 8px;

  h3 {
    font-size: 13px;
    line-height: 1.6;
  }

  p {
    color: var(--color-font-label);
    font-size: 11px;
    line-height: 1.4;
  }

  button {
    flex: none;
    padding: 3px 7px;
    border: 0;
    background: none;
    color: var(--color-primary);
    cursor: pointer;
    font-size: 12px;

    &:disabled {
      cursor: default;
      opacity: .4;
    }
  }
}

.accountPlaylists {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  max-height: 230px;
  padding-right: 3px;
  overflow-y: auto;
}

.accountPlaylist {
  display: grid;
  grid-template-columns: 44px 1fr auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 7px;
  border: 1px solid transparent;
  border-radius: 11px;
  background: rgba(255, 255, 255, .38);
  color: var(--color-button-font);
  text-align: left;
  cursor: pointer;
  transition: @transition-fast;

  img, .playlistPlaceholder {
    width: 44px;
    height: 44px;
    border-radius: 9px;
    object-fit: cover;
  }

  em {
    padding-right: 3px;
    color: var(--color-font-label);
    font-size: 15px;
    font-style: normal;
  }

  &:hover, &.active {
    border-color: var(--color-primary-alpha-600);
    background: var(--color-primary-background-hover);
  }

  &.active em {
    color: var(--color-primary);
  }
}

.playlistPlaceholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-background);
  color: var(--color-primary);
}

.playlistCopy {
  min-width: 0;

  strong, small {
    display: block;
    .mixin-ellipsis-1();
  }

  strong {
    font-size: 12px;
    line-height: 1.7;
  }

  small {
    color: var(--color-font-label);
    font-size: 11px;
  }

  i {
    margin-left: 6px;
    color: var(--color-primary);
    font-style: normal;
  }
}

.accountState {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 94px;
  border-radius: 12px;
  background: rgba(255, 255, 255, .34);
  color: var(--color-font-label);
  font-size: 12px;
}

.field {
  margin-bottom: 14px;
}

.label {
  margin-bottom: 7px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--color-font-label);
}

.sourceBtns {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.sourceBtn {
  min-width: 0;
  height: 32px;
  border: none;
  border-radius: @form-radius;
  background: rgba(255, 255, 255, .54);
  color: var(--color-button-font);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .62);
  cursor: pointer;
  transition: @transition-fast;
  transition-property: background-color, color, box-shadow, opacity;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: var(--color-primary-dark-300);
    background-color: rgba(255, 255, 255, .72);
  }

  &:disabled {
    opacity: .5;
    cursor: default;
  }
}

.active {
  color: var(--color-primary);
  box-shadow: inset 0 0 0 1px var(--color-primary-alpha-800);
}

.input {
  width: 100%;
  box-sizing: border-box;
}

.checkbox {
  margin-top: 8px;
  font-size: 13px;
}

.radioGroup {
  display: flex;
  flex-flow: column nowrap;
  gap: 6px;
  font-size: 13px;
}

.status {
  padding: 8px 0 2px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--color-font-label);
}

.footer {
  flex: none;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 14px 20px 18px;
}

@media (max-width: 620px) {
  .accountProviders, .accountPlaylists {
    grid-template-columns: 1fr;
  }

  .sourceBtns {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
