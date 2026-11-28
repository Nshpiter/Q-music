<template>
  <div :class="$style.main">
    <div :class="$style.sidebar">
      <div :class="$style.searchBox">
        <svg-icon :class="$style.searchIcon" name="search-2" />
        <input
          v-model="searchQuery"
          type="search"
          role="searchbox"
          :class="$style.searchInput"
          :placeholder="$t('setting__search')"
          :aria-label="$t('setting__search')"
          @keydown.esc="searchQuery = ''"
        >
        <button
          v-if="searchQuery"
          type="button"
          :class="$style.searchClear"
          :aria-label="$t('setting_search_clear')"
          @click="searchQuery = ''"
        >×</button>
      </div>
      <div class="scroll" :class="$style.toc">
        <ul ref="tocRef" :class="$style.tocList" role="tablist" aria-label="设置分类" aria-orientation="vertical">
          <li
            v-show="indicator.height > 0 && !searchQuery.trim()" role="presentation" aria-hidden="true"
            :class="[$style.tocIndicator, { [$style.tocIndicatorReady]: indicatorReady }]"
            :style="{ transform: `translateY(${indicator.top}px)`, height: `${indicator.height}px` }"
          />
          <template v-for="(h2, index) in tocList" :key="h2.id">
            <li v-if="h2.groupHeader" role="presentation" :class="$style.tocGroup">{{ $t(h2.groupHeader) }}</li>
            <li :class="$style.tocListItem" role="presentation">
              <button
                :id="`${h2.id}-tab`" type="button" :tabindex="avtiveComponentName == h2.id ? 0 : -1" aria-controls="setting-panel"
                :class="[$style.tocH2, {[$style.active]: avtiveComponentName == h2.id && !searchQuery.trim() }]"
                role="tab" :aria-selected="avtiveComponentName == h2.id && !searchQuery.trim()"
                :aria-label="h2.title" ignore-tip @click="toggleTab(h2.id)" @keydown="handleTabKey($event, index)"
              >
                <span :class="$style.tocIcon">
                  <svg-icon :name="h2.icon" />
                </span>
                <span :class="$style.tocTitle">{{ h2.title }}</span>
              </button>
            </li>
          </template>
        </ul>
      </div>
    </div>
    <div id="setting-panel" ref="dom_content_ref" class="scroll" :class="$style.setting" role="tabpanel" :aria-labelledby="`${avtiveComponentName}-tab`" tabindex="0">
      <div v-if="searchQuery.trim()" :key="`search:${searchResults.length}`" :class="[$style.panel, $style.searchResults]">
        <div :class="$style.searchSummary" role="status">
          <span>{{ searchResults.length ? $t('setting_search_count', { count: searchResults.length }) : $t('setting_search_empty') }}</span>
          <button type="button" :class="$style.searchResetBtn" @click="searchQuery = ''">{{ $t('setting_search_clear') }}</button>
        </div>
        <div v-if="searchResults.length" :class="$style.searchCard">
          <button
            v-for="(item, idx) in searchResults"
            :key="`${item.tab}:${item.section}`"
            type="button"
            :class="[$style.searchRow, { [$style.searchRowBorder]: idx > 0 }]"
            @click="jumpToSetting(item.tab, item.section)"
          >
            <span :class="$style.searchRowText">
              <strong>{{ $t(item.titleKey) }}</strong>
              <small>{{ item.tabTitle }}</small>
            </span>
            <span :class="$style.searchJump">{{ $t('setting_open_section') }} ›</span>
          </button>
        </div>
      </div>
      <dl v-else>
        <div :key="avtiveComponentName" :class="$style.panel">
          <component :is="avtiveComponentName" @jump="jumpToSetting" />
        </div>
      </dl>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'
import { useRoute, useRouter } from '@common/utils/vueRouter'

