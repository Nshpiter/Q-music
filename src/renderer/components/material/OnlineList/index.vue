<template>
  <div :class="[$style.songList, $style.listColumns]">
    <!-- <transition enter-active-class="animated-fast fadeIn" leave-active-class="animated-fast fadeOut"> -->
    <div :class="$style.list">
      <material-list-toolbar
        v-if="!noItem" :count="list.length" :selected-count="selectedList.length" page-only
        :download-visible="appSetting['download.enable']" :download-enabled="canDownloadSelection"
        @select-all="handleSelectAllData" @clear="removeAllSelect"
        @add="handleShowMusicAddModal(0)" @download="handleShowDownloadModal(0)"
      />
      <div class="thead">
        <table>
          <thead>
            <tr v-if="actionButtonsVisible">
              <th class="num" :class="$style.numberColumn">#</th>
              <th class="nobreak">{{ $t('music_name') }}</th>
              <th class="nobreak" :class="$style.singerColumn">{{ $t('music_singer') }}</th>
              <th class="nobreak" :class="$style.albumColumn">{{ $t('music_album') }}</th>
              <th class="nobreak" :class="$style.durationColumn">{{ $t('music_time') }}</th>
              <th class="nobreak" :class="$style.actionColumn">{{ $t('action') }}</th>
            </tr>
            <tr v-else>
              <th class="num" :class="$style.numberColumn">#</th>
              <th class="nobreak">{{ $t('music_name') }}</th>
              <th class="nobreak" :class="$style.singerColumn">{{ $t('music_singer') }}</th>
              <th class="nobreak" :class="$style.albumColumn">{{ $t('music_album') }}</th>
              <th class="nobreak" :class="$style.durationColumn">{{ $t('music_time') }}</th>
            </tr>
          </thead>
        </table>
      </div>
      <div :class="$style.content">
        <div v-show="!noItem" ref="dom_listContent" :class="$style.content">
          <base-virtualized-list v-if="actionButtonsVisible" ref="listRef" :list="list" key-name="id" :item-height="listItemHeight" container-class="scroll" content-class="list" @contextmenu.capture="handleListRightClick">
            <template #default="{ item, index }">
              <div
                class="list-item" :class="[{ selected: rightClickSelectedIndex == index }, { active: selectedList.includes(item) }, { playing: isCurrentMusic(item) }]"
                @click="handleListItemClick($event, index)" @contextmenu="handleListItemRightClick($event, index)"
              >
                <div class="list-item-cell no-select num" :class="[$style.numberColumn, $style.selectColumn]" @click.stop>
                  <span v-if="isCurrentMusic(item)" class="list-eq" :class="{ [$style.paused]: !isPlay }" aria-hidden="true"><i /><i /><i /></span>
                  <span v-else>{{ index + 1 }}</span>
                  <input type="checkbox" :checked="selectedList.includes(item)" :aria-label="$t('list__select_song', { name: item.name })" @click.stop @change="toggleSelectData(index)">
                </div>
                <div class="list-item-cell auto name">
                  <span class="select name" :aria-label="item.name">{{ item.name }}</span>
                  <span v-if="item.meta._qualitys.flac24bit" class="no-select badge badge-theme-primary">{{ $t('tag__lossless_24bit') }}</span>
                  <span v-else-if="item.meta._qualitys.ape || item.meta._qualitys.flac || item.meta._qualitys.wav" class="no-select badge badge-theme-primary">{{ $t('tag__lossless') }}</span>
                  <span v-else-if="item.meta._qualitys['320k']" class="no-select badge badge-theme-secondary">{{ $t('tag__high_quality') }}</span>
                  <source-picker
                    v-if="showSourceSelector" :value="item.source" :options="getSourceOptions(item)" :source-name="getSourceName"
                    @change="handleSourceChange($event, index)"
                  />
                  <source-icon v-else-if="showSourceTag" class="no-select" :source="item.source" :size="15" />
                </div>
                <div class="list-item-cell" :class="$style.singerColumn"><span class="select" :aria-label="item.singer">{{ item.singer }}</span></div>
                <div class="list-item-cell" :class="$style.albumColumn"><span class="select" :aria-label="item.meta.albumName">{{ item.meta.albumName }}</span></div>
                <div class="list-item-cell" :class="$style.durationColumn"><span class="no-select">{{ item.interval || '--/--' }}</span></div>
                <div class="list-item-cell" :class="$style.actionColumn" style="padding-left: 0; padding-right: 0;">
                  <material-list-buttons :index="index" :playing="isCurrentMusic(item) && isPlay" :remove-btn="false" :download-btn="assertApiSupport(item.source)" :play-btn="checkApiSource ? assertApiSupport(item.source) : true" @btn-click="handleListBtnClick" />
                </div>
              </div>
            </template>
            <template #footer>
              <div :class="$style.pagination">
                <material-pagination :count="total" :limit="limit" :page="page" @btn-click="$emit('togglePage', $event)" />
              </div>
            </template>
          </base-virtualized-list>
          <base-virtualized-list v-else ref="listRef" :list="list" key-name="id" :item-height="listItemHeight" container-class="scroll" content-class="list" @contextmenu.capture="handleListRightClick">
            <template #default="{ item, index }">
              <div
                class="list-item" :class="[{ selected: rightClickSelectedIndex == index }, { active: selectedList.includes(item) }, { playing: isCurrentMusic(item) }]"
                @click="handleListItemClick($event, index)" @contextmenu="handleListItemRightClick($event, index)"
              >
                <div class="list-item-cell no-select num" :class="[$style.numberColumn, $style.selectColumn]" @click.stop>
                  <span v-if="isCurrentMusic(item)" class="list-eq" :class="{ [$style.paused]: !isPlay }" aria-hidden="true"><i /><i /><i /></span>
                  <span v-else>{{ index + 1 }}</span>
                  <input type="checkbox" :checked="selectedList.includes(item)" :aria-label="$t('list__select_song', { name: item.name })" @click.stop @change="toggleSelectData(index)">
                </div>
                <div class="list-item-cell auto name">
                  <span class="select name" :aria-label="item.name">{{ item.name }}</span>
                  <span v-if="item.meta._qualitys.flac24bit" class="no-select badge badge-theme-primary">{{ $t('tag__lossless_24bit') }}</span>
                  <span v-else-if="item.meta._qualitys.ape || item.meta._qualitys.flac || item.meta._qualitys.wav" class="no-select badge badge-theme-primary">{{ $t('tag__lossless') }}</span>
                  <span v-else-if="item.meta._qualitys['320k']" class="no-select badge badge-theme-secondary">{{ $t('tag__high_quality') }}</span>
                  <source-picker
                    v-if="showSourceSelector" :value="item.source" :options="getSourceOptions(item)" :source-name="getSourceName"
                    @change="handleSourceChange($event, index)"
                  />
                  <source-icon v-else-if="showSourceTag" class="no-select" :source="item.source" :size="15" />
                </div>
                <div class="list-item-cell" :class="$style.singerColumn"><span class="select" :aria-label="item.singer">{{ item.singer }}</span></div>
                <div class="list-item-cell" :class="$style.albumColumn"><span class="select" :aria-label="item.meta.albumName">{{ item.meta.albumName }}</span></div>
                <div class="list-item-cell" :class="$style.durationColumn"><span class="no-select">{{ item.interval || '--/--' }}</span></div>
              </div>
            </template>
            <template #footer>
              <div :class="$style.pagination">
                <material-pagination :count="total" :limit="limit" :page="page" @btn-click="$emit('togglePage', $event)" />
              </div>
            </template>
          </base-virtualized-list>
        </div>
        <transition enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
          <div v-if="isLoading" class="list" :class="$style.skeleton" :aria-label="noItem" aria-busy="true">
            <div v-for="index in 14" :key="index" class="list-item" :class="$style.skeletonRow" :style="{ height: `${listItemHeight}px` }">
              <div class="list-item-cell" :class="$style.numberColumn"><i :class="$style.skeletonNum" /></div>
              <div class="list-item-cell auto"><i :style="{ width: `${58 - (index % 4) * 9}%` }" /></div>
              <div class="list-item-cell" :class="$style.singerColumn"><i :style="{ width: `${64 - (index % 3) * 12}%` }" /></div>
              <div class="list-item-cell" :class="$style.albumColumn"><i :style="{ width: `${52 - (index % 2) * 14}%` }" /></div>
              <div class="list-item-cell" :class="$style.durationColumn"><i :class="$style.skeletonTime" /></div>
              <div v-if="actionButtonsVisible" class="list-item-cell" :class="$style.actionColumn" />
            </div>
          </div>
          <div v-else-if="noItem" :class="$style.noitem">
            <p v-text="noItem" />
          </div>
        </transition>
      </div>
    </div>
    <!-- </transition> -->
    <!-- <material-flow-btn :show="isShowEditBtn && assertApiSupport(source)" :remove-btn="false" @btn-click="handleFlowBtnClick" /> -->
    <!-- <common-download-modal v-model:show="isShowDownload" :music-info="selectedDownloadMusicInfo" teleport="#view" />
    <common-download-multiple-modal v-model:show="isShowDownloadMultiple" :list="selectedList" teleport="#view" @confirm="removeAllSelect" /> -->
    <common-list-add-modal v-model:show="isShowListAdd" :music-info="selectedAddMusicInfo" teleport="#view" />
    <common-list-add-multiple-modal v-model:show="isShowListAddMultiple" :music-list="selectedList" teleport="#view" @confirm="removeAllSelect" />
    <common-download-modal v-model:show="isShowDownload" :music-info="selectedDownloadMusicInfo" teleport="#view" />
    <common-download-multiple-modal v-model:show="isShowDownloadMultiple" :list="selectedList" teleport="#view" @confirm="removeAllSelect" />
    <base-menu v-model="isShowItemMenu" :menus="menus" :xy="menuLocation" item-name="name" @menu-click="handleMenuClick" />
  </div>
