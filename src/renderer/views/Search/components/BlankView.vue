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
            <span :class="$style.accountIcons">
              <source-icon v-if="accountStatus.tx" source="tx" :size="20" />
              <source-icon v-if="accountStatus.wy" source="wy" :size="20" />
              <svg-icon v-if="!hasMusicAccount" name="headphones" />
            </span>
            <span>{{ accountActionText }}</span>
            <b aria-hidden="true">›</b>
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
              </div>
              <h3>{{ dailyTitle }}</h3>
              <p>{{ $t('search__daily_recommend_subtitle') }}</p>
              <p :class="[$style.sourceStatus, { [$style.personalized]: dailyRecommendMode == 'personalized' }]">
                <source-icon :source="selectedDailyProvider" :size="15" />{{ dailySourceText }}
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

        <section v-if="dailyRecommendList.length" :class="$style.playlistShelf">
          <header>
            <div>
              <h3>{{ $t('search__today_discovery') }}</h3>
              <p>{{ $t('search__today_discovery_desc') }}</p>
            </div>
          </header>
          <div :class="[$style.playlistRail, $style.discoveryGrid]">
            <button v-for="(item, index) in dailyRecommendList.slice(0, 9)" :key="`${item.source}_${item.id}`" type="button" @click="playDailyRecommend(index)">
              <span :class="$style.playlistCover">
                <img v-if="dailyCoverUrls[index] || item.meta.picUrl" :src="dailyCoverUrls[index] || item.meta.picUrl" alt="">
                <svg-icon v-else name="music" />
                <i>▶</i>
              </span>
              <strong :title="item.name">{{ item.name }}</strong>
              <small :title="item.singer">{{ item.singer }}</small>
            </button>
          </div>
        </section>

        <section v-if="accountStatus[selectedDailyProvider]" :class="$style.playlistShelf">
          <header>
            <div>
              <h3>{{ $t('search__account_playlists') }}</h3>
              <p>{{ $t('search__account_playlists_desc') }}</p>
            </div>
            <button type="button" :disabled="isPlaylistsLoading" @click="loadAccountPlaylists(true)">
              {{ isPlaylistsLoading ? $t('search__account_playlists_loading') : $t('search__hot_search_refresh') }}
            </button>
          </header>
          <div v-if="accountPlaylists.length" :class="$style.playlistRail">
            <button v-for="playlist in accountPlaylists" :key="playlist.id" type="button" @click="openAccountPlaylist(playlist)">
              <span :class="$style.playlistCover">
                <img v-if="playlist.cover" :src="playlist.cover" alt="">
                <svg-icon v-else name="music" />
                <i>▶</i>
              </span>
              <strong :title="playlist.name">{{ playlist.name }}</strong>
              <small>{{ $t('search__daily_count', { count: playlist.trackCount }) }}</small>
            </button>
          </div>
          <p v-else-if="!isPlaylistsLoading" :class="$style.playlistEmpty">{{ $t('search__account_playlists_empty') }}</p>
        </section>

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
            <img v-if="detailCover" :src="detailCover" alt="">
            <svg-icon v-else name="music" />
          </div>
          <div :class="$style.detailCopy">
            <span :class="$style.eyebrow">{{ detailEyebrow }}</span>
            <h2>{{ detailTitle }}</h2>
            <p>{{ detailSubtitle }}</p>
            <p :class="$style.detailSource">
              <source-icon :source="detailProvider" :size="15" />
              <span v-if="detailSourceText">{{ detailSourceText }}</span>
            </p>
          </div>
          <div :class="$style.detailActions">
            <base-btn min :disabled="!detailMusicList.length" @click="playDetailList()">{{ $t('search__daily_recommend_play') }}</base-btn>
            <base-btn v-if="detailKind == 'daily'" min :disabled="isDailyLoading" @click="loadDailyRecommend(true)">{{ $t('search__daily_recommend_refresh') }}</base-btn>
          </div>
        </header>
        <div :class="$style.detailList">
          <div :class="$style.detailTableHeader" aria-hidden="true">
            <span>#</span><span>{{ $t('music_name') }}</span><span>{{ $t('music_singer') }}</span><span>{{ $t('music_album') }}</span><span>{{ $t('music_time') }}</span><span />
          </div>
          <ol v-if="detailMusicList.length" class="scroll" :class="$style.detailTracks">
            <li v-for="(item, index) in detailMusicList" :key="`${item.source}_${item.id}`" @dblclick="playDetailList(index)">
              <span :class="$style.trackNumber">{{ String(index + 1).padStart(2, '0') }}</span>
              <strong :title="item.name">{{ item.name }}</strong>
              <span :title="item.singer">{{ item.singer }}</span>
              <span :title="item.meta.albumName">{{ item.meta.albumName || '—' }}</span>
              <span :class="$style.trackDuration">{{ item.interval || '—' }}</span>
              <button type="button" :aria-label="$t('list__play')" @click="playDetailList(index)">▶</button>
            </li>
          </ol>
          <p v-else :class="$style.detailEmpty">{{ detailEmptyText }}</p>
        </div>
      </div>
    </div>
  </transition>
  <material-modal :show="isShowAccountModal" :bg-close="!isAccountLoginPending" @close="closeAccountModal">
    <main :class="$style.accountModal">
      <div :class="$style.qrHeading">
        <div :class="$style.qrIcon" aria-hidden="true">
          <source-icon source="tx" :size="30" />
          <source-icon source="wy" :size="30" />
        </div>
        <div>
          <h2>{{ $t('search__account_title') }}</h2>
          <p>{{ $t('search__account_desc') }}</p>
        </div>
      </div>
      <div :class="$style.providerList">
        <button
          type="button" :class="{ [$style.activeProvider]: selectedDailyProvider == 'tx' }" :disabled="isAccountLoginPending || isAccountStatusLoading"
          @click="handleProviderAction('tx')"
        >
          <source-icon source="tx" :size="38" :label="$t('search__account_qq')" />
          <div>
            <strong>{{ $t('search__account_qq') }}</strong>
            <span>{{ accountProviderStatusText('tx') }}</span>
          </div>
          <em :class="{ [$style.connectedDot]: accountStatus.tx }">{{ accountStatus.tx ? '✓' : '›' }}</em>
        </button>
        <button
          type="button" :class="{ [$style.activeProvider]: selectedDailyProvider == 'wy' }" :disabled="isAccountLoginPending || isAccountStatusLoading"
          @click="handleProviderAction('wy')"
        >
          <source-icon source="wy" :size="38" :label="$t('search__account_netease')" />
          <div>
            <strong>{{ $t('search__account_netease') }}</strong>
            <span>{{ accountProviderStatusText('wy') }}</span>
          </div>
          <em :class="{ [$style.connectedDot]: accountStatus.wy }">{{ accountStatus.wy ? '✓' : '›' }}</em>
        </button>
      </div>
      <section v-if="selectedDailyProvider == 'tx' || accountStatus.tx" :class="$style.officialDailySetup">
        <div>
          <strong>{{ $t('search__qq_daily_title') }}</strong>
          <span :class="{ [$style.keyConnected]: qqDailyKeyStatus.configured }">{{ qqDailyKeyStatusText }}</span>
        </div>
        <p>{{ $t('search__qq_daily_desc') }}</p>
        <button
          type="button" :class="$style.autoKeyButton"
          :disabled="isQQDailyKeySaving || !qqDailyKeyStatus.encryptionAvailable" @click="openOfficialDailyKeyPage"
        >
          {{ isQQDailyKeySaving ? $t('search__qq_daily_authorizing') : $t('search__qq_daily_authorize') }}
        </button>
        <details :class="$style.manualKeySetup">
          <summary>{{ $t('search__qq_daily_manual') }}</summary>
          <div :class="$style.keyInputRow">
            <input
              v-model.trim="qqDailyApiKeyInput" type="password" autocomplete="off" spellcheck="false"
              :disabled="isQQDailyKeySaving || !qqDailyKeyStatus.encryptionAvailable"
              :placeholder="$t('search__qq_daily_placeholder')" @keyup.enter="saveOfficialDailyKey"
            >
            <button type="button" :disabled="isQQDailyKeySaving || !qqDailyApiKeyInput" @click="saveOfficialDailyKey">
              {{ isQQDailyKeySaving ? $t('search__qq_daily_saving') : $t('search__qq_daily_save') }}
            </button>
          </div>
        </details>
      </section>
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
import { getMusicAccountDaily, getMusicAccountPlaylistDetail, getMusicAccountPlaylists, getMusicAccountStatus, getQQDailyKeyStatus, loginMusicAccount, openQQDailyKeyPage, saveQQDailyApiKey } from '@renderer/utils/ipc'
import wyMusicDetail from '@renderer/utils/musicSdk/wy/musicDetail'
import txMusicInfo from '@renderer/utils/musicSdk/tx/musicInfo'
import { toNewMusicInfo } from '@renderer/utils'
import SourceIcon from '@renderer/components/common/SourceIcon.vue'

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
const detailKind = ref('daily')
const selectedAccountPlaylist = ref(null)
const selectedAccountPlaylistProvider = ref('wy')
const playlistDetailList = shallowRef([])
const accountPlaylists = shallowRef([])
const accountPlaylistsProvider = ref('')
const isPlaylistsLoading = shallowRef(false)
const isPlaylistDetailLoading = shallowRef(false)
const isShowAccountModal = ref(false)
const isAccountLoginPending = ref(false)
const isAccountStatusLoading = ref(false)
const qqDailyApiKeyInput = ref('')
const qqDailyKeyStatus = ref({ configured: false, encryptionAvailable: true })
const qqDailyKeySaveState = ref('idle')
const isQQDailyKeySaving = ref(false)
const accountStatus = ref({ tx: false, wy: false })
const storedDailyProvider = window.localStorage.getItem('qmusic.dailyRecommend.provider')
const selectedDailyProvider = ref(storedDailyProvider == 'wy' ? 'wy' : 'tx')
const dailyRecommendMode = ref('loading')
const dailyRecommendKind = ref('radar')
let hotSearchRequestId = 0
let dailyRequestId = 0
let accountStatusRequestId = 0
const now = new Date()
const todayDay = String(now.getDate()).padStart(2, '0')
const todayMonth = new Intl.DateTimeFormat(window.i18n.locale || 'zh-CN', { month: 'short' }).format(now)
const todayLabel = new Intl.DateTimeFormat(window.i18n.locale || 'zh-CN', { month: 'long', day: 'numeric' }).format(now)
const hasMusicAccount = computed(() => accountStatus.value.tx || accountStatus.value.wy)
const dailyTitle = computed(() => {
  const title = selectedDailyProvider.value == 'tx'
    ? window.i18n.t(dailyRecommendKind.value == 'official_daily' ? 'search__qq_daily_30' : 'search__qq_radar')
    : window.i18n.t('search__netease_daily')
  const count = dailyRecommendList.value.length || (isDailyLoading.value ? 30 : 0)
  return `${title} · ${window.i18n.t('search__daily_count', { count })}`
})
const qqDailyKeyStatusText = computed(() => {
  if (!qqDailyKeyStatus.value.encryptionAvailable) return window.i18n.t('search__qq_daily_storage_unavailable')
  if (qqDailyKeySaveState.value == 'invalid') return window.i18n.t('search__qq_daily_invalid')
  if (qqDailyKeySaveState.value == 'saved') return window.i18n.t('search__qq_daily_saved')
  return qqDailyKeyStatus.value.configured
    ? window.i18n.t('search__qq_daily_configured')
    : window.i18n.t('search__qq_daily_not_configured')
})
const dailySourceText = computed(() => {
  const mode = dailyRecommendMode.value == 'personalized'
    ? window.i18n.t('search__daily_source_personalized')
    : dailyRecommendMode.value == 'loading'
      ? window.i18n.t('search__daily_source_loading')
      : window.i18n.t('search__daily_source_fallback')
  return mode
})
const accountActionText = computed(() => {
  if (accountStatus.value.tx && accountStatus.value.wy) return window.i18n.t('search__account_both_connected')
  if (accountStatus.value.tx) return window.i18n.t('search__account_qq_connected')
  if (accountStatus.value.wy) return window.i18n.t('search__account_netease_connected')
  return window.i18n.t('search__account_login')
})
const accountProviderStatusText = provider => {
  if (isAccountStatusLoading.value) return window.i18n.t('search__account_checking')
  if (accountStatus.value[provider]) return window.i18n.t('search__account_connected')
  return window.i18n.t(provider == 'tx' ? 'search__account_qq_tip' : 'search__account_netease_tip')
}
const dailyDetailEmptyText = computed(() => isDailyLoading.value
  ? window.i18n.t('search__daily_recommend_loading')
  : window.i18n.t('search__daily_recommend_empty'))
