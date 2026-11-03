<template>
  <div ref="searchSlotRef" :class="[$style.searchSlot, { [$style.focused]: isFocused }]" @keydown.esc.stop="handleEscape" @focusout="handleFocusOut">
    <material-search-input v-model="searchText" :placeholder="$t('search')" :list="panelVisible && !sourceMenuVisible ? tipList : []" :visible-list="false" @event="handleEvent" />
    <button
      type="button"
      :class="[$style.sourceButton, { [$style.menuOpen]: sourceMenuVisible }]"
      :title="selectedSourceLabel"
      :aria-label="selectedSourceLabel"
      :aria-expanded="sourceMenuVisible"
      aria-haspopup="listbox"
      @mousedown.prevent
      @click.stop="toggleSourceMenu"
    >
      <source-icon v-if="selectedSource != 'all'" :source="selectedSource" :size="18" />
      <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z" /></svg>
    </button>
    <transition enter-active-class="animated-fast fadeIn" leave-active-class="animated-fast fadeOut">
      <div v-show="panelVisible || sourceMenuVisible" :class="[$style.searchPopover, { [$style.expandedPopover]: isFocused }]">
        <div v-show="sourceMenuVisible" :class="[$style.sourceMenu, { [$style.inlineSourceMenu]: isFocused }]" role="listbox" :aria-label="$t('search__source_select')" @mousedown.prevent>
          <div :class="$style.sourceMenuHeading">
            <strong>{{ $t('search__source_select') }}</strong>
            <span>{{ selectedSourceLabel }}</span>
          </div>
          <button
            v-for="item in sourceOptions" :key="item.id" type="button" role="option"
            :aria-selected="selectedSource == item.id"
            :class="{ [$style.activeSource]: selectedSource == item.id }"
            :title="item.label" @click.stop="selectSource(item.id)"
            @keydown.enter.prevent @keyup.enter.stop="selectSource(item.id)"
          >
            <source-icon v-if="item.id != 'all'" :source="item.id" :size="19" />
            <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z" /></svg>
            <span>{{ item.label }}</span>
            <svg v-if="selectedSource == item.id" :class="$style.sourceCheck" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
          </button>
        </div>
        <section v-show="panelVisible" :class="$style.searchPanel" @mousedown.prevent>
          <div v-if="searchText" :class="$style.suggestionList">
            <button v-for="(item, index) in tipList" :key="item" type="button" data-search-suggestion :class="{ [$style.selectedSuggestion]: selectedTipIndex == index }" @click="search(item)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.8 5.2a5.6 5.6 0 1 0 0 11.2 5.6 5.6 0 0 0 0-11.2zm4.1 9.7 4 4" /></svg>
              <span>{{ item }}</span>
            </button>
            <p v-if="!tipList.length" role="status">{{ isTipSearchLoading ? $t('search__hot_search_loading') : $t('search__tip_empty') }}</p>
          </div>
          <div v-else :class="$style.discoveryPanel">
            <div v-if="appSetting['search.isShowHistorySearch']" :class="[$style.panelSection, $style.historySection]">
              <header><strong>{{ $t('history_search') }}</strong><button v-if="historyList.length" type="button" @click="clearHistoryList">{{ $t('history_clear') }}</button></header>
              <div v-if="historyList.length" :class="$style.chips">
                <button v-for="(item, index) in historyExpanded ? historyList : historyList.slice(0, 8)" :key="item" type="button" @click="search(item)" @contextmenu.prevent="removeHistoryWord(index)">{{ item }}</button>
              </div>
              <button v-if="historyList.length > 8" type="button" :class="$style.historyMore" :aria-expanded="historyExpanded" @click="historyExpanded = !historyExpanded">{{ $t(historyExpanded ? 'history_search_less' : 'history_search_more') }}</button>
              <div v-if="!historyList.length" :class="$style.emptyHistory">{{ $t('history_search_empty') }}</div>
            </div>
            <div v-if="appSetting['search.isShowHotSearch']" :class="[$style.panelSection, $style.hotSection]">
              <header><strong>{{ selectedSourceLabel }} · {{ $t('search__hot_search') }}</strong><button type="button" :disabled="isHotSearchLoading" @click="refreshHotSearch">{{ $t('search__hot_search_refresh') }}</button></header>
              <div v-if="isHotSearchLoading" :class="$style.loading">{{ $t('search__hot_search_loading') }}</div>
              <ol v-else-if="hotSearchList.length" :class="$style.hotList">
                <li v-for="(item, index) in hotSearchList.slice(0, 10)" :key="item"><button type="button" @click="search(item)"><b>{{ index + 1 }}</b><span>{{ item }}</span></button></li>
              </ol>
              <div v-else :class="$style.loading">{{ $t('search__hot_search_empty') }}</div>
            </div>
          </div>
        </section>
      </div>
    </transition>
  </div>