</template>

<script>
import { clipboardWriteText } from '@common/utils/electron'
import { assertApiSupport } from '@renderer/store/utils'
import { ref, computed } from '@common/utils/vueTools'
import { isPlay, playMusicInfo } from '@renderer/store/player/state'
import { togglePlay } from '@renderer/core/player'
import useList from './useList'
import useMenu from './useMenu'
import usePlay from './usePlay'
import useMusicDownload from './useMusicDownload'
import useMusicAdd from './useMusicAdd'
import useMusicActions from './useMusicActions'
import { appSetting } from '@renderer/store/setting'
import SourceIcon from '@renderer/components/common/SourceIcon.vue'
import SourcePicker from '@renderer/components/common/SourcePicker.vue'
export default {
  name: 'MaterialOnlineList',
  components: { SourceIcon, SourcePicker },
  props: {
    list: {
      type: Array,
      default() {
        return []
      },
    },
    page: {
      type: Number,
      required: true,
    },
    limit: {
      type: Number,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
    sourceTag: {
      type: Boolean,
      default: false,
    },
    sourceSelector: {
      type: Boolean,
      default: false,
    },
    sourceOptions: {
      type: Function,
      default: item => [item.source],
    },
    sourceName: {
      type: Function,
      default: source => source,
    },
    noItem: {
      type: String,
      default: '',
    },
    checkApiSource: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['show-menu', 'play-list', 'togglePage', 'source-change'],
  setup(props, { emit }) {
    const actionButtonsVisible = computed(() => appSetting['list.actionButtonsVisible'])
    const showSourceSelector = computed(() => props.sourceSelector)
    const showSourceTag = computed(() => props.sourceTag)
    const getSourceOptions = item => props.sourceOptions(item)
    const getSourceName = source => props.sourceName(source)
    const rightClickSelectedIndex = ref(-1)
    const isCurrentMusic = item => !!item && playMusicInfo.musicInfo?.id == item.id && playMusicInfo.musicInfo?.source == item.source
    const dom_listContent = ref(null)
    const listRef = ref(null)

    const {
      selectedList,
      listItemHeight,
      handleSelectData,
      removeAllSelect,
      handleSelectAllData,
      toggleSelectData,
    } = useList({ props, listRef })
    const isLoading = computed(() => props.noItem == window.i18n.t('list__loading'))
    const canDownloadSelection = computed(() => selectedList.value.length > 0 && selectedList.value.every(item => assertApiSupport(item.source)))

    const {
      handlePlayMusic,
      handlePlayMusicLater,
      doubleClickPlay,
    } = usePlay({ selectedList, props, removeAllSelect, emit })

    const {
      isShowListAdd,
      isShowListAddMultiple,
      selectedAddMusicInfo,
      handleShowMusicAddModal,
    } = useMusicAdd({ selectedList, props })

    const {
      isShowDownload,
      isShowDownloadMultiple,
      selectedDownloadMusicInfo,
      handleShowDownloadModal,
    } = useMusicDownload({ selectedList, props })

    const {
      handleSearch,
      handleOpenMusicDetail,
      handleDislikeMusic,
    } = useMusicActions({ props })

    const {
      menus,
      menuLocation,
      isShowItemMenu,
      showMenu,
      menuClick,
    } = useMenu({
      props,
      assertApiSupport,
      emit,

      handleShowDownloadModal,
      handlePlayMusic,
      handlePlayMusicLater,
      handleSearch,
      handleShowMusicAddModal,
      handleOpenMusicDetail,
      handleDislikeMusic,
    })

    const handleListItemClick = (event, index) => {
      if (rightClickSelectedIndex.value > -1) return
      handleSelectData(index)
      if (event.ctrlKey || event.metaKey || event.shiftKey) return
      doubleClickPlay(index)
    }
    const handleListItemRightClick = (event, index) => {
      rightClickSelectedIndex.value = index
      showMenu(event, props.list[index], index)
    }
    const handleMenuClick = (action) => {
      let index = rightClickSelectedIndex.value
      rightClickSelectedIndex.value = -1
      menuClick(action, index)
    }
    const handleListRightClick = (event) => {
      if (!event.target.classList.contains('select') || !window.getSelection()?.toString().trim()) return
      event.stopImmediatePropagation()
      let classList = dom_listContent.value.classList
      classList.add('copying')
      window.requestAnimationFrame(() => {
        let str = window.getSelection().toString()
        classList.remove('copying')
        str = str.split(/\n\n/).map(s => s.replace(/\n/g, '  ')).join('\n').trim()
        if (!str.length) return
        clipboardWriteText(str)
      })
    }
    const handleListBtnClick = ({ action, index }) => {
      switch (action) {
        case 'download':
          handleShowDownloadModal(index, true)
          break
        case 'play':
          if (isCurrentMusic(props.list[index])) togglePlay()
          else void handlePlayMusic(index, true)
          break
        case 'search':
          handleSearch(index)
          break
        case 'listAdd':
          handleShowMusicAddModal(index, true)
          break
      }
    }
    const handleSourceChange = (source, index) => {
      emit('source-change', { index, source })
    }
    const scrollToTop = () => {
      listRef.value.scrollTo(0, true)
    }

    return {
      listItemHeight,
      isLoading,
      isCurrentMusic,
      isPlay,
      handleListItemClick,
      selectedList,
      handleSelectAllData,
      toggleSelectData,
      handleShowMusicAddModal,
      handleShowDownloadModal,
      canDownloadSelection,
      appSetting,
      handleListItemRightClick,
      removeAllSelect,
      handleListBtnClick,
      handleSourceChange,
      rightClickSelectedIndex,
      dom_listContent,
      listRef,

      menus,
      isShowItemMenu,
      menuLocation,
      handleMenuClick,

      handleListRightClick,
      assertApiSupport,

      isShowListAdd,
      isShowListAddMultiple,
      selectedAddMusicInfo,

      isShowDownload,
      isShowDownloadMultiple,
      selectedDownloadMusicInfo,

      scrollToTop,
      actionButtonsVisible,
      showSourceSelector,
      showSourceTag,
      getSourceOptions,
      getSourceName,
    }
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';
@import '@renderer/assets/styles/listColumns.less';
.songList {
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  position: relative;
}

.list {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  font-size: 14px;
  :global(.list-item) {
    margin: 2px 7px;
    width: calc(100% - 14px);
  }
}

.paused i { animation-play-state: paused !important; }

.content {
  flex: auto;
  min-height: 0;
  position: relative;
  height: 100%;
}

.pagination {
  text-align: center;
  padding: 15px 0;
  // left: 50%;
  // transform: translateX(-50%);
}
.noitem {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  align-items: center;
  // background-color: var(--color-000);

  p {
    font-size: 16px;
    color: var(--color-font-label);
  }
}

.skeleton {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  padding-top: 2px;
  // 越往下越淡，暗示列表仍在延伸
  mask-image: linear-gradient(180deg, #000 45%, transparent 96%);
}
.skeletonRow {
  box-sizing: border-box;
  display: flex;
  align-items: center;

  i {
    display: block;
    height: 10px;
    border-radius: 6px;
    background: linear-gradient(100deg, rgba(255, 255, 255, .28) 20%, rgba(255, 255, 255, .68) 45%, rgba(255, 255, 255, .28) 70%);
    background-size: 220% 100%;
    animation: q-online-list-skeleton 1.4s ease-in-out infinite;
  }
}
.skeletonNum {
  width: 16px;
  margin: 0 auto;
}
.skeletonTime {
  width: 34px;
}
@keyframes q-online-list-skeleton {
  from { background-position: 100% 0; }
  to { background-position: -100% 0; }
}
</style>
