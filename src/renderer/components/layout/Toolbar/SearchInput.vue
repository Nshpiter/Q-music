<template>
  <div ref="searchSlotRef" :class="[$style.searchSlot, { [$style.focused]: isFocused }]">
    <material-search-input v-model="searchText" :placeholder="$t('search')" :list="[]" :visible-list="false" @event="handleEvent" />
    <button type="button" :class="$style.sourceButton" :title="selectedSourceLabel" @mousedown.prevent @click.stop="togglePanel">
      <source-icon v-if="selectedSource != 'all'" :source="selectedSource" :size="18" />
      <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z" /></svg>
      <i aria-hidden="true" />
    </button>
    <transition enter-active-class="animated-fast fadeIn" leave-active-class="animated-fast fadeOut">
      <section v-if="panelVisible" :class="$style.searchPanel" @mousedown.prevent>
        <div :class="$style.panelHeading">
          <strong>{{ $t('search__source_select') }}</strong>
          <span>{{ selectedSourceLabel }}</span>
        </div>
        <div :class="$style.sourceRow">
          <button
            v-for="item in sourceOptions" :key="item.id" type="button"
            :class="{ [$style.activeSource]: selectedSource == item.id }" :title="item.label"
            @click="selectSource(item.id)"
          >
            <source-icon v-if="item.id != 'all'" :source="item.id" :size="20" />
            <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z" /></svg>
            <span>{{ item.label }}</span>
          </button>
        </div>

        <div v-if="searchText" :class="$style.suggestionList">
          <button v-for="item in tipList" :key="item" type="button" @click="search(item)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.8 5.2a5.6 5.6 0 1 0 0 11.2 5.6 5.6 0 0 0 0-11.2zm4.1 9.7 4 4" /></svg>
            <span>{{ item }}</span>
          </button>
          <p v-if="!tipList.length">{{ $t('search__hot_search_loading') }}</p>
        </div>
        <div v-else :class="$style.discoveryPanel">
          <div :class="[$style.panelSection, $style.historySection]">
            <header><strong>{{ $t('history_search') }}</strong><button v-if="historyList.length" type="button" @click="clearHistoryList">{{ $t('history_clear') }}</button></header>
            <div v-if="historyList.length" :class="$style.chips">
              <button v-for="(item, index) in historyList.slice(0, 10)" :key="item" type="button" @click="search(item)" @contextmenu.prevent="removeHistoryWord(index)">{{ item }}</button>
            </div>
            <div v-else :class="$style.emptyHistory">{{ $t('history_search_empty') }}</div>
          </div>
          <div :class="[$style.panelSection, $style.hotSection]">
            <header><strong>{{ selectedSourceLabel }} · {{ $t('search__hot_search') }}</strong><button type="button" @click="refreshHotSearch">{{ $t('search__hot_search_refresh') }}</button></header>
            <div v-if="isHotSearchLoading" :class="$style.loading">{{ $t('search__hot_search_loading') }}</div>
            <ol v-else-if="hotSearchList.length" :class="$style.hotList">
              <li v-for="(item, index) in hotSearchList.slice(0, 10)" :key="item"><button type="button" @click="search(item)"><b>{{ index + 1 }}</b><span>{{ item }}</span></button></li>
            </ol>
            <div v-else :class="$style.loading">{{ $t('search__hot_search_empty') }}</div>
          </div>
        </div>
      </section>
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
  nextTick,
} from '@common/utils/vueTools'
import { useRouter, useRoute } from '@common/utils/vueRouter'
import { historyList, searchText as _searchText, selectedSource } from '@renderer/store/search/state'
import { clearHistoryList, getHistoryList, removeHistoryWord, setSearchText } from '@renderer/store/search/action'
import { clearList, getList } from '@renderer/store/hotSearch'
import { getSearchSetting, setSearchSetting } from '@renderer/utils/data'
import SourceIcon from '@renderer/components/common/SourceIcon.vue'