import SettingOverview from './components/SettingOverview.vue'
import SettingBasic from './components/SettingBasic.vue'
import SettingPlay from './components/SettingPlay.vue'
import SettingPlayDetail from './components/SettingPlayDetail.vue'
import SettingDesktopLyric from './components/SettingDesktopLyric.vue'
import SettingSearch from './components/SettingSearch.vue'
import SettingList from './components/SettingList.vue'
import SettingDownload from './components/SettingDownload.vue'
import SettingSync from './components/SettingSync/index.vue'
import SettingOpenAPI from './components/SettingOpenAPI.vue'
import SettingHotKey from './components/SettingHotKey.vue'
import SettingNetwork from './components/SettingNetwork.vue'
import SettingOdc from './components/SettingOdc.vue'
import SettingBackup from './components/SettingBackup.vue'
import SettingOther from './components/SettingOther.vue'
import SettingUpdate from './components/SettingUpdate.vue'
import SettingAbout from './components/SettingAbout.vue'
import { SETTING_TABS, matchSettingEntries, focusSettingSection } from './settingCatalog'
import { logRendererState } from '@renderer/utils/debugLog'

export default {
  name: 'Setting',
  components: {
    SettingOverview,
    SettingBasic,
    SettingPlay,
    SettingPlayDetail,
    SettingDesktopLyric,
    SettingSearch,
    SettingList,
    SettingDownload,
    SettingSync,
    SettingOpenAPI,
    SettingHotKey,
    SettingNetwork,
    SettingOdc,
    SettingBackup,
    SettingOther,
    SettingUpdate,
    SettingAbout,
  },
  setup() {
    const t = useI18n()
    const route = useRoute()
    const router = useRouter()

    const dom_content_ref = ref(null)
    const searchQuery = ref('')

    const tocList = computed(() => {
      let prevGroup = null
      return SETTING_TABS.map(tab => {
        const groupHeader = tab.group && tab.group !== prevGroup ? tab.group : ''
        if (tab.group) prevGroup = tab.group
        return {
          id: tab.id,
          title: t(tab.titleKey),
          icon: tab.icon,
          groupHeader,
        }
      })
    })

    const searchResults = computed(() => matchSettingEntries(searchQuery.value, t))

    const avtiveComponentName = ref(route.query.name && tocList.value.some(item => item.id == route.query.name)
      ? route.query.name
      : tocList.value[0].id)

    const activeIndex = computed(() => tocList.value.findIndex(item => item.id == avtiveComponentName.value))
    const tocRef = ref(null)
    const indicator = reactive({ top: 0, height: 0 })
    const indicatorReady = ref(false)
    const updateIndicator = () => {
      const list = tocRef.value
      const target = list?.querySelector('[role="tab"][aria-selected="true"]')
      if (!target) { indicator.height = 0; return }
      const bounds = target.getBoundingClientRect()
      indicator.top = bounds.top - list.getBoundingClientRect().top
      indicator.height = bounds.height
    }
    watch([activeIndex, tocList, searchQuery], updateIndicator, { flush: 'post' })
    let resizeObserver
    let readyFrame = 0

    onMounted(() => {
      updateIndicator()
      resizeObserver = new ResizeObserver(updateIndicator)
      resizeObserver.observe(tocRef.value)
      readyFrame = requestAnimationFrame(() => {
        indicatorReady.value = true
      })
    })
    onBeforeUnmount(() => {
      resizeObserver?.disconnect()
      cancelAnimationFrame(readyFrame)
    })

    const focusSection = async(section) => {
      await nextTick()
      focusSettingSection(section, dom_content_ref.value)
    }

    const toggleTab = id => {
      searchQuery.value = ''
      avtiveComponentName.value = id
      logRendererState('setting:toggleTab', { id })
      // 内容整页替换并淡入，直接回到顶部，不再从旧位置平滑滚动
      void nextTick(() => {
        if (dom_content_ref.value) dom_content_ref.value.scrollTop = 0
      })
    }

    const jumpToSetting = (id, section) => {
      if (!tocList.value.some(tab => tab.id === id)) return
      searchQuery.value = ''
      avtiveComponentName.value = id
      logRendererState('setting:jumpToSetting', { id, section })
      void router.replace({ path: '/setting', query: section ? { name: id, section } : { name: id } })
      if (typeof section === 'string' && section) {
        void focusSection(section)
      } else {
        void nextTick(() => {
          if (dom_content_ref.value) dom_content_ref.value.scrollTop = 0
        })
      }
    }

    watch(() => [route.query.name, route.query.section], async([name, section], _, cleanup) => {
      if (route.path !== '/setting' || !tocList.value.some(tab => tab.id === name)) return
      searchQuery.value = ''
      avtiveComponentName.value = name
      if (typeof section !== 'string') return
      let active = true
      cleanup(() => { active = false })
      await nextTick()
      if (!active) return
      void focusSection(section)
    }, { immediate: true, flush: 'post' })

    const handleTabKey = (event, index) => {
      const last = tocList.value.length - 1
      let next
      switch (event.key) {
        case 'ArrowDown': next = index == last ? 0 : index + 1; break
        case 'ArrowUp': next = index == 0 ? last : index - 1; break
        case 'Home': next = 0; break
        case 'End': next = last; break
        default: return
      }
      event.preventDefault()
      const tab = event.currentTarget.closest('ul').querySelectorAll('[role="tab"]')[next]
      toggleTab(tocList.value[next].id)
      void nextTick(() => { tab?.focus(); tab?.scrollIntoView({ block: 'nearest' }) })
    }

    return {
      tocList,
      tocRef,
      indicator,
      indicatorReady,
      avtiveComponentName,
      dom_content_ref,
      searchQuery,
      searchResults,
      toggleTab,
      jumpToSetting,
      handleTabKey,
    }
  },
  // mounted() {
  //   this.initTOC()
  // },
  // methods: {
  //   initTOC() {
  //     const list = this.$refs.dom_setting_list.children
  //     const toc = []
  //     let prevTitle
  //     for (const item of list) {
  //       if (item.tagName == 'DT') {
  //         prevTitle = {
  //           title: item.innerText.replace(/[（(].+?[)）]/, ''),
  //           id: item.getAttribute('id'),
  //           dom: item,
  //           children: [],
  //         }
  //         toc.push(prevTitle)
  //         continue
  //       }
  //       const h3 = item.querySelector('h3')
  //       if (h3) {
  //         prevTitle.children.push({
  //           title: h3.innerText.replace(/[（(].+?[)）]/, ''),
  //           id: h3.getAttribute('id'),
  //           dom: h3,
  //         })
  //       }
  //     }
  //     console.log(toc)
  //     this.toc.list = toc
  //   },
  //   handleListScroll(event) {
  //     // console.log(event.target.scrollTop)
  //   },
  // },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.main {
  display: flex;
  flex-flow: row nowrap;
  height: 100%;
  gap: 16px;
  padding: 16px 0 calc(@height-player + 18px) 18px;
  box-sizing: border-box;
  border-top: var(--color-list-header-border-bottom);
  background:
    linear-gradient(135deg, var(--q-surface-soft), var(--q-surface-strong)),
    radial-gradient(circle at 18% 18%, var(--color-primary-alpha-900), transparent 34%);
}

