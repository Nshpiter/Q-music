<template>
  <transition enter-active-class="animated-fast fadeIn" leave-active-class="animated-fast fadeOut">
    <div v-show="props.visible" :class="$style.noitem">
      <div :class="$style.noitemShell">
        <section :class="$style.welcomeCard">
          <span :class="$style.welcomeGlow" aria-hidden="true" />
          <div :class="$style.welcomeIcon" aria-hidden="true">
            <svg viewBox="0 0 425.2 425.2">
              <use xlink:href="#icon-search-2" />
            </svg>
          </div>
          <div :class="$style.welcomeCopy">
            <h2>{{ $t('search__welcome') }}</h2>
            <p>{{ $t('search__welcome_subtitle') }}</p>
          </div>
          <div :class="$style.welcomeActions">
            <button type="button" :class="$style.searchAction" @click="focusSearch">
              <svg viewBox="0 0 425.2 425.2" aria-hidden="true">
                <use xlink:href="#icon-search-2" />
              </svg>
              <span>{{ $t('search__welcome_action') }}</span>
            </button>
            <span :class="$style.shortcutHint">{{ $t('search__welcome_shortcut') }}</span>
          </div>
        </section>

        <div v-if="hasDiscoveryContent" class="scroll" :class="$style.noitemListContainer">
          <dl v-if="appSetting['search.isShowHotSearch']" :class="[$style.noitemList, $style.noitemHotSearchList]">
            <dt :class="$style.noitemListTitle">
              <span>{{ $t('search__hot_search') }}</span>
              <button type="button" :class="$style.listActionBtn" :disabled="isHotSearchLoading" @click="refreshHotSearch">
                {{ isHotSearchLoading ? $t('search__hot_search_loading') : $t('search__hot_search_refresh') }}
              </button>
            </dt>
            <div v-if="isHotSearchLoading && !hotSearchList.length" :class="$style.chipSkeletons" aria-hidden="true">
              <i v-for="index in 6" :key="index" />
            </div>
            <dd v-else-if="!hotSearchList.length" :class="$style.listEmpty">{{ $t('search__hot_search_empty') }}</dd>
            <template v-else>
              <dd v-for="(item, index) in hotSearchList" :key="index" :class="$style.noitemListItem" @click="handleSearch(item)">{{ item }}</dd>
            </template>
          </dl>
          <dl v-if="appSetting['search.isShowHistorySearch'] && historyList.length" :class="$style.noitemList">
            <dt :class="$style.noitemListTitle">
              <span>{{ $t('history_search') }}</span><button type="button" :class="$style.historyClearBtn" :aria-label="$t('history_clear')" @click="clearHistoryList">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 512 512" space="preserve">
                <use xlink:href="#icon-eraser" />
              </svg></button>
            </dt>
            <dd v-for="(item, index) in historyList" :key="index + item" :class="$style.noitemListItem" :aria-label="$t('history_remove')" @contextmenu="removeHistoryWord(index)" @click="handleSearch(item)">{{ item }}</dd>
          </dl>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed, watch, shallowRef } from '@common/utils/vueTools'
import { historyList } from '@renderer/store/search/state'
import { getHistoryList, removeHistoryWord, clearHistoryList } from '@renderer/store/search/action'
import { clearList, getList } from '@renderer/store/hotSearch'
import { appSetting } from '@renderer/store/setting'
import { useRouter } from '@common/utils/vueRouter'
import { HOTKEY_COMMON } from '@common/hotKey'

const props = defineProps({
  visible: Boolean,
  source: {
    type: String,
    required: true,
  },
})

const hotSearchList = shallowRef([])
const isHotSearchLoading = shallowRef(false)
let hotSearchRequestId = 0
const hasDiscoveryContent = computed(() => {
  return appSetting['search.isShowHotSearch'] ||
    (appSetting['search.isShowHistorySearch'] && historyList.length > 0)
})