const detailMusicList = computed(() => detailKind.value == 'playlist' ? playlistDetailList.value : dailyRecommendList.value)
const detailTitle = computed(() => detailKind.value == 'playlist' ? selectedAccountPlaylist.value?.name ?? '' : dailyTitle.value)
const detailCover = computed(() => detailKind.value == 'playlist' ? selectedAccountPlaylist.value?.cover ?? '' : dailyCoverUrls.value[0] ?? '')
const detailEyebrow = computed(() => detailKind.value == 'playlist'
  ? window.i18n.t('search__account_playlists_eyebrow')
  : window.i18n.t('search__daily_eyebrow'))
const detailSubtitle = computed(() => detailKind.value == 'playlist'
  ? window.i18n.t('search__daily_count', { count: detailMusicList.value.length })
  : `${todayLabel} · ${window.i18n.t('search__daily_count', { count: detailMusicList.value.length })}`)
const detailProvider = computed(() => detailKind.value == 'playlist' ? selectedAccountPlaylistProvider.value : selectedDailyProvider.value)
const detailSourceText = computed(() => detailKind.value == 'playlist' ? selectedAccountPlaylist.value?.creator?.trim() ?? '' : dailySourceText.value)
const detailEmptyText = computed(() => detailKind.value == 'playlist'
  ? isPlaylistDetailLoading.value ? window.i18n.t('search__account_playlist_loading') : window.i18n.t('search__account_playlist_empty')
  : dailyDetailEmptyText.value)
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
          list = await wyMusicDetail.getList(result.ids.slice(0, 30)).then(data => data.list.map(item => toNewMusicInfo(item))).catch(() => [])
        } else {
          const details = await Promise.all(result.ids.slice(0, 30).map(id => txMusicInfo(id).catch(() => null)))
          list = details.filter(Boolean).map(item => toNewMusicInfo(item))
        }
      }
      if (list.length && result?.status == 'personalized') dailyRecommendMode.value = 'personalized'
      if (result?.kind) dailyRecommendKind.value = result.kind
    }
    if (!list.length) {
      list = await getDailyRecommend(sourceOverride, force)
      dailyRecommendMode.value = 'fallback'
      dailyRecommendKind.value = sourceOverride == 'tx' ? 'radar' : 'netease_daily'
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
      dailyRecommendMode.value = 'fallback'
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
  detailKind.value = 'daily'
  isShowDailyDetail.value = true
}

