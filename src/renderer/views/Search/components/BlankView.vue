<template>
  <transition enter-active-class="animated-fast fadeIn" leave-active-class="animated-fast fadeOut">
    <div v-show="props.visible" :class="$style.noitem">
      <div v-if="!isShowDailyDetail" class="scroll" :class="$style.noitemShell">
        <header :class="$style.welcomeBar">
          <div :class="$style.welcomeCopy">
            <span :class="$style.greetingTag">{{ $t('search__home_eyebrow') }}</span>
            <h2>{{ $t('search__welcome') }}</h2>
            <p>{{ $t('search__welcome_subtitle') }}</p>
          </div>
          <button type="button" :class="[$style.syncAction, { [$style.connected]: hasMusicAccount }]" @click="openAccountModal">
            <svg-icon name="headphones" />
            <span>{{ accountActionText }}</span>
          </button>
        </header>

        <div :class="$style.featureGrid">
          <section
            :class="$style.dailyCard" role="button" tabindex="0"
            :aria-label="$t('search__daily_open')" @click="openDailyDetail"
            @keydown.enter="openDailyDetail" @keydown.space.prevent="openDailyDetail"
          >
            <div :class="$style.dailyCover" aria-hidden="true">
              <div v-for="index in 4" :key="index" :class="$style.coverTile">
                <img v-if="dailyCoverUrls[index - 1]" :src="dailyCoverUrls[index - 1]" alt="" @error="handleDailyCoverError(index - 1)">
                <svg-icon v-else name="music" />
              </div>
              <div :class="$style.dateBadge">
                <strong>{{ todayDay }}</strong>
                <span>{{ todayMonth }}</span>
              </div>
            </div>
            <div :class="$style.dailyContent">
              <div :class="$style.dailySourceRow">
                <span :class="$style.eyebrow">{{ $t('search__daily_eyebrow') }}</span>
                <div :class="$style.sourceSwitch" role="tablist" :aria-label="$t('search__daily_source')">
                  <button
                    v-for="provider in accountProviders" :key="provider.id" type="button" role="tab"
                    :class="{ [$style.active]: selectedDailyProvider == provider.id }"
                    :aria-selected="selectedDailyProvider == provider.id"
                    @click.stop="selectDailyProvider(provider.id)"
                  >{{ $t(provider.label) }}</button>
                </div>
              </div>
              <h3>{{ $t('search__daily_recommend') }} · {{ $t('search__daily_count', { count: dailyRecommendList.length || 30 }) }}</h3>
              <p>{{ $t('search__daily_recommend_subtitle') }}</p>
              <p :class="[$style.sourceStatus, { [$style.personalized]: dailyRecommendMode == 'personalized' }]">
                <span />{{ dailySourceText }}
              </p>
              <ol v-if="dailyRecommendList.length" :class="$style.trackPreview">
                <li v-for="item in dailyRecommendList.slice(0, 3)" :key="item.id"><strong>{{ item.name }}</strong><span>{{ item.singer }}</span></li>
              </ol>
              <div v-else :class="$style.dailyLoading">{{ isDailyLoading ? $t('search__daily_recommend_loading') : $t('search__daily_recommend_empty') }}</div>
              <div :class="$style.dailyActions">
                <button type="button" :disabled="!dailyRecommendList.length" @click.stop="playDailyRecommend()">{{ $t('search__daily_recommend_play') }}</button>
                <button type="button" :disabled="isDailyLoading" @click.stop="loadDailyRecommend(true)">{{ $t('search__daily_recommend_refresh') }}</button>
                <span :class="$style.openHint">{{ $t('search__daily_open') }} ›</span>
              </div>
            </div>
          </section>
        </div>

        <div v-if="hasDiscoveryContent" :class="$style.noitemListContainer">
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
      <div v-else :class="$style.dailyDetail">
        <header :class="$style.detailHeader">
          <button type="button" :class="$style.backButton" :aria-label="$t('back')" @click="closeDailyDetail">‹</button>
          <div :class="$style.detailCover" aria-hidden="true">
            <img v-if="dailyCoverUrls[0]" :src="dailyCoverUrls[0]" alt="" @error="handleDailyCoverError(0)">
            <svg-icon v-else name="music" />
          </div>
          <div :class="$style.detailCopy">
            <span :class="$style.eyebrow">{{ $t('search__daily_eyebrow') }}</span>
            <h2>{{ $t('search__daily_recommend') }}</h2>
            <p>{{ todayLabel }} · {{ $t('search__daily_count', { count: dailyRecommendList.length }) }}</p>
            <p :class="$style.detailSource">{{ dailySourceText }}</p>
          </div>
          <div :class="$style.detailActions">
            <base-btn min :disabled="!dailyRecommendList.length" @click="playDailyRecommend()">{{ $t('search__daily_recommend_play') }}</base-btn>
            <base-btn min :disabled="isDailyLoading" @click="loadDailyRecommend(true)">{{ $t('search__daily_recommend_refresh') }}</base-btn>
          </div>
        </header>
        <div :class="$style.detailList">
          <div :class="$style.detailTableHeader" aria-hidden="true">
            <span>#</span><span>{{ $t('music_name') }}</span><span>{{ $t('music_singer') }}</span><span>{{ $t('music_album') }}</span><span />
          </div>
          <ol v-if="dailyRecommendList.length" class="scroll" :class="$style.detailTracks">
            <li v-for="(item, index) in dailyRecommendList" :key="`${item.source}_${item.id}`" @dblclick="playDailyRecommend(index)">
              <span :class="$style.trackNumber">{{ String(index + 1).padStart(2, '0') }}</span>
              <strong :title="item.name">{{ item.name }}</strong>
              <span :title="item.singer">{{ item.singer }}</span>
              <span :title="item.meta.albumName">{{ item.meta.albumName || '—' }}</span>
              <button type="button" :aria-label="$t('list__play')" @click="playDailyRecommend(index)">▶</button>
            </li>
          </ol>
          <p v-else :class="$style.detailEmpty">{{ dailyDetailEmptyText }}</p>
        </div>
      </div>
    </div>
  </transition>
  <material-modal :show="isShowAccountModal" :bg-close="!isAccountLoginPending" @close="closeAccountModal">
    <main :class="$style.accountModal">
      <div :class="$style.qrHeading">
        <div :class="$style.qrIcon"><svg-icon name="headphones" /></div>
        <div>
          <h2>{{ $t('search__account_title') }}</h2>
          <p>{{ $t('search__account_desc') }}</p>
        </div>
      </div>
      <div :class="$style.providerList">
        <button
          type="button" :disabled="isAccountLoginPending"
          :class="{ [$style.selectedProvider]: selectedDailyProvider == 'tx' }"
          @click="handleProviderAction('tx')"
        >
          <strong>{{ $t('search__account_qq') }}</strong>
          <span>{{ accountStatus.tx ? $t('search__account_connected') : $t('search__account_qq_tip') }}</span>
          <em :class="{ [$style.connectedDot]: accountStatus.tx }">{{ selectedDailyProvider == 'tx' ? $t('search__daily_selected') : accountStatus.tx ? '✓' : '›' }}</em>
        </button>
        <button
          type="button" :disabled="isAccountLoginPending"
          :class="{ [$style.selectedProvider]: selectedDailyProvider == 'wy' }"
          @click="handleProviderAction('wy')"
        >
          <strong>{{ $t('search__account_netease') }}</strong>
          <span>{{ accountStatus.wy ? $t('search__account_connected') : $t('search__account_netease_tip') }}</span>
          <em :class="{ [$style.connectedDot]: accountStatus.wy }">{{ selectedDailyProvider == 'wy' ? $t('search__daily_selected') : accountStatus.wy ? '✓' : '›' }}</em>
        </button>
      </div>
      <p :class="$style.accountTip">{{ isAccountLoginPending ? $t('search__account_waiting') : $t('search__account_tip') }}</p>
      <div :class="$style.loginFooter">
        <base-btn min :disabled="isAccountLoginPending" @click="closeAccountModal">{{ $t('btn_close') }}</base-btn>
      </div>
    </main>
  </material-modal>