const loadHotSearch = async(force = false) => {
  if (!props.visible || !appSetting['search.isShowHotSearch']) {
    hotSearchList.value = []
    isHotSearchLoading.value = false
    return
  }
  const source = props.source
  const requestId = ++hotSearchRequestId
  if (force) clearList(source)
  isHotSearchLoading.value = true
  try {
    const list = await getList(source)
    if (requestId == hotSearchRequestId && source == props.source) hotSearchList.value = list
  } catch {
    if (requestId == hotSearchRequestId) hotSearchList.value = []
  } finally {
    if (requestId == hotSearchRequestId) isHotSearchLoading.value = false
  }
}

watch(
  () => [props.visible, props.source, appSetting['search.isShowHotSearch']],
  () => { void loadHotSearch() },
  { immediate: true },
)

watch(
  () => [props.visible, appSetting['search.isShowHistorySearch']],
  ([visible, enabled]) => {
    if (visible && enabled) void getHistoryList()
  },
  { immediate: true },
)

const refreshHotSearch = () => {
  void loadHotSearch(true)
}

const router = useRouter()
const focusSearch = () => {
  window.key_event.emit(HOTKEY_COMMON.focusSearchInput.action)
}
const handleSearch = (text) => {
  void router.replace({
    path: '/search',
    query: {
      text,
    },
  })
}