export default {
  components: { SourceIcon },
  setup() {
    const searchText = ref('')
    const tipList = ref([])
    const isFocused = ref(false)
    const panelPinned = ref(false)
    const searchSlotRef = ref(null)
    const hotSearchList = shallowRef([])
    const isHotSearchLoading = ref(false)
    let hotSearchRequestId = 0
    let sourceRouteTimer = null

    const route = useRoute()
    const router = useRouter()
    const sourceOptions = computed(() => {
      const options = music.sources.filter(item => item.id != 'xm').map(item => ({ id: item.id, label: window.i18n.t(`source_${item.id}`) }))
      return route.name == 'SongList'
        ? options
        : [{ id: 'all', label: window.i18n.t('source_all') }, ...options]
    })
    const selectedSourceLabel = computed(() => sourceOptions.value.find(item => item.id == selectedSource.value)?.label ?? window.i18n.t('source_all'))
    const panelVisible = computed(() => isFocused.value || panelPinned.value)

    getSearchSetting().then(setting => {
      if (route.query.source != null || route.name == 'SongList') return
      selectedSource.value = setting.source ?? 'all'
    }).catch(() => {})

    watch(() => route.query.source, value => {
      if (typeof value == 'string' && sourceOptions.value.some(item => item.id == value)) selectedSource.value = value
    }, { immediate: true })

    watch(() => route.name, (newValue, oldValue) => {
      if (oldValue == 'Search' && newValue != 'SongListDetail') {
        setTimeout(() => {
          searchText.value = ''
          setSearchText('')
        })
      }
    })

    watch(_searchText, (newValue, oldValue) => {
      searchText.value = newValue
      if (newValue !== searchText.value) searchText.value = newValue
    })
    watch(searchText, () => {
      handleTipSearch()
    })


    const tipSearch = debounce(async() => {
      if (searchText.value === '') {
        tipList.value = []
        return
      }
      const { temp_source } = await getSearchSetting().catch(() => ({ ...DEFAULT_SETTING.search }))
      if (!music[temp_source]?.tipSearch) {
        tipList.value = []
        return
      }
      music[temp_source].tipSearch.search(searchText.value).then(list => {
        tipList.value = list
      }).catch(() => {})
    }, 50)

    const handleTipSearch = () => {
      tipSearch()
    }

    const loadHotSearch = async(force = false) => {
      const source = selectedSource.value
      const requestId = ++hotSearchRequestId
      if (force) clearList(source)
      isHotSearchLoading.value = true
      try {
        const list = await getList(source)
        if (requestId == hotSearchRequestId) hotSearchList.value = list
      } catch {
        if (requestId == hotSearchRequestId) hotSearchList.value = []
      } finally {
        if (requestId == hotSearchRequestId) isHotSearchLoading.value = false
      }
    }

    watch(selectedSource, () => {
      void setSearchSetting({ source: selectedSource.value })
      if (panelVisible.value && !searchText.value) void loadHotSearch()
      if (searchText.value) handleTipSearch()
    })

    const handleSearch = () => {
      panelPinned.value = false
      if (!searchText.value && route.path != '/search') {
        setSearchText('')
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
          isFocused.value = true
          void getHistoryList()
          if (!searchText.value) void loadHotSearch()
          if (searchText.value) handleTipSearch()
          break
        case 'blur':
          isFocused.value = false
          break
        case 'submit':
          handleSearch()
          break
        case 'listClick':
          searchText.value = tipList.value[data]
          void nextTick(handleSearch)
      }
    }

    const togglePanel = () => {
      panelPinned.value = !panelPinned.value
      if (panelPinned.value && !searchText.value) void loadHotSearch()
    }
    const selectSource = value => {
      selectedSource.value = value
      const routeSearchText = typeof route.query.text == 'string' ? route.query.text.trim() : ''
      if (route.name != 'Search' || !routeSearchText) return

      if (sourceRouteTimer) clearTimeout(sourceRouteTimer)
      sourceRouteTimer = setTimeout(() => {
        sourceRouteTimer = null
        if (route.name != 'Search' || route.query.source == value) return
        void router.replace({ path: '/search', query: { ...route.query, source: value, page: 1 } }).catch(_ => _)
      }, 120)
    }
    const search = text => {
      searchText.value = text
      void nextTick(handleSearch)
    }
    const refreshHotSearch = () => { void loadHotSearch(true) }
    const handleOutside = event => {
      if (!searchSlotRef.value?.contains(event.target)) panelPinned.value = false
    }
    onMounted(() => { document.addEventListener('mousedown', handleOutside) })
    onBeforeUnmount(() => {
      document.removeEventListener('mousedown', handleOutside)
      if (sourceRouteTimer) clearTimeout(sourceRouteTimer)
    })

    return {
      searchText,
      tipList,
      handleEvent,
      isFocused,
      panelVisible,
      sourceOptions,
      selectedSource,
      selectedSourceLabel,
      hotSearchList,
      isHotSearchLoading,
      historyList,
      clearHistoryList,
      removeHistoryWord,
      togglePanel,
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
  width: min(560px, 58vw);
  min-width: 300px;
  transition: width .32s cubic-bezier(.2, .75, .25, 1), transform .32s cubic-bezier(.2, .75, .25, 1);
  will-change: width, transform;

  &.focused {
    width: min(640px, 64vw);
    transform: translateY(-1px);
  }

  > :global(div) {
    width: 100%;
    max-width: none;
  }

  :global(input) {
    padding-left: 62px !important;
  }
}

.sourceButton {
  position: absolute;
  z-index: 3;
  top: 5px;
  left: 7px;
  width: 46px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: var(--color-font-label);
  border: 0;
  border-radius: 10px;
  background: rgb(from var(--color-font) r g b / .055);
  cursor: pointer;
  transition: color .15s ease, background-color .15s ease;
  &:hover { color: var(--color-primary); background: var(--color-primary-alpha-800); }
  svg { width: 17px; height: 17px; fill: currentColor; }
  i { width: 5px; height: 5px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(45deg) translateY(-2px); }
}

.searchPanel {
  position: absolute;
  z-index: 90;
  top: 46px;
  left: 0;
  width: 100%;
  max-height: min(540px, calc(100vh - 110px));
  padding: 14px;
  box-sizing: border-box;
  overflow: auto;
  color: var(--color-font);
  border: 1px solid rgb(from var(--color-font) r g b / .1);
  border-radius: 18px;
  background:
    linear-gradient(145deg, rgb(from var(--color-content-background) r g b / .98), rgb(from var(--color-content-background) r g b / .92)),
    var(--color-content-background);
  box-shadow: 0 20px 50px rgba(24, 35, 31, .16), inset 0 1px rgba(255,255,255,.76);
  backdrop-filter: blur(30px) saturate(1.18);
}

.panelHeading {
  height: 22px;
  margin: 0 2px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  strong { font-size: 11px; font-weight: 600; letter-spacing: .02em; }
  span { color: var(--color-font-label); font-size: 10px; }
}

.sourceRow {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 5px;
  padding: 5px;
  border: 1px solid rgb(from var(--color-font) r g b / .07);
  border-radius: 14px;
  background: rgb(from var(--color-font) r g b / .025);
  button { min-width: 0; height: 36px; padding: 0 6px; display: flex; align-items: center; justify-content: center; gap: 5px; color: var(--color-font-label); border: 1px solid transparent; border-radius: 10px; background: transparent; cursor: pointer; transition: color .15s ease, border-color .15s ease, background-color .15s ease, box-shadow .15s ease; }
  button:hover { color: var(--color-font); background: rgb(from var(--color-content-background) r g b / .72); }
  .activeSource { color: var(--color-primary); border-color: var(--color-primary-alpha-600); background: rgb(from var(--color-content-background) r g b / .92); box-shadow: 0 4px 12px rgba(28, 55, 44, .08); }
  svg { width: 17px; height: 17px; flex: none; fill: currentColor; }
  span { min-width: 0; overflow: hidden; font-size: 10.5px; text-overflow: ellipsis; white-space: nowrap; }
}

.suggestionList {
  display: grid;
  gap: 2px;
  padding-top: 8px;
  button { height: 36px; padding: 0 10px; display: flex; align-items: center; gap: 9px; color: var(--color-font); border: 0; border-radius: 9px; background: transparent; cursor: pointer; text-align: left; }
  button:hover { background: rgb(from var(--color-font) r g b / .06); }
  svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.7; }
  p { padding: 12px; color: var(--color-font-label); font-size: 12px; }
}

.discoveryPanel {
  display: grid;
  grid-template-columns: minmax(170px, .75fr) minmax(0, 1.4fr);
  gap: 10px;
  padding-top: 10px;
}
.panelSection {
  min-width: 0;
  padding: 11px 12px;
  border: 1px solid rgb(from var(--color-font) r g b / .07);
  border-radius: 14px;
  background: rgb(from var(--color-font) r g b / .025);
  header { height: 20px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; }
  strong { overflow: hidden; font-size: 11.5px; text-overflow: ellipsis; white-space: nowrap; }
  header button { padding: 3px 7px; color: var(--color-font-label); border: 0; background: transparent; cursor: pointer; font-size: 10px; }
  header button:hover { color: var(--color-primary); }
}
.historySection { align-self: start; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; button { max-width: 100%; padding: 6px 9px; overflow: hidden; color: var(--color-font); border: 0; border-radius: 8px; background: rgb(from var(--color-font) r g b / .05); cursor: pointer; font-size: 10.5px; text-overflow: ellipsis; white-space: nowrap; } button:hover { color: var(--color-primary); background: var(--color-primary-alpha-800); } }
.emptyHistory { min-height: 42px; display: flex; align-items: center; color: var(--color-font-label); font-size: 10.5px; line-height: 1.5; }
.hotList { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3px 12px; li { min-width: 0; } button { width: 100%; height: 32px; padding: 0 6px; display: flex; align-items: center; gap: 8px; color: var(--color-font); border: 0; border-radius: 8px; background: transparent; cursor: pointer; text-align: left; } button:hover { background: rgb(from var(--color-font) r g b / .055); } b { width: 18px; color: var(--color-font-label); font-size: 10px; text-align: center; } li:nth-child(-n+3) b { color: var(--color-primary); } span { min-width: 0; overflow: hidden; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; } }
.loading { padding: 12px 6px; color: var(--color-font-label); font-size: 11px; }

@media (max-width: 940px) {
  .searchSlot,
  .searchSlot.focused {
    width: min(430px, 52vw);
    min-width: 240px;
  }
  .sourceRow { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .discoveryPanel { grid-template-columns: 1fr; }
}
</style>