.sidebar {
  flex: 0 0 226px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 10px;
}

.searchBox {
  position: relative;
  display: flex;
  align-items: center;
  margin-right: 4px;
}

.searchIcon {
  position: absolute;
  left: 11px;
  width: 14px;
  height: 14px;
  color: var(--color-font-label);
  pointer-events: none;
}

.searchInput {
  width: 100%;
  box-sizing: border-box;
  height: 34px;
  padding: 0 28px 0 32px;
  border: none;
  border-radius: 14px;
  font: inherit;
  font-size: 12.5px;
  color: var(--color-font);
  background: var(--q-surface);
  box-shadow: inset 0 0 0 1px var(--q-border);
  outline: none;
  transition: background-color @transition-fast, box-shadow @transition-fast;

  &::placeholder {
    color: var(--color-font-label);
  }

  &:focus-visible {
    background: var(--q-surface-strong);
    box-shadow: inset 0 0 0 1px var(--color-primary-alpha-400), 0 0 0 3px var(--color-primary-alpha-900);
  }

  &::-webkit-search-cancel-button {
    display: none;
  }
}

.searchClear {
  position: absolute;
  right: 7px;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: rgb(from var(--color-font) r g b / .1);
  color: var(--color-font);
  font-size: 14px;
  line-height: 1;
  display: grid;
  place-items: center;
  cursor: pointer;

  &:hover {
    background: rgb(from var(--color-font) r g b / .18);
  }
}

