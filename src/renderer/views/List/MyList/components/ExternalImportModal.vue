<template>
  <material-modal :show="visible" bg-close teleport="#view" width="540px" max-width="calc(100% - 32px)" @close="handleClose">
    <div :class="$style.header">
      <h2>{{ $t('playlist_import_modal__title') }}</h2>
    </div>
    <main class="scroll" :class="$style.main">
      <section :class="$style.field">
        <h3 :class="$style.label">{{ $t('playlist_import_modal__source') }}</h3>
        <div :class="$style.sourceBtns">
          <button
            v-for="item in sourceOptions" :key="item.id" type="button"
            :class="[$style.sourceBtn, { [$style.active]: source == item.id }]"
            :disabled="isLoading"
            @click="source = item.id"
          >
            {{ item.name }}
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

      <section :class="$style.field">
        <h3 :class="$style.label">{{ $t('playlist_import_modal__target') }}</h3>
        <div :class="$style.radioGroup">
          <base-checkbox
            v-for="item in targetOptions"
            :id="`playlist_import_target_${item.id}`"
            :key="item.id"
            v-model="target"
            need
            name="playlist_import_target"
            :value="item.id"
            :disabled="isLoading"
            :label="item.name"
          />
        </div>
      </section>

      <section v-if="target == 'new'" :class="$style.field">
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
import { ExternalImportError, importExternalPlaylist } from '../importPlaylist'

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

export default {
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
    const progressStageKeys = {
      fetch: 'playlist_import_modal__stage_fetch',
      match: 'playlist_import_modal__stage_match',
      save: 'playlist_import_modal__stage_save',
    }
    const errorMessageKeys = {
      missing_token: 'playlist_import_modal__error_missing_token',
      invalid_link: 'playlist_import_modal__error_invalid_link',
      no_match: 'playlist_import_modal__error_no_match',
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
        name: t('playlist_import_modal__target_new'),
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

    const canSubmit = computed(() => {
      if (isLoading.value) return false
      if (source.value == 'spotify') {
        if (!spotifyAccessToken.value.trim()) return false
        return spotifySavedTracks.value || !!text.value.trim()
      }
      return !!text.value.trim()
    })

    const submitText = computed(() => isLoading.value ? t('playlist_import_modal__importing') : t('playlist_import_modal__submit'))

    const reset = () => {
      text.value = ''
      listName.value = ''
      neteaseToken.value = ''
      spotifyAccessToken.value = ''
      spotifySavedTracks.value = false
      statusText.value = ''
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
        const result = await importExternalPlaylist({
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

    watch(spotifySavedTracks, (enabled) => {
      if (enabled) text.value = ''
    })

    return {
      sourceOptions,
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
  padding: 12px 18px 4px;
  text-align: center;

  h2 {
    font-size: 16px;
    line-height: 1.4;
  }
}

.main {
  flex: auto;
  width: 540px;
  max-width: calc(100vw - 32px);
  padding: 8px 18px 0;
  box-sizing: border-box;
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
  padding: 14px 18px 18px;
}
</style>