const closeDailyDetail = () => {
  isShowDailyDetail.value = false
}

const loadAccountPlaylists = async(force = false, provider = selectedDailyProvider.value) => {
  if (!accountStatus.value[provider] || (accountPlaylistsProvider.value == provider && accountPlaylists.value.length && !force)) return
  isPlaylistsLoading.value = true
  accountPlaylistsProvider.value = provider
  accountPlaylists.value = []
  try {
    const result = await getMusicAccountPlaylists(provider)
    if (accountPlaylistsProvider.value == provider) accountPlaylists.value = result.status == 'available' ? result.playlists : []
  } catch {
    if (accountPlaylistsProvider.value == provider) accountPlaylists.value = []
  } finally {
    isPlaylistsLoading.value = false
  }
}

const openAccountPlaylist = async(playlist) => {
  const provider = selectedDailyProvider.value
  selectedAccountPlaylist.value = playlist
  selectedAccountPlaylistProvider.value = provider
  playlistDetailList.value = []
  detailKind.value = 'playlist'
  isShowDailyDetail.value = true
  isPlaylistDetailLoading.value = true
  try {
    const result = await getMusicAccountPlaylistDetail(provider, playlist.id)
    if (result.ids.length) {
      if (provider == 'wy') {
        playlistDetailList.value = await wyMusicDetail.getList(result.ids).then(data => data.list.map(item => toNewMusicInfo(item))).catch(() => [])
      } else {
        const list = []
        for (let index = 0; index < result.ids.length; index += 30) {
          const items = await Promise.all(result.ids.slice(index, index + 30).map(id => txMusicInfo(id).catch(() => null)))
          list.push(...items.filter(Boolean).map(item => toNewMusicInfo(item)))
        }
        playlistDetailList.value = list
      }
    }
  } finally {
    isPlaylistDetailLoading.value = false
  }
}

