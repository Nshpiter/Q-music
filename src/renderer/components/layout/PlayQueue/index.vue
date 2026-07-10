<template>
  <transition enter-active-class="q-play-queue-enter-active" leave-active-class="q-play-queue-leave-active">
    <div v-if="isShowPlayQueue" :class="$style.layer">
      <aside
        ref="panelRef"
        :class="$style.panel"
        tabindex="-1"
        role="dialog"
        aria-modal="false"
        aria-labelledby="play_queue_title"
        @click.stop
      >
        <header :class="$style.header">
          <div :class="$style.heading">
            <h2 id="play_queue_title">{{ $t('play_queue__title') }}</h2>
            <p v-if="currentTrackText">
              <span>{{ $t('play_queue__now_playing') }}</span>
              {{ currentTrackText }}
            </p>
          </div>
          <button
            type="button"
            :class="$style.closeBtn"
            :aria-label="$t('btn_close')"
            :title="$t('btn_close')"
            @click="closeQueue"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div :class="$style.tabs" role="tablist">
          <button
            type="button"
            role="tab"
            :class="{ [$style.activeTab]: activeTab == 'playlist' }"
            :aria-selected="activeTab == 'playlist'"
            @click="activeTab = 'playlist'"
          >
            {{ $t('play_queue__playlist') }}
            <span>{{ currentList.length }}</span>
          </button>
          <button
            type="button"
            role="tab"
            :class="{ [$style.activeTab]: activeTab == 'later' }"
            :aria-selected="activeTab == 'later'"
            @click="activeTab = 'later'"
          >
            {{ $t('list__play_later') }}
            <span>{{ tempPlayList.length }}</span>
          </button>
        </div>

        <section v-show="activeTab == 'playlist'" :class="$style.tabPanel" role="tabpanel">
          <div :class="$style.listMeta">
            <strong>{{ currentListName }}</strong>
            <span>{{ $t('play_queue__songs', { num: currentList.length }) }}</span>
          </div>
          <base-virtualized-list
            v-if="currentList.length"
            ref="listRef"
            v-slot="{ item, index }"
            :class="$style.list"
            :list="currentList"
            :item-height="56"
            key-name="id"
            container-class="scroll"
          >
            <QueueItem
              :music-info="item"
              :index="index"
              :active="currentIndex == index"
              @play="handlePlayCurrent(index)"
            />
          </base-virtualized-list>
          <div v-else :class="$style.empty">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 18V5l10-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="16" cy="16" r="3" />
            </svg>
            <p>{{ $t('play_queue__empty') }}</p>
          </div>
        </section>

        <section v-show="activeTab == 'later'" :class="$style.tabPanel" role="tabpanel">
          <div :class="$style.listMeta">
            <strong>{{ $t('list__play_later') }}</strong>
            <button
              v-if="tempPlayList.length"
              type="button"
              :class="$style.clearBtn"
              :aria-label="$t('play_queue__clear_later')"
              :title="$t('play_queue__clear_later')"
              @click="clearTempPlayeList"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16" />
                <path d="M9 7V4h6v3" />
                <path d="M7 7l1 13h8l1-13" />
                <path d="M10 11v5" />
                <path d="M14 11v5" />
              </svg>
            </button>
          </div>
          <div v-if="tempPlayList.length" :class="['scroll', $style.laterList]">
            <QueueItem
              v-for="(item, index) in tempPlayList"
              :key="`${item.musicInfo.id}_${index}`"
              :music-info="item.musicInfo"
              :index="index"
              removable
              @play="handlePlayLater(index)"
              @remove="removeTempPlayList(index)"
            />
          </div>
          <div v-else :class="$style.empty">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6h12" />
              <path d="M4 11h12" />
              <path d="M4 16h8" />
              <path d="M17 14v6" />
              <path d="M17 14l4 2.5-4 2.5" />
            </svg>
            <p>{{ $t('play_queue__empty_later') }}</p>
          </div>
        </section>
      </aside>
    </div>
  </transition>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from '@common/utils/vueTools'