</template>

<script setup>
import { computed, watch, shallowRef, ref } from '@common/utils/vueTools'
import { historyList } from '@renderer/store/search/state'
import { getHistoryList, removeHistoryWord, clearHistoryList } from '@renderer/store/search/action'
import { clearList, getList } from '@renderer/store/hotSearch'
import { appSetting } from '@renderer/store/setting'
import { useRouter } from '@common/utils/vueRouter'
import { getDailyRecommend } from '@renderer/core/dailyRecommend'
import { setTempList } from '@renderer/store/list/action'
import { playList } from '@renderer/core/player/action'
import { getPicPath } from '@renderer/core/music'
import { LIST_IDS } from '@common/constants'
import { getMusicAccountDaily, getMusicAccountStatus, loginMusicAccount } from '@renderer/utils/ipc'
import wyMusicDetail from '@renderer/utils/musicSdk/wy/musicDetail'
import txMusicInfo from '@renderer/utils/musicSdk/tx/musicInfo'
import { toNewMusicInfo } from '@renderer/utils'

const props = defineProps({
  visible: Boolean,
  source: {
    type: String,
    required: true,
  },
})

const hotSearchList = shallowRef([])
const isHotSearchLoading = shallowRef(false)
const dailyRecommendList = shallowRef([])
const dailyCoverUrls = shallowRef([])
const isDailyLoading = shallowRef(false)
const isShowDailyDetail = ref(false)
const isShowAccountModal = ref(false)
const isAccountLoginPending = ref(false)
const accountStatus = ref({ tx: false, wy: false })
const accountProviders = [
  { id: 'tx', label: 'search__account_qq' },
  { id: 'wy', label: 'search__account_netease' },
]
const storedDailyProvider = window.localStorage.getItem('qmusic.dailyRecommend.provider')
const selectedDailyProvider = ref(storedDailyProvider == 'wy' ? 'wy' : 'tx')
const dailyRecommendMode = ref('loading')
let hotSearchRequestId = 0
let dailyRequestId = 0
const now = new Date()
const todayDay = String(now.getDate()).padStart(2, '0')
const todayMonth = new Intl.DateTimeFormat(window.i18n.locale || 'zh-CN', { month: 'short' }).format(now)
const todayLabel = new Intl.DateTimeFormat(window.i18n.locale || 'zh-CN', { month: 'long', day: 'numeric' }).format(now)
const hasMusicAccount = computed(() => accountStatus.value.tx || accountStatus.value.wy)
const dailySourceText = computed(() => {
  const provider = selectedDailyProvider.value == 'tx'
    ? window.i18n.t('search__account_qq')
    : window.i18n.t('search__account_netease')
  const mode = dailyRecommendMode.value == 'personalized'
    ? window.i18n.t('search__daily_source_personalized')
    : dailyRecommendMode.value == 'loading'
      ? window.i18n.t('search__daily_source_loading')
      : window.i18n.t('search__daily_source_fallback')
  return `${provider} · ${mode}`
})
const accountActionText = computed(() => {
  if (accountStatus.value.tx && accountStatus.value.wy) return window.i18n.t('search__account_both_connected')
  if (accountStatus.value.tx) return window.i18n.t('search__account_qq_connected')
  if (accountStatus.value.wy) return window.i18n.t('search__account_netease_connected')
  return window.i18n.t('search__account_login')
})
const dailyDetailEmptyText = computed(() => isDailyLoading.value
  ? window.i18n.t('search__daily_recommend_loading')
  : window.i18n.t('search__daily_recommend_empty'))
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