</template>

<script>
import music from '@renderer/utils/musicSdk'
import { debounce } from '@common/utils'
import { DEFAULT_SETTING } from '@common/constants'
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from '@common/utils/vueTools'
import { useRouter, useRoute } from '@common/utils/vueRouter'
import { historyList, searchText as _searchText, selectedSource } from '@renderer/store/search/state'
import { clearHistoryList, getHistoryList, removeHistoryWord } from '@renderer/store/search/action'
import { clearList, getList } from '@renderer/store/hotSearch'
import { getSearchSetting, setSearchSetting } from '@renderer/utils/data'
import SourceIcon from '@renderer/components/common/SourceIcon.vue'
import { appSetting } from '@renderer/store/setting'

export default {
  components: { SourceIcon },
  setup() {
    const searchText = ref('')
    const tipList = ref([])
    const isTipSearchLoading = ref(false)
    const selectedTipIndex = ref(-1)
    const isFocused = ref(false)
    const historyExpanded = ref(false)
    const sourceMenuVisible = ref(false)
    const searchSlotRef = ref(null)
    const hotSearchList = shallowRef([])
    const isHotSearchLoading = ref(false)
    let hotSearchRequestId = 0
    let tipSearchGeneration = 0
    let sourceChangePath = null

    const route = useRoute()
    const router = useRouter()
    const sourceOptions = computed(() => {
      const options = music.sources.filter(item => item.id != 'xm').map(item => ({ id: item.id, label: window.i18n.t(`source_${item.id}`) }))
      return route.name == 'SongList'
        ? options
        : [{ id: 'all', label: window.i18n.t('source_all') }, ...options]
    })
    const selectedSourceLabel = computed(() => sourceOptions.value.find(item => item.id == selectedSource.value)?.label ?? window.i18n.t('source_all'))
    // 切源属于同一次搜索交互；未聚焦时只显示独立的音源菜单。
    const panelVisible = computed(() => isFocused.value && (searchText.value || appSetting['search.isShowHistorySearch'] || appSetting['search.isShowHotSearch']))

    getSearchSetting().then(setting => {
      if (route.query.source != null || route.name == 'SongList') return
      selectedSource.value = setting.source ?? 'all'
    }).catch(() => {})

    watch(() => route.query.source, value => {
      if (typeof value == 'string' && sourceOptions.value.some(item => item.id == value)) selectedSource.value = value
    }, { immediate: true })

    // 导航只清空顶部输入显示，不清空缓存搜索页的数据。
    watch(() => [route.name, route.query.text], ([name, text]) => {
      searchText.value = name == 'Search' && typeof text == 'string' ? text : ''
    }, { immediate: true })

    watch(_searchText, newValue => {
      if (route.name == 'Search' && newValue !== searchText.value) searchText.value = newValue
    })
    watch(searchText, () => {
      handleTipSearch()
      if (isFocused.value && !searchText.value.trim()) void loadHotSearch()
    })
    watch(() => appSetting['search.isShowHotSearch'], enabled => {
      if (enabled && isFocused.value && !searchText.value.trim()) void loadHotSearch()
    })


    const tipSearch = debounce(async(generation) => {
      const query = typeof searchText.value == 'string' ? searchText.value.trim() : ''
      if (!query) {
        if (generation == tipSearchGeneration) {
          tipList.value = []
          isTipSearchLoading.value = false
        }
        return
      }

      let source = selectedSource.value
      if (source == 'all') {
        const setting = await getSearchSetting().catch(() => ({ ...DEFAULT_SETTING.search }))
        if (generation != tipSearchGeneration) return
        source = setting.temp_source
      }
      const tipSearchApi = music[source]?.tipSearch
      if (!tipSearchApi) {
        if (generation == tipSearchGeneration) {
          tipList.value = []
          isTipSearchLoading.value = false
        }
        return
      }
      try {
        const list = await tipSearchApi.search(query)
        const currentQuery = typeof searchText.value == 'string' ? searchText.value.trim() : ''
        if (generation != tipSearchGeneration || query != currentQuery) return
        tipList.value = Array.isArray(list) ? list : []
      } catch {
        if (generation == tipSearchGeneration) tipList.value = []
      } finally {
        if (generation == tipSearchGeneration) isTipSearchLoading.value = false
      }
    }, 50)

    const handleTipSearch = () => {
      tipSearchGeneration++
      selectedTipIndex.value = -1
      tipList.value = []
      isTipSearchLoading.value = !!searchText.value.trim()
      tipSearch(tipSearchGeneration)
    }

    const loadHotSearch = async(force = false) => {
      if (!appSetting['search.isShowHotSearch']) return
      const source = selectedSource.value
      const requestId = ++hotSearchRequestId
      if (force) clearList(source)
      if (requestId == hotSearchRequestId) hotSearchList.value = []
      isHotSearchLoading.value = true
      try {
        const list = await getList(source)
        if (requestId == hotSearchRequestId) hotSearchList.value = Array.isArray(list) ? list : []
      } catch {
        if (requestId == hotSearchRequestId) hotSearchList.value = []
      } finally {
        if (requestId == hotSearchRequestId) isHotSearchLoading.value = false
      }
    }

    watch(selectedSource, () => {
      if (panelVisible.value && !searchText.value) void loadHotSearch()
      if (searchText.value) handleTipSearch()
    })

    const closePanel = () => {
      isFocused.value = false
      sourceMenuVisible.value = false
      historyExpanded.value = false
      searchSlotRef.value?.querySelector('input')?.blur()
    }
    const handleFocusOut = event => {
      if (!searchSlotRef.value?.contains(event.relatedTarget)) closePanel()
    }
    const handleEscape = () => {
      if (!sourceMenuVisible.value) { closePanel(); return }
      sourceMenuVisible.value = false
      if (isFocused.value) searchSlotRef.value?.querySelector('input')?.focus({ preventScroll: true })
    }

    const handleSearch = () => {
      closePanel()
      if (!searchText.value && route.path != '/search') {
        return
      }
      setTimeout(() => {
        router.push({
          path: '/search',
          query: {
            text: searchText.value,
            source: selectedSource.value,
          },
        }).catch(_ => _)
      }, searchText.value ? 200 : 0)
    }

    const handleEvent = ({ action, data }) => {
      switch (action) {
        case 'focus':
          sourceMenuVisible.value = false
          isFocused.value = true
          void getHistoryList().catch(() => {})
          if (!searchText.value) void loadHotSearch()
          if (searchText.value) handleTipSearch()
          break
        case 'blur':
          // 基础输入组件延迟发送 blur；内部按钮取焦或输入框重新聚焦时不能关闭面板。
          if (!searchSlotRef.value?.contains(document.activeElement)) closePanel()
          break
        case 'submit':
          handleSearch()
          break
        case 'listClick':
          searchText.value = tipList.value[data]
          handleSearch()
          break
        case 'selectionChange':
          selectedTipIndex.value = data
          searchSlotRef.value?.querySelectorAll('[data-search-suggestion]')[data]?.scrollIntoView({ block: 'nearest' })
      }
    }

    const toggleSourceMenu = () => {
      sourceMenuVisible.value = !sourceMenuVisible.value
    }
    const selectSource = value => {
      selectedSource.value = value
      // 浏览页也会更新 selectedSource；只有手动选择才保存为搜索偏好。
      void setSearchSetting({ source: value })
      sourceMenuVisible.value = false
      if (isFocused.value) searchSlotRef.value?.querySelector('input')?.focus({ preventScroll: true })
      if (route.name != 'Search' || route.query.source == value) return

      const { albumId, albumSource, albumName, albumSinger, albumPic, ...query } = route.query
      const target = { path: '/search', query: { ...query, source: value, page: 1 } }
      const targetPath = router.resolve(target).fullPath
      sourceChangePath = targetPath
      void router.replace(target).catch(_ => _).finally(() => {
        if (sourceChangePath == targetPath) sourceChangePath = null
      })
    }
    const search = text => {
      searchText.value = text
      handleSearch()
    }
    const refreshHotSearch = () => { void loadHotSearch(true) }
    const handleOutside = event => {
      if (!searchSlotRef.value?.contains(event.target)) {
        closePanel()
      }
    }
    watch(() => route.fullPath, value => {
      // 仅本次切源的路由更新保留输入上下文，提交搜索和跨页导航仍正常收起。
      if (value != sourceChangePath) closePanel()
    })
    onMounted(() => {
      document.addEventListener('pointerdown', handleOutside, true)
      window.addEventListener('blur', closePanel)
    })
    onBeforeUnmount(() => {
      hotSearchRequestId++
      tipSearchGeneration++
      document.removeEventListener('pointerdown', handleOutside, true)
      window.removeEventListener('blur', closePanel)
    })

    return {
      searchText,
      tipList,
      isTipSearchLoading,
      selectedTipIndex,
      appSetting,
      closePanel,
      handleEscape,
      handleFocusOut,
      handleEvent,
      isFocused,
      panelVisible,
      sourceMenuVisible,
      sourceOptions,
      selectedSource,
      selectedSourceLabel,
      hotSearchList,
      isHotSearchLoading,
      historyList,
      historyExpanded,
      clearHistoryList,
      removeHistoryWord,
      toggleSourceMenu,
      selectSource,
      search,
      refreshHotSearch,
      searchSlotRef,
    }
  },
}