import { LIST_IDS } from '@common/constants'
import { playList, playTempListByIndex } from '@renderer/core/player'
import { useI18n } from '@renderer/plugins/i18n'
import { getListMusics } from '@renderer/store/list/action'
import { defaultList, loveList, userLists } from '@renderer/store/list/state'
import { downloadList } from '@renderer/store/download/state'
import {
  isShowPlayQueue,
  musicInfo,
  playInfo,
  playMusicInfo,
  tempPlayList,
} from '@renderer/store/player/state'
import {
  clearTempPlayeList,
  removeTempPlayList,
  setShowPlayQueue,
} from '@renderer/store/player/action'
import QueueItem from './QueueItem.vue'

const t = useI18n()
const activeTab = ref('playlist')
const currentList = ref([])
const listRef = ref(null)
const panelRef = ref(null)
let loadId = 0

const currentTrackText = computed(() => {
  if (!musicInfo.name) return ''
  return musicInfo.singer ? `${musicInfo.name} · ${musicInfo.singer}` : musicInfo.name
})

const currentListName = computed(() => {
  switch (playInfo.playerListId) {
    case LIST_IDS.DEFAULT:
      return t(defaultList.name)
    case LIST_IDS.LOVE:
      return t(loveList.name)
    case LIST_IDS.TEMP:
      return t('play_queue__temporary_list')
    case LIST_IDS.DOWNLOAD:
      return t('download')
    default:
      return userLists.find(list => list.id == playInfo.playerListId)?.name ?? t('play_queue__current_list')
  }
})

const currentIndex = computed(() => {
  if (playMusicInfo.isTempPlay || !playMusicInfo.musicInfo) return -1
  return currentList.value.findIndex(item => item.id == playMusicInfo.musicInfo?.id)
})

const loadCurrentList = async() => {
  const requestId = ++loadId
  const listId = playInfo.playerListId
  if (!listId) {
    currentList.value = []
    return
  }

  const list = listId == LIST_IDS.DOWNLOAD
    ? [...downloadList]
    : [...await getListMusics(listId)]
  if (requestId != loadId || listId != playInfo.playerListId) return
  currentList.value = list
}

const scrollToCurrent = async(animate = false) => {
  if (!isShowPlayQueue.value || activeTab.value != 'playlist' || currentIndex.value < 0) return
  await nextTick()
  listRef.value?.scrollToIndex(currentIndex.value, -112, animate)
}

const closeQueue = () => {
  setShowPlayQueue(false)
}

const handlePlayCurrent = index => {
  const listId = playInfo.playerListId
  if (!listId) return
  playList(listId, index)
}

const handlePlayLater = index => {
  playTempListByIndex(index)
}

const handleMyListUpdate = listIds => {
  if (playInfo.playerListId && listIds.includes(playInfo.playerListId)) void loadCurrentList()
}

const handleDocumentClick = () => {
  closeQueue()
}

const handleKeydown = event => {
  if (event.key == 'Escape' && isShowPlayQueue.value) closeQueue()
}

watch(() => playInfo.playerListId, () => {
  void loadCurrentList()
}, { immediate: true })

watch(() => downloadList.length, () => {
  if (playInfo.playerListId == LIST_IDS.DOWNLOAD) void loadCurrentList()
})

watch(isShowPlayQueue, async(visible) => {
  if (!visible) return
  await loadCurrentList()
  await nextTick()
  panelRef.value?.focus({ preventScroll: true })
  await scrollToCurrent()
})

watch([activeTab, currentIndex], () => {
  void scrollToCurrent(true)
})

onMounted(() => {
  window.app_event.on('myListUpdate', handleMyListUpdate)
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.app_event.off('myListUpdate', handleMyListUpdate)
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.layer {
  position: absolute;
  inset: 0;
  z-index: 40;
  pointer-events: none;
}

.panel {
  position: absolute;
  right: 24px;
  bottom: calc(@height-player + 8px);
  width: min(410px, calc(100vw - 40px));
  height: clamp(340px, 58vh, 620px);
  max-height: calc(100vh - @height-player - 30px);
  display: flex;
  flex-flow: column nowrap;
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid rgba(54, 83, 70, .2);
  border-radius: 8px;
  color: var(--color-font);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, .96), rgba(244, 250, 247, .94)),
    var(--color-main-background);
  box-shadow: 0 22px 56px rgba(31, 45, 39, .22), inset 0 1px 0 rgba(255, 255, 255, .86);
  backdrop-filter: blur(24px) saturate(1.12);
  outline: none;
  pointer-events: auto;
  -webkit-app-region: no-drag;
}