const loadDailyRecommend = async(force = false, sourceOverride = selectedDailyProvider.value) => {
  if (!props.visible) return
  const requestId = ++dailyRequestId
  isDailyLoading.value = true
  dailyRecommendMode.value = 'loading'
  try {
    let list = []
    if (accountStatus.value[sourceOverride]) {
      const result = await getMusicAccountDaily(sourceOverride).catch(() => null)
      if (result?.ids.length) {
        if (sourceOverride == 'wy') {
          list = await wyMusicDetail.getList(result.ids.slice(0, 30)).then(data => data.list).catch(() => [])
        } else {
          const details = await Promise.all(result.ids.slice(0, 30).map(id => txMusicInfo(id).catch(() => null)))
          list = details.filter(Boolean).map(item => toNewMusicInfo(item))
        }
      }
      if (list.length && result?.status == 'personalized') dailyRecommendMode.value = 'personalized'
    }
    if (!list.length) {
      list = await getDailyRecommend(sourceOverride, force)
      dailyRecommendMode.value = 'fallback'
    }
    if (requestId != dailyRequestId) return
    dailyRecommendList.value = list
    dailyCoverUrls.value = list.slice(0, 4).map(item => item.meta.picUrl ?? '')
    const coverUrls = await Promise.all(list.slice(0, 4).map(async item => {
      if (item.meta.picUrl) return item.meta.picUrl
      return getPicPath({ musicInfo: item }).catch(() => '')
    }))
    if (requestId == dailyRequestId) dailyCoverUrls.value = coverUrls
  } catch {
    if (requestId == dailyRequestId) {
      dailyRecommendList.value = []
      dailyCoverUrls.value = []
    }
  } finally {
    if (requestId == dailyRequestId) isDailyLoading.value = false
  }
}