.toc {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 2px 4px 0;
  box-sizing: border-box;
}
.tocList {
  position: relative;
  display: flex;
  flex-flow: column nowrap;
  gap: 6px;
}
.tocGroup {
  padding: 10px 10px 2px;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-font-label);
  letter-spacing: .03em;
  user-select: none;
}

.searchResults {
  max-width: 980px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.searchSummary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 6px 2px;
  font-size: 12.5px;
  color: var(--color-font-label);
}

.searchResetBtn {
  border: 1px solid var(--q-outline);
  border-radius: 999px;
  padding: 4px 12px;
  background: var(--q-surface);
  color: var(--color-font);
  font-size: 12px;
  cursor: pointer;

  &:hover {
    color: var(--color-primary);
    border-color: var(--color-primary-alpha-600);
  }
}

.searchCard {
  border-radius: 20px;
  background: var(--q-surface);
  box-shadow: inset 0 0 0 1px var(--q-border), 0 12px 32px rgba(78, 94, 112, .06);
  backdrop-filter: blur(12px);
  overflow: hidden;
}

.searchRow {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 16px;
  border: none;
  background: transparent;
  color: var(--color-font);
  text-align: left;
  cursor: pointer;
  transition: background-color .16s ease;

  &:hover {
    background: var(--q-surface-soft);
    .searchJump {
      color: var(--color-primary);
      transform: translateX(2px);
    }
  }
}

.searchRowBorder {
  border-top: 1px solid rgb(from var(--color-font) r g b / .06);
}

.searchRowText {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;

  strong {
    font-size: 13.5px;
    font-weight: 650;
  }

  small {
    font-size: 11.5px;
    color: var(--color-font-label);
  }
}

.searchJump {
  flex: none;
  font-size: 12px;
  color: var(--color-font-label);
  transition: color .16s ease, transform .16s ease;
}
// 选中底块跟随分类的实际尺寸，兼容字号与窗口缩放。
.tocIndicator {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 42px;
  border-radius: 16px;
  pointer-events: none;
  background-color: var(--q-surface-strong);
  box-shadow: inset 0 0 0 1px var(--q-border), 0 14px 30px rgba(72, 91, 112, .08);
}
.tocIndicatorReady {
  transition: transform .42s cubic-bezier(.22, 1, .36, 1), height .28s cubic-bezier(.22, 1, .36, 1);
}
@media (prefers-reduced-motion: reduce) {
  .tocIndicatorReady, .panel, .searchInput, .searchRow, .searchJump { transition: none; animation: none; }
}
.panel {
  animation: q-setting-panel-in .36s cubic-bezier(.22, 1, .36, 1);
}
@keyframes q-setting-panel-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes q-details-reveal {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes q-setting-target-pulse {
  0% { box-shadow: 0 0 0 0 var(--color-primary-alpha-400); background: var(--color-primary-alpha-900); }
  55% { box-shadow: 0 0 0 6px transparent; background: var(--color-primary-alpha-900); }
  100% { box-shadow: 0 0 0 0 transparent; background: transparent; }
}
.tocH2 {
  position: relative;
  width: 100%;
  border: 0;
  background: transparent;
  text-align: left;
  min-width: 0;
  height: 42px;
  line-height: 1;
  .mixin-ellipsis-1();
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0;
  color: var(--color-font);
  padding: 0 12px 0 8px;
  border-radius: 16px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: @transition-fast;
  transition-property: background-color, color, box-shadow, transform;
  &:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }

  &:not(.active) {
    cursor: pointer;
    &:hover {
      background-color: var(--q-surface);
      box-shadow: inset 0 0 0 1px var(--q-border);
      .tocIcon {
        color: var(--color-primary);
        background-color: var(--color-primary-alpha-900);
      }
    }
  }
  &.active {
    color: var(--color-primary-dark-300);

    .tocIcon {
      color: #fff;
      background: linear-gradient(145deg, var(--color-primary-light-100), var(--color-primary));
      box-shadow: 0 8px 18px var(--color-primary-alpha-700), inset 0 1px 0 var(--q-border);
    }
  }
}
.tocIcon {
  width: 30px;
  height: 30px;
  flex: none;
  border-radius: 10px;
  // 未选中用中性灰，只有 hover/选中才上主色，避免整列全绿显脏
  color: var(--color-500);
  background-color: var(--q-surface);
  box-shadow: inset 0 0 0 1px var(--q-border);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: @transition-fast;
  transition-property: color, background-color, box-shadow;

  :global(.svg-icon) {
    width: 16px;
    height: 16px;
    vertical-align: 0;
  }
}
.tocTitle {
  min-width: 0;
  .mixin-ellipsis-1();
}
// .tocH3 {
//   font-size: 13px;
//   opacity: .8;
// }