const playDetailList = async(index = 0) => {
  const list = detailMusicList.value
  if (!list.length) return
  const listId = detailKind.value == 'playlist' ? `q_playlist_${selectedAccountPlaylistProvider.value}_${selectedAccountPlaylist.value?.id ?? 'unknown'}` : `q_daily_${new Date().toISOString().slice(0, 10)}`
  await setTempList(listId, [...list])
  playList(LIST_IDS.TEMP, index)
}

const refreshAccountStatus = async() => {
  const requestId = ++accountStatusRequestId
  isAccountStatusLoading.value = true
  const status = await getMusicAccountStatus().catch(() => ({ tx: false, wy: false }))
  if (requestId != accountStatusRequestId) return
  accountStatus.value = status
  isAccountStatusLoading.value = false
  if (!accountStatus.value[selectedDailyProvider.value]) {
    if (accountStatus.value.tx) selectedDailyProvider.value = 'tx'
    else if (accountStatus.value.wy) selectedDailyProvider.value = 'wy'
    window.localStorage.setItem('qmusic.dailyRecommend.provider', selectedDailyProvider.value)
  }
  if (accountStatus.value[selectedDailyProvider.value]) void loadAccountPlaylists(false, selectedDailyProvider.value)
}

const selectDailyProvider = (provider, force = false) => {
  if (!force && selectedDailyProvider.value == provider && dailyRecommendList.value.length) return
  selectedDailyProvider.value = provider
  window.localStorage.setItem('qmusic.dailyRecommend.provider', provider)
  void loadDailyRecommend(true, provider)
  if (accountStatus.value[provider]) void loadAccountPlaylists(false, provider)
}