const handleDailyCoverError = (index) => {
  const urls = [...dailyCoverUrls.value]
  urls[index] = ''
  dailyCoverUrls.value = urls
}

watch(
  () => [props.visible, props.source],
  ([visible]) => {
    if (!visible) isShowDailyDetail.value = false
    void loadDailyRecommend()
  },
  { immediate: true },
)

const playDailyRecommend = async(index = 0) => {
  if (!dailyRecommendList.value.length) return
  await setTempList(`q_daily_${new Date().toISOString().slice(0, 10)}`, [...dailyRecommendList.value])
  playList(LIST_IDS.TEMP, index)
}

const openDailyDetail = () => {
  isShowDailyDetail.value = true
}

const closeDailyDetail = () => {
  isShowDailyDetail.value = false
}

const refreshAccountStatus = async() => {
  accountStatus.value = await getMusicAccountStatus().catch(() => ({ tx: false, wy: false }))
  if (!accountStatus.value[selectedDailyProvider.value]) {
    if (accountStatus.value.tx) selectedDailyProvider.value = 'tx'
    else if (accountStatus.value.wy) selectedDailyProvider.value = 'wy'
    window.localStorage.setItem('qmusic.dailyRecommend.provider', selectedDailyProvider.value)
  }
}

const selectDailyProvider = (provider, force = false) => {
  if (!force && selectedDailyProvider.value == provider && dailyRecommendList.value.length) return
  selectedDailyProvider.value = provider
  window.localStorage.setItem('qmusic.dailyRecommend.provider', provider)
  void loadDailyRecommend(true, provider)
}

const openAccountModal = () => {
  isShowAccountModal.value = true
  void refreshAccountStatus()
}

const closeAccountModal = () => {
  if (isAccountLoginPending.value) return
  isShowAccountModal.value = false
}

const connectMusicAccount = async(provider) => {
  if (isAccountLoginPending.value) return
  isAccountLoginPending.value = true
  try {
    const result = await loginMusicAccount(provider)
    await refreshAccountStatus()
    if (result.status == 'connected') {
      selectDailyProvider(provider, true)
    }
  } finally {
    isAccountLoginPending.value = false
  }
}

const handleProviderAction = (provider) => {
  if (!accountStatus.value[provider]) {
    void connectMusicAccount(provider)
    return
  }
  selectDailyProvider(provider)
  closeAccountModal()
}