.header {
  flex: none;
  min-height: 70px;
  padding: 14px 14px 12px 18px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  box-sizing: border-box;
  border-bottom: 1px solid rgba(54, 83, 70, .09);
}

.heading {
  min-width: 0;

  h2 {
    margin: 0;
    color: rgba(35, 42, 39, .94);
    font-size: 17px;
    line-height: 24px;
    font-weight: 700;
  }

  p {
    max-width: 320px;
    margin: 4px 0 0;
    overflow: hidden;
    color: rgba(54, 58, 60, .56);
    font-size: 11px;
    line-height: 16px;
    white-space: nowrap;
    text-overflow: ellipsis;

    span {
      margin-right: 6px;
      color: var(--color-primary);
      font-weight: 600;
    }
  }
}

.closeBtn,
.clearBtn {
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  color: rgba(54, 58, 60, .58);
  background: transparent;
  cursor: pointer;
  transition: color @transition-fast, background-color @transition-fast;

  &:hover {
    color: rgba(35, 42, 39, .9);
    background-color: rgba(54, 83, 70, .08);
  }

  svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
}

.closeBtn {
  width: 30px;
  height: 30px;
  flex: none;
}

.tabs {
  flex: none;
  height: 44px;
  padding: 0 14px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  border-bottom: 1px solid rgba(54, 83, 70, .09);

  button {
    position: relative;
    min-width: 0;
    padding: 0 8px;
    border: none;
    color: rgba(54, 58, 60, .58);
    background: transparent;
    font-size: 13px;
    cursor: pointer;

    &:after {
      content: '';
      position: absolute;
      left: 24%;
      right: 24%;
      bottom: -1px;
      height: 2px;
      border-radius: 2px 2px 0 0;
      background-color: transparent;
    }

    span {
      margin-left: 5px;
      font-size: 11px;
      font-variant-numeric: tabular-nums;
    }
  }

  .activeTab {
    color: var(--color-primary);
    font-weight: 700;

    &:after {
      background-color: var(--color-primary);
    }
  }
}

.tabPanel {
  min-height: 0;
  flex: auto;
  display: flex;
  flex-flow: column nowrap;
}

.listMeta {
  flex: none;
  height: 38px;
  padding: 0 14px 0 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid rgba(54, 83, 70, .07);
  color: rgba(54, 58, 60, .48);
  font-size: 11px;

  strong {
    min-width: 0;
    overflow: hidden;
    color: rgba(54, 58, 60, .68);
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}

.clearBtn {
  width: 28px;
  height: 28px;

  &:hover {
    color: #d65555;
    background-color: rgba(214, 85, 85, .09);
  }
}

.list,
.laterList {
  min-height: 0;
  flex: auto;
}

.laterList {
  overflow-y: auto;
}

.empty {
  min-height: 0;
  flex: auto;
  display: flex;
  flex-flow: column nowrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: rgba(54, 58, 60, .4);

  svg {
    width: 34px;
    height: 34px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  p {
    margin: 0;
    font-size: 12px;
    line-height: 18px;
  }
}

:global(.q-play-queue-enter-active) {
  animation: qPlayQueueEnter .24s cubic-bezier(.2, .8, .2, 1);
}

:global(.q-play-queue-leave-active) {
  animation: qPlayQueueLeave .18s ease forwards;
}

@keyframes qPlayQueueEnter {
  from {
    opacity: 0;
    transform: translateY(12px) scale(.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes qPlayQueueLeave {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(8px) scale(.985);
  }
}

@media (max-width: 980px) {
  .panel {
    right: 18px;
    width: min(380px, calc(100vw - 30px));
  }
}
</style>