</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.noitem {
  position: absolute;
  inset: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: clamp(26px, 5vh, 58px) clamp(22px, 6vw, 82px) calc(@height-player + 18px);
}
.noitemShell {
  position: relative;
  width: min(820px, 100%);
  max-height: 100%;
  display: flex;
  flex-flow: column nowrap;
  gap: 18px;
}
.welcomeCard {
  position: relative;
  min-height: 220px;
  overflow: hidden;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-areas:
    'icon copy'
    'actions actions';
  align-items: center;
  column-gap: 20px;
  row-gap: 24px;
  padding: 34px 38px 30px;
  border-radius: 28px;
  color: var(--color-font);
  background:
    linear-gradient(145deg, rgba(255, 255, 255, .72), rgba(244, 251, 248, .42)),
    rgb(from var(--color-main-background) r g b / .56);
  border: 1px solid rgba(54, 83, 70, .16);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .82),
    inset 0 -1px 0 rgba(54, 83, 70, .08),
    0 24px 60px rgba(35, 54, 46, .14);
  backdrop-filter: blur(24px) saturate(1.25);
}
.welcomeGlow {
  position: absolute;
  width: 260px;
  height: 260px;
  right: -90px;
  top: -130px;
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(circle, var(--color-primary-alpha-700), transparent 68%);
}
.welcomeIcon {
  grid-area: icon;
  position: relative;
  width: 66px;
  height: 66px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 22px;
  color: #fff;
  background: linear-gradient(145deg, var(--color-primary-light-100), var(--color-primary));
  box-shadow: 0 14px 30px var(--color-primary-alpha-700), inset 0 1px 0 rgba(255, 255, 255, .42);

  svg {
    width: 28px;
    height: 28px;
    fill: currentColor;
  }
}
.welcomeCopy {
  grid-area: copy;
  position: relative;
  min-width: 0;

  h2 {
    margin: 0 0 8px;
    font-size: clamp(24px, 2.2vw, 31px);
    line-height: 1.2;
    font-weight: 720;
    letter-spacing: -.02em;
    color: var(--color-font);
  }

  p {
    margin: 0;
    max-width: 520px;
    color: var(--color-font-label);
    font-size: 14px;
    line-height: 1.7;
  }
}
.welcomeActions {
  grid-area: actions;
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
}
.searchAction {
  height: 40px;
  padding: 0 18px;
  border: 0;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  cursor: pointer;
  color: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  background: linear-gradient(145deg, var(--color-primary-light-100), var(--color-primary));
  box-shadow: 0 10px 24px var(--color-primary-alpha-700), inset 0 1px 0 rgba(255, 255, 255, .35);
  transition: transform @transition-fast, box-shadow @transition-fast, opacity @transition-fast;

  svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 28px var(--color-primary-alpha-600), inset 0 1px 0 rgba(255, 255, 255, .42);
  }

  &:active {
    transform: scale(.97);
    opacity: .86;
  }
}
.shortcutHint {
  color: var(--color-font-label);
  font-size: 12px;
}
.noitemListContainer {
  min-height: 0;
  max-height: 310px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  padding: 2px 4px 10px;
}
.noitemList {
  min-width: 0;
  margin: 0;
  padding: 16px;
  border-radius: 20px;
  background: rgb(from var(--color-main-background) r g b / .48);
  border: 1px solid rgba(54, 83, 70, .13);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .64), 0 12px 30px rgba(35, 54, 46, .08);
  backdrop-filter: blur(16px) saturate(1.16);
}
.noitemHotSearchList {
  min-height: 104px;
}
.noitemListTitle {
  display: flex;
  align-items: center;
  color: var(--color-font);
  padding: 1px 4px 11px;
  font-size: 13px;
  font-weight: 680;
}
.noitemListItem {
  display: inline-block;
  margin: 3px;
  padding: 7px 11px;
  border-radius: 11px;
  background: rgba(255, 255, 255, .44);
  border: 1px solid rgba(54, 83, 70, .1);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .55);
  transition: background-color @transition-fast, color @transition-fast, transform @transition-fast, border-color @transition-fast;
  cursor: pointer;
  color: var(--color-button-font);
  .mixin-ellipsis-1();
  max-width: 168px;
  font-size: 12.5px;
  &:hover {
    color: var(--color-primary-dark-300);
    background-color: var(--color-primary-alpha-900);
    border-color: var(--color-primary-alpha-700);
    transform: translateY(-1px);
  }
  &:active {
    transform: scale(.97);
  }
}
.historyClearBtn {
  width: 26px;
  height: 26px;
  margin: -5px 0 -5px auto;
  padding: 5px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--color-font-label);
  cursor: pointer;
  transition: @transition-normal;
  transition-property: color, opacity, background-color;
  opacity: .55;
  &:hover {
    color: var(--color-primary-font-hover);
    background-color: var(--color-primary-alpha-900);
    opacity: 1;
  }
  &:active {
    color: var(--color-primary-font-active);
    opacity: 1;
  }
  svg {
    vertical-align: middle;
    width: 15px;
  }
}
.listActionBtn {
  margin-left: auto;
  padding: 4px 8px;
  border: 0;
  border-radius: 8px;
  color: var(--color-primary-font);
  background: var(--color-primary-alpha-900);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: background-color @transition-fast, opacity @transition-fast;

  &:hover:not(:disabled) {
    background: var(--color-primary-alpha-800);
  }

  &:disabled {
    cursor: default;
    opacity: .56;
  }
}
.listEmpty {
  margin: 4px;
  color: var(--color-font-label);
  font-size: 12px;
  line-height: 1.6;
}
.chipSkeletons {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  padding: 3px;

  i {
    width: 64px;
    height: 29px;
    border-radius: 11px;
    background: linear-gradient(100deg, rgba(255, 255, 255, .28) 20%, rgba(255, 255, 255, .68) 45%, rgba(255, 255, 255, .28) 70%);
    background-size: 220% 100%;
    animation: q-search-skeleton 1.4s ease-in-out infinite;

    &:nth-child(2n) { width: 82px; }
    &:nth-child(3n) { width: 54px; }
  }
}

@keyframes q-search-skeleton {
  from { background-position: 100% 0; }
  to { background-position: -100% 0; }
}

@media (max-width: 900px) {
  .noitem {
    padding-left: 28px;
    padding-right: 28px;
  }
  .welcomeCard {
    padding: 28px;
  }
  .noitemListContainer {
    grid-template-columns: 1fr;
    max-height: 270px;
  }
}

@media (max-height: 680px) {
  .noitem {
    align-items: flex-start;
    padding-top: 24px;
  }
  .welcomeCard {
    min-height: 168px;
    grid-template-areas: 'icon copy' 'icon actions';
    grid-template-columns: auto 1fr;
    row-gap: 12px;
    padding: 24px 28px;
  }
  .welcomeActions {
    align-self: start;
  }
}
</style>