const openAccountModal = () => {
  isShowAccountModal.value = true
  void refreshAccountStatus()
  void refreshQQDailyKeyStatus()
}

const refreshQQDailyKeyStatus = async() => {
  qqDailyKeyStatus.value = await getQQDailyKeyStatus().catch(() => ({ configured: false, encryptionAvailable: false }))
}

const openOfficialDailyKeyPage = async() => {
  if (isQQDailyKeySaving.value) return
  isQQDailyKeySaving.value = true
  qqDailyKeySaveState.value = 'idle'
  try {
    const result = await openQQDailyKeyPage()
    qqDailyKeyStatus.value = { configured: result.configured, encryptionAvailable: result.encryptionAvailable }
    if (result.status == 'saved') {
      qqDailyKeySaveState.value = 'saved'
      selectDailyProvider('tx', true)
    }
  } finally {
    isQQDailyKeySaving.value = false
  }
}

const saveOfficialDailyKey = async() => {
  if (!qqDailyApiKeyInput.value || isQQDailyKeySaving.value) return
  isQQDailyKeySaving.value = true
  qqDailyKeySaveState.value = 'idle'
  try {
    const result = await saveQQDailyApiKey(qqDailyApiKeyInput.value)
    qqDailyKeyStatus.value = { configured: result.configured, encryptionAvailable: result.encryptionAvailable }
    qqDailyKeySaveState.value = result.status == 'saved' ? 'saved' : 'invalid'
    if (result.status == 'saved') {
      qqDailyApiKeyInput.value = ''
      selectDailyProvider('tx', true)
    }
  } finally {
    isQQDailyKeySaving.value = false
  }
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
      if (selectedDailyProvider.value == provider) void loadDailyRecommend(true, provider)
      void loadAccountPlaylists(true, provider)
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
  width: min(1180px, 100%);
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
  min-height: 282px;
  overflow: hidden;
  display: flex;
  gap: 26px;
  padding: 30px;
  box-sizing: border-box;
  border-radius: 16px;
  color: var(--color-font);
  background: linear-gradient(118deg, var(--color-primary-alpha-800), rgba(255, 255, 255, .88) 62%, var(--color-primary-alpha-1000));
  border: 0;
  box-shadow: 0 12px 34px rgba(35, 54, 46, .1);
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
  width: 210px;
  height: 210px;
  flex: none;
  overflow: hidden;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 3px;
  border-radius: 12px;
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
  border-radius: 12px;
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
.dailyContent > .sourceStatus {
  margin-top: 7px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;

  &.personalized { color: var(--color-primary-dark-100); }
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
.playlistShelf {
  padding: 6px 4px 2px;

  > header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 14px;

    h3 { margin: 0 0 5px; color: var(--color-font); font-size: 18px; }
    p { margin: 0; color: var(--color-font-label); font-size: 11px; }
    > button {
      padding: 6px 10px;
      border: 0;
      border-radius: 9px;
      color: var(--color-font-label);
      background: transparent;
      cursor: pointer;
      font: inherit;
      font-size: 11px;
      &:hover { color: var(--color-primary); background: var(--color-primary-alpha-1000); }
    }
  }
}
.playlistRail {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 16px;

  > button {
    min-width: 0;
    padding: 0;
    border: 0;
    color: var(--color-font);
    background: transparent;
    cursor: pointer;
    font: inherit;
    text-align: left;

    &:hover .playlistCover { transform: translateY(-3px); box-shadow: 0 13px 25px rgba(35, 54, 46, .17); }
    &:hover .playlistCover i { opacity: 1; transform: translateY(0); }
    strong, small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    strong { margin-top: 8px; font-size: 12px; font-weight: 620; }
    small { margin-top: 4px; color: var(--color-font-label); font-size: 10px; }
  }
}
.discoveryGrid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px 18px;

  > button {
    display: grid;
    grid-template-columns: 78px minmax(0, 1fr);
    grid-template-rows: 1fr 1fr;
    column-gap: 12px;
    align-items: center;
    padding: 8px;
    border-radius: 14px;
    background: rgba(255, 255, 255, .38);
    transition: background-color @transition-fast, transform @transition-fast, box-shadow @transition-fast;

    &:hover {
      transform: translateY(-2px);
      background: rgba(255, 255, 255, .68);
      box-shadow: 0 12px 26px rgba(35, 54, 46, .1);
    }

    .playlistCover {
      grid-row: 1 / 3;
      width: 78px;
      height: 78px;
    }

    strong { margin-top: auto; align-self: end; font-size: 12.5px; }
    small { margin-bottom: auto; align-self: start; }
  }
}
.playlistCover {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: var(--color-primary);
  background: var(--color-primary-alpha-900);
  transition: transform @transition-fast, box-shadow @transition-fast;

  img { width: 100%; height: 100%; object-fit: cover; }
  :global(.svg-icon) { width: 25px; height: 25px; }
  i {
    position: absolute;
    right: 10px;
    bottom: 10px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: #fff;
    background: var(--color-primary);
    box-shadow: 0 7px 16px rgba(0, 0, 0, .2);
    opacity: 0;
    transform: translateY(5px);
    transition: opacity @transition-fast, transform @transition-fast;
    font-size: 10px;
    font-style: normal;
  }
}
.playlistEmpty {
  margin: 0;
  padding: 20px;
  border-radius: 12px;
  color: var(--color-font-label);
  background: var(--color-primary-alpha-1000);
  font-size: 11px;
  text-align: center;
}
.syncAction {
  height: 40px;
  padding: 0 10px 0 8px;
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

  :global(.svg-icon) { width: 17px; height: 17px; }
  b { margin-left: 1px; font-size: 17px; font-weight: 500; opacity: .72; }

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
.accountIcons {
  display: flex;
  align-items: center;

  > * {
    overflow: hidden;
    border: 2px solid rgba(255, 255, 255, .88);
    border-radius: 50%;
    background: #fff;
  }

  > * + * { margin-left: -6px; }
}

@media (max-width: 980px) {
  .discoveryGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.dailyDetail {
  width: min(1160px, 100%);
  height: 100%;
  min-height: 0;
  padding: 4px 8px 12px;
  box-sizing: border-box;
  display: flex;
  flex-flow: column nowrap;
}
.detailHeader {
  flex: none;
  min-height: 112px;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 10px 14px 20px;
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
  width: 86px;
  height: 86px;
  flex: none;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 21px;
  color: var(--color-primary);
  background: var(--color-primary-alpha-900);
  box-shadow: 0 10px 26px rgba(35, 54, 46, .14);

  img { width: 100%; height: 100%; object-fit: cover; }
  :global(.svg-icon) { width: 25px; height: 25px; }
}
.detailCopy {
  min-width: 0;
  flex: 1;

  h2 { margin: 4px 0 5px; color: var(--color-font); font-size: 27px; }
  p { margin: 0; color: var(--color-font-label); font-size: 13px; }
}
.detailCopy > .detailSource {
  margin-top: 5px;
  display: flex;
  align-items: center;
  gap: 6px;
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
  grid-template-columns: 42px minmax(210px, 1.55fr) minmax(130px, .82fr) minmax(160px, 1fr) 58px 42px;
  align-items: center;
  gap: 12px;
}
.detailTableHeader {
  flex: none;
  min-height: 46px;
  padding: 0 16px;
  color: var(--color-font-label);
  border-bottom: 1px solid rgba(54, 83, 70, .09);
  font-size: 12px;
}
.detailTracks {
  min-height: 0;
  flex: 1;
  margin: 0;
  padding: 7px 8px 12px;
  list-style: none;

  li {
    min-height: 56px;
    padding: 0 8px;
    border-radius: 13px;
    color: var(--color-font);
    font-size: 13px;
    transition: background-color @transition-fast;

    &:hover { background: var(--color-primary-alpha-1000); }
    > strong, > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    > strong { font-weight: 650; }
    > span:not(.trackNumber) { color: var(--color-font-label); }
    > button {
      width: 34px;
      height: 34px;
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
.trackDuration { font-variant-numeric: tabular-nums; }
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
  width: 56px;
  height: 42px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 7px;
  box-sizing: border-box;

  > * {
    overflow: hidden;
    border: 3px solid rgba(255, 255, 255, .92);
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 6px 16px rgba(35, 54, 46, .13);
  }
  > * + * { margin-left: -9px; }
}
.providerList {
  display: grid;
  gap: 11px;
  margin-top: 22px;

  button {
    position: relative;
    min-height: 76px;
    padding: 15px 50px 15px 15px;
    border: 1px solid rgba(54, 83, 70, .13);
    border-radius: 17px;
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
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
    &.activeProvider {
      border-color: var(--color-primary-alpha-500);
      background: var(--color-primary-alpha-1000);
      box-shadow: inset 0 0 0 1px var(--color-primary-alpha-900);
    }
    &:disabled { cursor: wait; opacity: .65; }
  }
  button > div { min-width: 0; }
  strong { font-size: 14px; }
  strong, button > div span { display: block; .mixin-ellipsis-1(); }
  button > div span { margin-top: 6px; color: var(--color-font-label); font-size: 11px; }
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
.officialDailySetup {
  margin-top: 14px;
  padding: 15px;
  border: 1px solid rgba(54, 83, 70, .12);
  border-radius: 15px;
  background: var(--color-primary-alpha-1000);

  > div:first-child {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    strong { color: var(--color-font); font-size: 12px; }
    span { color: var(--color-font-label); font-size: 10px; }
    .keyConnected { color: var(--color-primary); font-weight: 650; }
  }
  > p { margin: 7px 0 11px; color: var(--color-font-label); font-size: 10px; line-height: 1.55; }
}
.keyInputRow {
  display: flex;
  gap: 8px;

  input {
    min-width: 0;
    height: 34px;
    flex: 1;
    padding: 0 11px;
    border: 1px solid rgba(54, 83, 70, .14);
    border-radius: 10px;
    color: var(--color-font);
    background: rgba(255, 255, 255, .72);
    outline: none;
    font: inherit;
    font-size: 11px;
    &:focus { border-color: var(--color-primary-alpha-500); }
  }
  button {
    height: 34px;
    padding: 0 13px;
    border: 0;
    border-radius: 10px;
    color: #fff;
    background: var(--color-primary);
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    &:disabled { cursor: default; opacity: .45; }
  }
}
.autoKeyButton {
  width: 100%;
  height: 36px;
  border: 0;
  border-radius: 11px;
  color: #fff;
  background: var(--color-primary);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  font-weight: 650;
  &:disabled { cursor: default; opacity: .45; }
}
.manualKeySetup {
  margin-top: 9px;
  color: var(--color-font-label);
  font-size: 10px;

  summary {
    width: fit-content;
    cursor: pointer;
    color: var(--color-primary-dark-100);
    user-select: none;
  }
  .keyInputRow { margin-top: 8px; }
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
  .detailTableHeader, .detailTracks li {
    grid-template-columns: 38px minmax(160px, 1.4fr) minmax(110px, .8fr) 54px 40px;

    > :nth-child(4) { display: none; }
  }
  .playlistRail { grid-template-columns: repeat(3, minmax(0, 1fr)); }
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