void refreshAccountStatus().then(() => {
  void loadDailyRecommend(false, selectedDailyProvider.value)
})

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
  overflow-y: auto;
  padding: 2px 8px 12px;
  box-sizing: border-box;
}
.welcomeBar {
  min-height: 92px;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 8px;
  color: var(--color-font);
}
.welcomeCopy {
  flex: 1;
  min-width: 0;

  h2 {
    margin: 5px 0 6px;
    font-size: 27px;
    line-height: 1.2;
    font-weight: 750;
    letter-spacing: -.02em;
    color: var(--color-font);
  }

  p {
    margin: 0;
    color: var(--color-font-label);
    font-size: 12px;
    line-height: 1.5;
  }
}
.greetingTag {
  color: var(--color-primary-dark-100);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: .12em;
  text-transform: uppercase;
}
.featureGrid {
  display: block;
}
.dailyCard {
  min-width: 0;
  min-height: 260px;
  overflow: hidden;
  display: flex;
  gap: 22px;
  padding: 26px;
  box-sizing: border-box;
  border-radius: 24px;
  color: var(--color-font);
  background:
    radial-gradient(circle at 8% 8%, var(--color-primary-alpha-700), transparent 42%),
    linear-gradient(145deg, rgba(255, 255, 255, .9), rgba(241, 250, 246, .7));
  border: 1px solid rgba(54, 83, 70, .14);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .86), 0 20px 48px rgba(35, 54, 46, .12);
  backdrop-filter: blur(22px) saturate(1.2);
  cursor: pointer;
  outline: none;
  transition: transform @transition-fast, box-shadow @transition-fast, border-color @transition-fast;

  &:hover, &:focus-visible {
    transform: translateY(-2px);
    border-color: var(--color-primary-alpha-700);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, .9), 0 24px 54px rgba(35, 54, 46, .16);
  }

  &:active { transform: scale(.995); }
}
.dailyCover {
  position: relative;
  width: 194px;
  height: 194px;
  flex: none;
  overflow: hidden;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 3px;
  border-radius: 22px;
  background: var(--color-primary-alpha-900);
  box-shadow: 0 18px 38px rgba(35, 54, 46, .18), inset 0 0 0 1px rgba(255, 255, 255, .45);
}
.coverTile {
  min-width: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  background: linear-gradient(145deg, var(--color-primary-alpha-900), rgba(255, 255, 255, .72));

  img { width: 100%; height: 100%; object-fit: cover; }
  :global(.svg-icon) { width: 24px; height: 24px; }
}
.dateBadge {
  position: absolute;
  inset: 50% auto auto 50%;
  width: 58px;
  height: 58px;
  transform: translate(-50%, -50%);
  display: flex;
  flex-flow: column nowrap;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  color: var(--color-font);
  background: rgba(255, 255, 255, .88);
  box-shadow: 0 10px 28px rgba(35, 54, 46, .2), inset 0 0 0 1px rgba(255, 255, 255, .8);
  backdrop-filter: blur(16px);

  strong { font-size: 20px; line-height: 1; }
  span { margin-top: 4px; color: var(--color-font-label); font-size: 9px; text-transform: uppercase; }
}
.dailyContent {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;

  h3 { margin: 5px 0 7px; font-size: 19px; font-weight: 760; }
  > p { margin: 0; color: var(--color-font-label); font-size: 12px; line-height: 1.55; }
}
.dailySourceRow {
  display: flex;
  align-items: center;
  gap: 12px;
}
.sourceSwitch {
  margin-left: auto;
  padding: 3px;
  display: inline-flex;
  gap: 3px;
  border: 1px solid rgba(54, 83, 70, .1);
  border-radius: 11px;
  background: rgba(255, 255, 255, .52);

  button {
    min-height: 25px;
    padding: 0 10px;
    border: 0;
    border-radius: 8px;
    color: var(--color-font-label);
    background: transparent;
    cursor: pointer;
    font: inherit;
    font-size: 10px;
    transition: color @transition-fast, background-color @transition-fast, box-shadow @transition-fast;

    &:hover { color: var(--color-font); }
    &.active {
      color: #fff;
      background: var(--color-primary);
      box-shadow: 0 5px 12px var(--color-primary-alpha-700);
    }
  }
}
.dailyContent > .sourceStatus {
  margin-top: 7px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;

  > span {
    width: 6px;
    height: 6px;
    flex: none;
    border-radius: 50%;
    background: var(--color-font-label);
  }
  &.personalized > span {
    background: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-alpha-900);
  }
}
.eyebrow {
  color: var(--color-primary-dark-100);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: .12em;
}
.trackPreview {
  min-width: 0;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;

  li { min-width: 0; display: flex; gap: 8px; padding: 3px 0; font-size: 11px; }
  strong, span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  strong { max-width: 58%; font-weight: 620; }
  span { flex: 1; color: var(--color-font-label); }
}
.dailyActions {
  display: flex;
  gap: 9px;
  margin-top: 13px;

  button {
    min-height: 34px;
    padding: 0 14px;
    border: 0;
    border-radius: 12px;
    color: var(--color-primary-font);
    background: var(--color-primary-alpha-900);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    &:first-child { color: #fff; background: var(--color-primary); box-shadow: 0 8px 18px var(--color-primary-alpha-700); }
    &:disabled { cursor: default; opacity: .48; }
  }
}
.openHint {
  margin-left: auto;
  align-self: center;
  color: var(--color-primary-dark-100);
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
}
.dailyLoading {
  min-height: 42px;
  display: flex;
  align-items: center;
  color: var(--color-font-label);
  font-size: 12px;
}
.syncAction {
  height: 40px;
  padding: 0 15px;
  border: 1px solid rgba(54, 83, 70, .12);
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: var(--color-primary-dark-100);
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  background: rgba(255, 255, 255, .62);
  box-shadow: 0 8px 22px rgba(35, 54, 46, .08), inset 0 1px 0 rgba(255, 255, 255, .72);
  transition: transform @transition-fast, box-shadow @transition-fast, opacity @transition-fast;

  :global(.svg-icon) { width: 16px; height: 16px; }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 26px rgba(35, 54, 46, .13), inset 0 1px 0 rgba(255, 255, 255, .8);
  }

  &:active {
    transform: scale(.97);
    opacity: .86;
  }

  &.connected {
    color: #fff;
    border-color: transparent;
    background: var(--color-primary);
  }
}
.dailyDetail {
  width: min(980px, 100%);
  height: 100%;
  min-height: 0;
  padding: 4px 8px 12px;
  box-sizing: border-box;
  display: flex;
  flex-flow: column nowrap;
}
.detailHeader {
  flex: none;
  min-height: 92px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 14px 18px;
}
.backButton {
  width: 38px;
  height: 38px;
  flex: none;
  border: 1px solid rgba(54, 83, 70, .12);
  border-radius: 13px;
  color: var(--color-font);
  background: rgba(255, 255, 255, .58);
  cursor: pointer;
  font: inherit;
  font-size: 29px;
  line-height: 1;
}
.detailCover {
  width: 72px;
  height: 72px;
  flex: none;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  color: var(--color-primary);
  background: var(--color-primary-alpha-900);
  box-shadow: 0 10px 26px rgba(35, 54, 46, .14);

  img { width: 100%; height: 100%; object-fit: cover; }
  :global(.svg-icon) { width: 25px; height: 25px; }
}
.detailCopy {
  min-width: 0;
  flex: 1;

  h2 { margin: 4px 0 5px; color: var(--color-font); font-size: 23px; }
  p { margin: 0; color: var(--color-font-label); font-size: 12px; }
}
.detailCopy > .detailSource {
  margin-top: 5px;
  color: var(--color-primary-dark-100);
  font-size: 10px;
  font-weight: 650;
}
.detailActions {
  display: flex;
  gap: 9px;
}
.detailList {
  min-height: 0;
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-flow: column nowrap;
  border: 1px solid rgba(54, 83, 70, .11);
  border-radius: 22px;
  background: rgb(from var(--color-main-background) r g b / .46);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .68), 0 14px 36px rgba(35, 54, 46, .08);
  backdrop-filter: blur(18px) saturate(1.12);
}
.detailTableHeader, .detailTracks li {
  display: grid;
  grid-template-columns: 42px minmax(180px, 1.5fr) minmax(120px, .8fr) minmax(130px, 1fr) 42px;
  align-items: center;
  gap: 12px;
}
.detailTableHeader {
  flex: none;
  min-height: 42px;
  padding: 0 16px;
  color: var(--color-font-label);
  border-bottom: 1px solid rgba(54, 83, 70, .09);
  font-size: 11px;
}
.detailTracks {
  min-height: 0;
  flex: 1;
  margin: 0;
  padding: 7px 8px 12px;
  list-style: none;

  li {
    min-height: 48px;
    padding: 0 8px;
    border-radius: 13px;
    color: var(--color-font);
    font-size: 12px;
    transition: background-color @transition-fast;

    &:hover { background: var(--color-primary-alpha-1000); }
    > strong, > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    > strong { font-weight: 650; }
    > span:not(.trackNumber) { color: var(--color-font-label); }
    > button {
      width: 30px;
      height: 30px;
      border: 0;
      border-radius: 10px;
      color: var(--color-primary);
      background: var(--color-primary-alpha-900);
      cursor: pointer;
      font-size: 10px;
    }
  }
}
.trackNumber { color: var(--color-font-label); font-variant-numeric: tabular-nums; }
.detailEmpty {
  margin: auto;
  color: var(--color-font-label);
  font-size: 12px;
}
.accountModal {
  width: min(410px, 76vw);
  padding: 25px;
  box-sizing: border-box;
  color: var(--color-font);
}
.qrHeading {
  display: flex;
  align-items: center;
  gap: 13px;

  h2 { margin: 0 0 5px; font-size: 18px; }
  p { margin: 0; color: var(--color-font-label); font-size: 11px; line-height: 1.5; }
}
.qrIcon {
  width: 42px;
  height: 42px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  color: #fff;
  background: var(--color-primary);

  :global(.svg-icon) { width: 19px; height: 19px; }
}
.providerList {
  display: grid;
  gap: 11px;
  margin-top: 22px;

  button {
    position: relative;
    min-height: 76px;
    padding: 15px 50px 15px 17px;
    border: 1px solid rgba(54, 83, 70, .13);
    border-radius: 17px;
    display: flex;
    flex-flow: column nowrap;
    align-items: flex-start;
    gap: 6px;
    color: var(--color-font);
    background: rgba(255, 255, 255, .62);
    cursor: pointer;
    font: inherit;
    text-align: left;
    transition: transform @transition-fast, border-color @transition-fast, box-shadow @transition-fast;

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      border-color: var(--color-primary-alpha-700);
      box-shadow: 0 12px 28px rgba(35, 54, 46, .11);
    }
    &:disabled { cursor: wait; opacity: .65; }
    &.selectedProvider {
      border-color: var(--color-primary-alpha-500);
      background: var(--color-primary-alpha-1000);
      box-shadow: 0 10px 26px rgba(35, 54, 46, .1), inset 3px 0 0 var(--color-primary);
    }
  }
  strong { font-size: 14px; }
  span { color: var(--color-font-label); font-size: 11px; }
  em {
    position: absolute;
    top: 50%;
    right: 18px;
    transform: translateY(-50%);
    color: var(--color-font-label);
    font-style: normal;
    font-size: 22px;
  }
  .connectedDot { color: var(--color-primary); font-size: 11px; font-weight: 700; }
}
.accountTip {
  margin: 14px 2px 0;
  color: var(--color-font-label);
  font-size: 11px;
  line-height: 1.6;
}
.loginFooter {
  margin-top: 22px;
  display: flex;
  justify-content: flex-end;
  gap: 9px;
}
.noitemListContainer {
  min-height: 0;
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
  .noitemListContainer {
    grid-template-columns: 1fr;
  }
  .detailHeader { flex-wrap: wrap; }
  .detailActions { width: 100%; padding-left: 54px; }
}

@media (max-height: 680px) {
  .noitem {
    align-items: flex-start;
    padding-top: 24px;
  }
  .welcomeBar {
    min-height: 58px;
  }
  .dailyCard {
    min-height: 208px;
    padding: 18px;
  }
  .dailyCover { width: 168px; height: 168px; }
  .trackPreview li:nth-child(n + 3) { display: none; }
}
</style>