// .tocList {
//   .tocList {
//     // padding-left: 15px;
//   }
// }
// .tocSubListItem {
//   padding-top: 10px;
// }

.setting {
  flex: 1;
  min-width: 0;
  padding: 0 24px 6px 0;
  font-size: 14px;
  box-sizing: border-box;
  overflow-y: auto;
  height: 100%;
  position: relative;

  :global {
    dl {
      max-width: 980px;
      margin: 0 auto;
      padding-bottom: 18px;
    }

    dt {
      border-left: none;
      padding: 13px 16px;
      margin: 0 0 12px;
      border-radius: 20px;
      color: var(--color-font);
      font-size: 17px;
      font-weight: 750;
      letter-spacing: 0;
      background: var(--q-surface);
      box-shadow: inset 0 0 0 1px var(--q-border), 0 18px 42px rgba(75, 92, 109, .08);

      + dd h3 {
        margin-top: 0;
      }
    }

    dd {
      margin: 0 0 10px;
      padding: 13px 16px;
      border-radius: 18px;
      color: var(--color-font);
      background: var(--q-surface);
      box-shadow: inset 0 0 0 1px var(--q-border), 0 12px 32px rgba(78, 94, 112, .06);
      backdrop-filter: blur(12px);

      > div {
        padding: 0;
      }

    }
    h3 {
      font-size: 12px;
      line-height: 1.4;
      margin: 0 0 12px;
      color: var(--color-font-label);
      font-weight: 700;
      letter-spacing: 0;
    }
    .p {
      padding: 4px 0;
      line-height: 1.55;
      .btn {
        + .btn {
          margin-left: 10px;
        }
      }
    }

    .help-btn {
      width: 28px;
      height: 28px;
      padding: 0;
      margin: 0 0.4em;
      border: none;
      border-radius: 10px;
      background: var(--q-surface);
      color: var(--color-button-font);
      cursor: pointer;
      transition: @transition-fast;
      transition-property: background-color, color, transform;
      &:hover {
        color: var(--color-primary-dark-300);
        background: var(--q-surface-strong);
        transform: translateY(-1px);
      }
    }
    .help-icon {
      margin: 0 0.4em;
    }

    .q-section-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: -4px 0 12px;
    }

    .q-section-pill {
      border: 1px solid var(--q-outline);
      border-radius: 999px;
      padding: 5px 12px;
      background: var(--q-surface);
      color: var(--color-font);
      font: inherit;
      font-size: 12px;
      font-weight: 550;
      cursor: pointer;
      transition: background-color @transition-fast, border-color @transition-fast, color @transition-fast, transform @transition-fast;

      &:hover {
        color: var(--color-primary);
        border-color: var(--color-primary-alpha-600);
        background: var(--color-primary-alpha-900);
        transform: translateY(-1px);
      }

      &:active {
        transform: scale(.97);
      }

      &:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }
    }

    :where(details) {
      border-radius: 14px;
      padding: 4px 14px;
      background: var(--q-surface-soft);
      box-shadow: inset 0 0 0 1px var(--q-outline);
      transition: background-color @transition-fast, box-shadow @transition-fast;

      &[open] {
        padding-bottom: 14px;
        box-shadow: inset 0 0 0 1px var(--color-primary-alpha-700);
      }

      details {
        background: rgb(from var(--color-font) r g b / .03);
      }
    }

    :where(details > summary) {
      list-style: none;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 2px;
      border-radius: 10px;
      font-size: 13.5px;
      font-weight: 650;
      color: var(--color-font);
      cursor: pointer;
      user-select: none;
      transition: color @transition-fast;

      &::-webkit-details-marker {
        display: none;
      }

      &::after {
        content: '';
        width: 6px;
        height: 6px;
        margin-left: auto;
        margin-right: 4px;
        flex: none;
        border-right: 1.8px solid currentColor;
        border-bottom: 1.8px solid currentColor;
        transform: rotate(45deg) translateY(-2px);
        opacity: .55;
        transition: transform .2s ease, opacity .2s ease, color .2s ease;
      }

      &:hover {
        color: var(--color-primary);
        &::after {
          opacity: .95;
        }
      }

      &:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }
    }

    :where(details[open] > summary)::after {
      transform: rotate(-135deg) translateY(-1px);
      color: var(--color-primary);
      opacity: .9;
    }

    :where(details[open] > :not(summary)) {
      animation: q-details-reveal .24s cubic-bezier(.22, 1, .36, 1);
    }

    [data-setting-highlight="true"] {
      border-radius: 10px;
      animation: q-setting-target-pulse 1.4s cubic-bezier(.22, 1, .36, 1);
    }

    :where(input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"])),
    :where(textarea),
    :where(select) {
      box-sizing: border-box;
      font: inherit;
      font-size: 13px;
      color: var(--color-font);
      background: var(--q-surface);
      border: none;
      border-radius: 10px;
      padding: 6px 11px;
      min-height: 30px;
      outline: none;
      box-shadow: inset 0 0 0 1px var(--q-outline);
      transition: background-color @transition-fast, box-shadow @transition-fast, color @transition-fast;

      &:hover:not(:disabled) {
        background: var(--q-surface-strong);
        box-shadow: inset 0 0 0 1px var(--color-primary-alpha-700);
      }

      &:focus-visible {
        background: var(--q-surface-strong);
        box-shadow: inset 0 0 0 1px var(--color-primary-alpha-400), 0 0 0 3px var(--color-primary-alpha-900);
      }

      &:disabled {
        opacity: .45;
        cursor: not-allowed;
      }
    }

    :where(select) {
      cursor: pointer;
      padding-right: 24px;
      option {
        background: var(--color-content-background);
        color: var(--color-font);
      }
    }

    :where(input[type="range"]) {
      appearance: none;
      background: transparent;
      height: 22px;
      min-width: 150px;
      vertical-align: middle;
      cursor: pointer;
      margin: 0;
      padding: 0;

      &::-webkit-slider-runnable-track {
        height: 6px;
        border-radius: 999px;
        background: rgb(from var(--color-font) r g b / .14);
        box-shadow: inset 0 0 0 1px var(--q-outline);
      }

      &::-webkit-slider-thumb {
        appearance: none;
        width: 14px;
        height: 14px;
        margin-top: -4px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 0 0 2px var(--color-primary), 0 2px 6px rgba(24, 34, 45, .2);
        transition: transform .16s ease, box-shadow .16s ease;
      }

      &:hover::-webkit-slider-thumb {
        transform: scale(1.12);
        box-shadow: 0 0 0 2.5px var(--color-primary), 0 0 0 5px var(--color-primary-alpha-900);
      }

      &:focus-visible {
        outline: none;
        &::-webkit-slider-thumb {
          box-shadow: 0 0 0 2.5px var(--color-primary), 0 0 0 6px var(--color-primary-alpha-800);
        }
      }
    }

    :where(input[type="color"]) {
      appearance: none;
      width: 36px;
      height: 26px;
      padding: 2px;
      border: 1px solid var(--q-outline);
      border-radius: 8px;
      background: var(--q-surface-strong);
      cursor: pointer;

      &::-webkit-color-swatch-wrapper {
        padding: 0;
      }
      &::-webkit-color-swatch {
        border: none;
        border-radius: 5px;
      }
    }
  }
}

// .btn-content {
//   display: inline-block;
//   transition: @transition-theme;
//   transition-property: opacity, transform;
//   opacity: 1;
//   transform: scale(1);

//   &.hide {
//     opacity: 0;
//     transform: scale(0);
//   }
// }


// :global(dt):target, :global(h3):target {
//   animation: highlight 1s ease;
// }

// @keyframes highlight {
//   from { background: yellow; }
//   to { background: transparent; }
// }

</style>