</script>

<style lang="less" module>
.searchSlot {
  position: relative;
  width: min(560px, calc(100vw - 340px));
  min-width: min(300px, calc(100vw - 48px));
  max-width: 100%;
  transition: width .32s cubic-bezier(.2, .75, .25, 1), transform .32s cubic-bezier(.2, .75, .25, 1);
  will-change: width, transform;

  &.focused {
    width: min(680px, calc(100vw - 260px));
    min-width: min(300px, calc(100vw - 260px));
    transform: translateY(-2px);
  }

  // Limit the material input container without affecting the sibling popovers.
  > :global(div:first-child) {
    width: 100%;
    max-width: none;
  }

  :global(input) {
    padding-left: 64px !important;
  }
}

.sourceButton {
  position: absolute;
  z-index: 3;
  top: 4px;
  left: 6px;
  width: 54px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: var(--color-font-label);
  border: 0;
  border-radius: 11px;
  background: rgb(from var(--color-font) r g b / .055);
  cursor: pointer;
  transition: color .15s ease, background-color .15s ease, transform .15s ease;
  &:hover { color: var(--color-primary); background: var(--color-primary-alpha-800); }
  &:active { transform: scale(.97); }
  svg { width: 19px; height: 19px; fill: currentColor; }
  i { width: 5px; height: 5px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(45deg) translateY(-2px); }
  &.menuOpen { color: var(--color-primary); background: var(--color-primary-alpha-800); i { transform: rotate(225deg) translate(-1px, -1px); } }
}

.sourceMenu {
  width: 100%;
  padding: 8px;
  box-sizing: border-box;
  color: var(--color-font);

  button {
    width: 100%;
    min-height: 42px;
    padding: 0 12px;
    display: flex;
    align-items: center;
    gap: 9px;
    color: var(--color-font-label);
    border: 1px solid transparent;
    border-radius: 10px;
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition: color .15s ease, border-color .15s ease, background-color .15s ease, transform .15s ease;
  }
  button:hover { color: var(--color-font); background: rgb(from var(--color-font) r g b / .06); }
  button:active { transform: scale(.985); }
  .activeSource { color: var(--color-primary); border-color: var(--color-primary-alpha-600); background: rgb(from var(--color-content-background) r g b / .92); }
  button > span:not([role="img"]) { min-width: 0; flex: 1; overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
  button > svg { width: 19px; height: 19px; flex: none; fill: currentColor; }
  .sourceCheck { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; }
}

.inlineSourceMenu {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  padding: 12px 16px;
  border-bottom: 1px solid rgb(from var(--color-font) r g b / .07);
  .sourceMenuHeading { grid-column: 1 / -1; }
}

.sourceMenuHeading {
  min-height: 24px;
  padding: 4px 9px 7px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 9px;
  color: var(--color-font-label);
  font-size: 10.5px;
  letter-spacing: .02em;
  strong { color: var(--color-font); font-size: 12px; font-weight: 650; }
  span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}

.searchPopover {
  position: absolute;
  z-index: 90;
  top: calc(100% + 9px);
  left: 0;
  width: 248px;
  max-width: 100%;
  max-height: min(620px, calc(100vh - 92px));
  box-sizing: border-box;
  overflow: auto;
  overscroll-behavior: contain;
  color: var(--color-font);
  border: 1px solid rgb(from var(--color-font) r g b / .1);
  border-radius: 20px;
  background:
    linear-gradient(145deg, rgb(from var(--color-content-background) r g b / .98), rgb(from var(--color-content-background) r g b / .92)),
    var(--color-content-background);
  box-shadow: 0 24px 64px rgba(24, 35, 31, .18), inset 0 1px rgba(255,255,255,.8);
  backdrop-filter: blur(30px) saturate(1.2);
  scrollbar-width: thin;
  scrollbar-color: rgb(from var(--color-font) r g b / .22) transparent;

  &::-webkit-scrollbar { width: 6px; height: 6px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { border-radius: 99px; background: rgb(from var(--color-font) r g b / .22); }
  &::-webkit-scrollbar-thumb:hover { background: rgb(from var(--color-font) r g b / .34); }
}

.expandedPopover { width: 100%; }
.searchPanel { padding: 16px; }

.suggestionList {
  display: grid;
  gap: 3px;
  padding-top: 0;
  button { height: 40px; padding: 0 11px; display: flex; align-items: center; gap: 10px; color: var(--color-font); border: 0; border-radius: 10px; background: transparent; cursor: pointer; font-size: 12px; text-align: left; }
  button:hover, button:focus-visible, .selectedSuggestion { background: rgb(from var(--color-font) r g b / .06); }
  svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.7; }
  p { padding: 16px 12px; color: var(--color-font-label); font-size: 12px; text-align: center; }
}

.discoveryPanel {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  padding-top: 0;
  > :only-child { grid-column: 1 / -1; }
}
.panelSection {
  min-width: 0;
  min-height: 0;
  padding: 8px;
  & + & { padding-top: 18px; border-top: 1px solid var(--color-primary-alpha-600); }
  header { min-height: 24px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  strong { min-width: 0; overflow: hidden; font-size: 13px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
  header button { flex: none; padding: 4px 8px; color: var(--color-font-label); border: 0; border-radius: 8px; background: transparent; cursor: pointer; font-size: 10.5px; }
  header button:hover { color: var(--color-primary); }
}

.historySection { align-self: start; box-sizing: border-box; }
.hotSection { min-height: 0; }
.historyMore { margin-top: 10px; padding: 5px 0; color: var(--color-primary); border: 0; background: transparent; cursor: pointer; font-size: 11px; }
.chips { display: flex; flex-wrap: wrap; align-content: flex-start; gap: 8px; button { max-width: 100%; padding: 8px 11px; overflow: hidden; color: var(--color-font); border: 0; border-radius: 10px; background: rgb(from var(--color-font) r g b / .055); cursor: pointer; font-size: 11.5px; text-overflow: ellipsis; white-space: nowrap; transition: color .15s ease, background-color .15s ease; } button:hover { color: var(--color-primary); background: var(--color-primary-alpha-800); } }
.emptyHistory { min-height: 88px; display: flex; align-items: center; justify-content: center; color: var(--color-font-label); font-size: 11.5px; line-height: 1.5; text-align: center; }
.hotList { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px 14px; li { min-width: 0; } button { width: 100%; height: 44px; padding: 0 7px; display: flex; align-items: center; gap: 8px; color: var(--color-font); border: 0; border-radius: 9px; background: transparent; cursor: pointer; text-align: left; transition: background-color .15s ease; } button:hover { background: rgb(from var(--color-font) r g b / .055); } b { width: 20px; color: var(--color-font-label); font-size: 10.5px; font-weight: 600; text-align: center; } li:nth-child(-n+3) b { color: var(--color-primary); } span { min-width: 0; overflow: hidden; font-size: 11.5px; text-overflow: ellipsis; white-space: nowrap; } }
.loading { min-height: 88px; display: flex; align-items: center; justify-content: center; padding: 12px 6px; color: var(--color-font-label); font-size: 11.5px; text-align: center; }

@media (max-width: 940px) {
  .searchSlot,
  .searchSlot.focused {
    width: min(680px, calc(100vw - 160px));
    min-width: min(240px, calc(100vw - 36px));
  }
  // The panel lives inside #right (which intentionally clips the app chrome).
  // Keep it tied to the search slot at narrow widths so it cannot spill under
  // the sidebar or be cut off by the window edge.
  .searchPopover { max-height: min(600px, calc(100vh - 84px)); }
}

@media (max-width: 760px) {
  .searchSlot,
  .searchSlot.focused {
    width: calc(100vw - 36px);
    min-width: 0;
  }
  .searchPopover { max-height: min(600px, calc(100vh - 72px)); border-radius: 17px; }
  .searchPanel { padding: 12px; }
  .inlineSourceMenu { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 10px 12px; }
  .discoveryPanel { grid-template-columns: 1fr; gap: 9px; }
  .panelSection { min-height: 0; padding: 12px; }
  .hotList { grid-template-columns: 1fr; }
}

@media (max-width: 420px) {
  .searchPanel { padding: 9px; }
  .panelSection { padding: 10px; }
}
</style>
