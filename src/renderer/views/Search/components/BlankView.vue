<template>
  <transition enter-active-class="animated-fast fadeIn" leave-active-class="animated-fast fadeOut">
    <div v-show="props.visible" :class="$style.noitem">
      <transition
        mode="out-in"
        :enter-active-class="$style.panelEnterActive" :leave-active-class="$style.panelLeaveActive"
        :enter-from-class="isShowDailyDetail ? $style.panelFromRight : $style.panelFromLeft"
        :leave-to-class="$style.panelFade"
      >
        <div v-if="!isShowDailyDetail" class="scroll" :class="$style.noitemShell">
          <header :class="$style.welcomeBar">
            <div :class="$style.welcomeCopy">
              <span :class="$style.greetingTag">{{ $t('search__home_eyebrow') }}</span>
              <h2>{{ $t('search__welcome') }}</h2>
              <p>{{ $t('search__welcome_subtitle') }}</p>
            </div>
            <button type="button" :class="[$style.syncAction, { [$style.connected]: hasMusicAccount }]" @click="openAccountModal">
              <span :class="$style.accountIcons">
                <source-icon v-if="accountStatus.accounts.tx.hasSession" source="tx" :size="20" />
                <source-icon v-if="accountStatus.accounts.wy.hasSession" source="wy" :size="20" />
                <source-icon v-if="accountStatus.accounts.kg.hasSession" source="kg" :size="20" />
                <svg-icon v-if="!hasMusicAccountSession" name="headphones" />
              </span>
              <span>{{ accountActionText }}</span>
              <b aria-hidden="true">›</b>
            </button>
          </header>

          <nav :class="$style.recommendProviders" :aria-label="$t('search__recommend_provider')">
            <span>{{ $t('search__recommend_provider') }}</span>
            <button
              v-for="provider in accountProviderOptions" :key="provider.id" type="button"
              :aria-pressed="selectedDailyProvider == provider.id" :class="{ [$style.providerSelected]: selectedDailyProvider == provider.id }"
              @click="selectDailyProvider(provider.id)"
            >
              <source-icon :source="provider.id" :size="18" />{{ $t(provider.nameKey) }}
            </button>
          </nav>
          <div :class="$style.featureGrid">
            <section
              :class="$style.dailyCard" role="button" tabindex="0"
              :aria-label="$t('search__daily_open')" @click="openDailyDetail"
              @keydown.enter="openDailyDetail" @keydown.space.prevent="openDailyDetail"
            >
              <div :class="$style.dailyCover" aria-hidden="true">
                <div v-for="index in 4" :key="index" :class="$style.coverTile">
                  <img v-if="dailyCoverUrls[index - 1]" :class="$style.fadeImg" :src="dailyCoverUrls[index - 1]" alt="" @load="handleCoverLoad" @error="handleDailyCoverError(index - 1)">
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
                <p>{{ $t(dailyRecommendMode == 'personalized' ? 'search__daily_personalized_desc' : 'search__daily_recommend_subtitle') }}</p>
                <p :class="[$style.sourceStatus, { [$style.personalized]: dailyRecommendMode == 'personalized' }]">
                  <source-icon :source="selectedDailyProvider" :size="15" />{{ dailySourceText }}
                </p>
                <ol v-if="dailyRecommendList.length" :class="$style.trackPreview">
                  <li v-for="item in dailyRecommendList.slice(0, 3)" :key="item.id"><strong>{{ item.name }}</strong><span>{{ item.singer }}</span></li>
                </ol>
                <ol v-else-if="isDailyLoading" :class="[$style.trackPreview, $style.trackPreviewSkeleton]" :aria-label="$t('search__daily_recommend_loading')">
                  <li v-for="index in 3" :key="index"><i /><i /></li>
                </ol>
                <div v-else :class="$style.dailyLoading">{{ $t('search__daily_recommend_empty') }}</div>
                <div :class="$style.dailyActions">
                  <button type="button" :disabled="!dailyRecommendList.length" @click.stop="playDailyRecommend()">{{ $t('search__daily_recommend_play') }}</button>
                  <button v-if="dailyRefreshAction" type="button" :disabled="isDailyLoading" @click.stop="loadDailyRecommend(true)">{{ $t(dailyRefreshAction == 'shuffle' ? 'search__daily_recommend_refresh' : 'search__retry') }}</button>
                  <span :class="$style.openHint">{{ $t('search__daily_open') }} ›</span>
                </div>
              </div>
            </section>
          </div>

          <DiscoveryPlaylists :provider="selectedDailyProvider" />

          <section v-if="canReadAccountPlaylists(accountPlaylistsProvider)" :class="$style.playlistShelf">
            <header>
              <div>
                <h3>{{ $t('search__provider_playlists', { name: $t(accountProviderOptions.find(item => item.id == accountPlaylistsProvider)?.nameKey || 'search__account_playlists') }) }}</h3>
                <p>{{ $t('search__account_playlists_desc') }}</p>
              </div>
              <button type="button" :disabled="isPlaylistsLoading" @click="loadAccountPlaylists(true, accountPlaylistsProvider)">
                {{ isPlaylistsLoading ? $t('search__account_playlists_loading') : $t('search__hot_search_refresh') }}
              </button>
            </header>
            <button type="button" :class="$style.libraryImportButton" @click="openAccountImport(accountPlaylistsProvider)">{{ $t('search__account_import') }} ›</button>
            <div v-if="accountPlaylists.length" :class="$style.playlistRail">
              <button v-for="playlist in accountPlaylists" :key="playlist.id" type="button" @click="openAccountPlaylist(playlist)">
                <span :class="$style.playlistCover">
                  <img v-if="playlist.cover" :class="$style.fadeImg" :src="playlist.cover" alt="" @load="handleCoverLoad">
                  <svg-icon v-else name="music" />
                  <i>▶</i>
                </span>
                <strong :title="playlist.name">{{ playlist.name }}</strong>
                <small>{{ $t('search__daily_count', { count: playlist.trackCount }) }}</small>
              </button>
            </div>
            <div v-else-if="isPlaylistsLoading" :class="[$style.playlistRail, $style.playlistSkeleton]" :aria-label="$t('search__account_playlists_loading')">
              <div v-for="index in 5" :key="index"><i /><b /><b /></div>
            </div>
            <div v-else-if="accountPlaylistsError" :class="$style.playlistEmpty" role="status">
              <p>{{ $t(accountPlaylistsError == 'login_required' ? 'search__account_expired' : accountPlaylistsError == 'verification_required' ? 'kugou__verification_required' : 'playlist_import_modal__account_unavailable') }}</p>
              <base-btn min @click="accountPlaylistsError == 'login_required' ? openAccountModal() : loadAccountPlaylists(true, accountPlaylistsProvider)">{{ $t(accountPlaylistsError == 'login_required' ? 'search__account_manage' : 'search__retry') }}</base-btn>
            </div>
            <p v-else :class="$style.playlistEmpty">{{ $t('search__account_playlists_empty') }}</p>
          </section>

        </div>
        <div v-else :class="$style.dailyDetail">
          <header :class="$style.detailHeader">
            <button type="button" :class="$style.backButton" :aria-label="$t('back')" @click="closeDailyDetail">‹</button>
            <div :class="$style.detailCover" aria-hidden="true">
              <img v-if="detailCover" :class="$style.fadeImg" :src="detailCover" alt="" @load="handleCoverLoad">
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
              <base-btn v-if="detailKind == 'daily' && dailyRefreshAction" min :disabled="isDailyLoading" @click="loadDailyRecommend(true)">{{ $t(dailyRefreshAction == 'shuffle' ? 'search__daily_recommend_refresh' : 'search__retry') }}</base-btn>
              <base-btn v-if="detailKind == 'playlist'" min :disabled="isPlaylistDetailLoading" @click="openAccountPlaylist(selectedAccountPlaylist)">{{ $t('search__hot_search_refresh') }}</base-btn>
            </div>
          </header>
          <div :class="$style.detailList">
            <div :class="$style.detailTableHeader" aria-hidden="true">
              <span>#</span><span>{{ $t('music_name') }}</span><span>{{ $t('music_singer') }}</span><span>{{ $t('music_album') }}</span><span>{{ $t('music_time') }}</span><span />
            </div>
            <ol v-if="detailMusicList.length" class="scroll" :class="$style.detailTracks">
              <li v-for="(item, index) in detailMusicList" :key="`${item.source}_${item.id}`" :class="{ [$style.currentTrack]: isCurrentTrack(item) }" @dblclick="playDetailList(index)">
                <span :class="$style.trackNumber">
                  <span v-if="isCurrentTrack(item)" :class="[$style.playingBars, { [$style.playingBarsPaused]: !isPlay }]" aria-hidden="true"><i /><i /><i /></span>
                  <template v-else>{{ String(index + 1).padStart(2, '0') }}</template>
                </span>
                <strong :title="item.name"><SongTitle :music="item" /></strong>
                <span :title="item.singer">{{ item.singer }}</span>
                <span :title="item.meta.albumName">{{ item.meta.albumName || '—' }}</span>
                <span :class="$style.trackDuration">{{ item.interval || '—' }}</span>
                <button type="button" :aria-label="isCurrentTrack(item) && isPlay ? $t('player__pause') : $t('list__play')" @click="playDetailList(index)">{{ isCurrentTrack(item) && isPlay ? '❚❚' : '▶' }}</button>
              </li>
            </ol>
            <ol v-else-if="isDetailLoading" :class="$style.detailTracksSkeleton" :aria-label="detailEmptyText">
              <li v-for="index in 8" :key="index"><i /><i /><i /><i /><i /></li>
            </ol>
            <p v-else :class="$style.detailEmpty">{{ detailEmptyText }}</p>
          </div>
        </div>
      </transition>
    </div>
  </transition>
  <material-modal :show="isShowAccountModal" :bg-close="!isAccountLoginPending" @close="closeAccountModal">
    <main class="scroll" :class="$style.accountModal" tabindex="0" :aria-label="$t('search__account_title')">
      <div :class="$style.qrHeading">
        <div :class="$style.qrIcon" aria-hidden="true">
          <source-icon source="tx" :size="30" />
          <source-icon source="wy" :size="30" />
          <source-icon source="kg" :size="30" />
        </div>
        <div>
          <h2>{{ $t('search__account_title') }}</h2>
          <p>{{ $t('search__account_desc') }}</p>
        </div>
      </div>
      <div :class="$style.providerList">
        <div
          v-for="provider in accountProviderOptions" :key="provider.id"
          :class="[$style.providerCard, { [$style.activeProvider]: selectedDailyProvider == provider.id }]"
        >
          <div :class="$style.providerHeader">
            <button
              type="button" :class="$style.providerAction"
              :aria-expanded="expandedAccountProvider == provider.id"
              :aria-controls="`account-details-${provider.id}`"
              @click="handleProviderAction(provider.id)"
            >
              <img
                v-if="accountStatus.accounts[provider.id].avatar" :class="$style.accountAvatar"
                :src="accountStatus.accounts[provider.id].avatar" alt="" @error="handleAccountAvatarError(provider.id)"
              >
              <source-icon v-else :source="provider.id" :size="38" :label="$t(provider.nameKey)" />
              <div>
                <strong>{{ $t(provider.nameKey) }}</strong>
                <span v-if="accountStatus.accounts[provider.id].displayName">{{ accountStatus.accounts[provider.id].displayName }}</span>
                <span v-if="accountStatus.accounts[provider.id].accountHint" :class="$style.accountIdentity">
                  {{ accountStatus.accounts[provider.id].accountHint }}
                </span>
                <span>{{ isAccountLoginPending && accountLoginProvider == provider.id ? $t('search__account_waiting') : accountProviderStatusText(provider.id) }}</span>
              </div>
              <span :class="$style.providerToggle">
                {{ $t(expandedAccountProvider == provider.id ? 'search__account_collapse' : 'search__account_manage') }}
                <i :class="{ [$style.chevronExpanded]: expandedAccountProvider == provider.id }" aria-hidden="true" />
              </span>
            </button>

          </div>
          <div
            :id="`account-details-${provider.id}`" :class="[$style.providerReveal, { [$style.providerRevealed]: expandedAccountProvider == provider.id }]"
            :inert="expandedAccountProvider == provider.id ? null : ''" :aria-hidden="expandedAccountProvider != provider.id"
          >
            <div :class="$style.providerRevealInner">
              <div :class="$style.providerDetails">
                <p>{{ $t(provider.id == 'tx' ? 'search__recommend_qq_desc' : provider.id == 'wy' ? 'search__recommend_wy_desc' : 'search__recommend_kg_desc') }}</p>
                <div :class="$style.providerTools">
                  <button v-if="!accountStatus[provider.id]" type="button" :disabled="isAccountLoginPending || isAccountStatusLoading || !!isAccountLogoutPending" @click="connectMusicAccount(provider.id)">{{ $t('search__account_login') }}</button>
                  <button type="button" :disabled="!accountStatus[provider.id] || isAccountLoginPending || !!isAccountLogoutPending" @click="openAccountImport(provider.id)">{{ $t('search__account_import') }}</button>
                  <button type="button" :aria-pressed="selectedDailyProvider == provider.id" @click="useAccountRecommendation(provider.id)">{{ $t(selectedDailyProvider == provider.id ? 'search__recommend_current' : 'search__recommend_use') }}</button>
                </div>
                <details v-if="provider.id == 'tx'" :class="$style.officialDailySetup">
                  <summary>
                    <strong>{{ $t('search__qq_daily_title') }}</strong>
                    <span :class="{ [$style.keyConnected]: qqDailyKeyStatus.configured }">{{ qqDailyKeyStatusText }}</span>
                  </summary>
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
                </details>
                <div :class="$style.providerFooter">
                  <button v-if="provider.id == 'tx' && accountStatus.tx" type="button" :disabled="isAccountLoginPending || !!isAccountLogoutPending" @click="isShowAccountTransfer = true">连接手机</button>
                  <button
                    v-if="accountStatus.accounts[provider.id].hasSession" type="button" :class="$style.logoutButton"
                    :disabled="isAccountLoginPending || isAccountStatusLoading || !!isAccountLogoutPending"
                    @click.stop="disconnectMusicAccount(provider.id)"
                  >
                    {{ isAccountLogoutPending == provider.id ? $t('search__account_logging_out') : $t('search__account_logout') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p :class="$style.accountTip" role="status">{{ accountLoginError || (isAccountLoginPending ? $t('search__account_waiting') : $t('search__account_tip')) }}</p>
      <div :class="$style.loginFooter">
        <base-btn min :disabled="isAccountLoginPending" @click="closeAccountModal">{{ $t('btn_close') }}</base-btn>
      </div>
    </main>
  </material-modal>
  <external-import-modal v-model:visible="isShowAccountImport" :list-id="LIST_IDS.DEFAULT" :initial-provider="importProvider" />
  <account-transfer-modal v-model:visible="isShowAccountTransfer" />
</template>

<script setup>
import AccountTransferModal from '@renderer/components/common/AccountTransferModal.vue'
import { computed, watch, shallowRef, ref } from '@common/utils/vueTools'
import { onDeactivated } from 'vue'
import { getDailyRecommend } from '@renderer/core/dailyRecommend'
import { getDailyRefreshAction } from '@common/utils/dailyRecommendPolicy'
import { setTempList } from '@renderer/store/list/action'
import { playList, togglePlay } from '@renderer/core/player/action'
import { isPlay, playMusicInfo } from '@renderer/store/player/state'
import { playFromPage } from '@renderer/core/player/selection'
import { loadTrackArtwork } from '@renderer/utils/trackArtwork'
import { LIST_IDS } from '@common/constants'
import { getMusicAccountDaily, getMusicAccountPlaylistDetail, getMusicAccountPlaylists, getMusicAccountStatus, getQQDailyKeyStatus, loginMusicAccount, logoutMusicAccount, openQQDailyKeyPage, saveQQDailyApiKey } from '@renderer/utils/ipc'
import wyMusicDetail from '@renderer/utils/musicSdk/wy/musicDetail'
import txMusicInfo from '@renderer/utils/musicSdk/tx/musicInfo'
import { toNewMusicInfo } from '@renderer/utils'
import ExternalImportModal from '@renderer/views/List/MyList/components/ExternalImportModal.vue'
import SourceIcon from '@renderer/components/common/SourceIcon.vue'
import SongTitle from '@renderer/components/common/SongTitle.vue'
import DiscoveryPlaylists from './DiscoveryPlaylists.vue'

const props = defineProps({
  visible: Boolean,
  source: {
    type: String,
    required: true,
  },
})

const dailyRecommendList = shallowRef([])
const dailyCoverUrls = shallowRef([])
const isDailyLoading = shallowRef(false)
const isShowDailyDetail = ref(false)
const detailKind = ref('daily')
const selectedAccountPlaylist = ref(null)
const selectedAccountPlaylistProvider = ref('wy')
const playlistDetailList = shallowRef([])
const accountPlaylists = shallowRef([])
const accountPlaylistsError = ref('')
const accountPlaylistsProvider = ref('')
const isPlaylistsLoading = shallowRef(false)
const isPlaylistDetailLoading = shallowRef(false)
const playlistDetailError = ref('')
const isShowAccountModal = ref(false)
const isShowAccountTransfer = ref(false)
const isAccountLoginPending = ref(false)
const accountLoginProvider = ref('')
const accountLoginError = ref('')
const isAccountLogoutPending = ref('')
const isAccountStatusLoading = ref(false)
const qqDailyApiKeyInput = ref('')
const qqDailyKeyStatus = ref({ configured: false, encryptionAvailable: true })
const qqDailyKeySaveState = ref('idle')
const isQQDailyKeySaving = ref(false)
const createEmptyAccountProfile = () => ({ state: 'disconnected', displayName: '', avatar: '', accountHint: '', hasSession: false })
const createEmptyAccountStatus = () => ({ tx: false, wy: false, kg: false, accounts: { tx: createEmptyAccountProfile(), wy: createEmptyAccountProfile(), kg: createEmptyAccountProfile() } })
const accountStatus = ref(createEmptyAccountStatus())
const accountProviderOptions = [
  { id: 'tx', nameKey: 'search__account_qq' },
  { id: 'wy', nameKey: 'search__account_netease' },
  { id: 'kg', nameKey: 'source_kg' },
]
const storedDailyProvider = window.localStorage.getItem('qmusic.dailyRecommend.provider')
const selectedDailyProvider = ref(['tx', 'wy', 'kg'].includes(storedDailyProvider) ? storedDailyProvider : 'tx')
const expandedAccountProvider = ref(selectedDailyProvider.value)
const isShowAccountImport = ref(false)
onDeactivated(() => {
  isShowAccountModal.value = false
  isShowAccountImport.value = false
  isShowAccountTransfer.value = false
})
const importProvider = ref(selectedDailyProvider.value)
const dailyRecommendMode = ref('loading')
const dailyRecommendKind = ref('radar')
const dailyFallbackReason = ref('')
const dailyRefreshAction = computed(() => getDailyRefreshAction(dailyRecommendMode.value, dailyFallbackReason.value))
let dailyRequestId = 0
let accountStatusRequestId = 0
let accountPlaylistsRequestId = 0
let playlistDetailRequestId = 0
const now = new Date()
const todayDay = String(now.getDate()).padStart(2, '0')
const todayMonth = new Intl.DateTimeFormat(window.i18n.locale || 'zh-CN', { month: 'short' }).format(now)
const todayLabel = new Intl.DateTimeFormat(window.i18n.locale || 'zh-CN', { month: 'long', day: 'numeric' }).format(now)
const hasMusicAccount = computed(() => accountStatus.value.tx || accountStatus.value.wy || accountStatus.value.kg)
const hasMusicAccountSession = computed(() => Object.values(accountStatus.value.accounts).some(account => account.hasSession))
const dailyTitle = computed(() => {
  const title = dailyRecommendMode.value == 'fallback' ? window.i18n.t('search__daily_local') : selectedDailyProvider.value == 'tx'
    ? window.i18n.t(dailyRecommendKind.value == 'official_daily' ? 'search__qq_daily_30' : 'search__qq_radar')
    : window.i18n.t(selectedDailyProvider.value == 'kg' ? 'search__kugou_daily' : 'search__netease_daily')
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
  if (accountStatus.value.kg) return '音乐账号已登录'
  if (accountStatus.value.tx && accountStatus.value.wy) return window.i18n.t('search__account_both_connected')
  if (accountStatus.value.tx) return window.i18n.t('search__account_qq_connected')
  if (accountStatus.value.wy) return window.i18n.t('search__account_netease_connected')
  if (hasMusicAccountSession.value) return window.i18n.t('search__account_attention')
  return window.i18n.t('search__account_login')
})
const accountProviderStatusText = provider => {
  if (isAccountStatusLoading.value) return window.i18n.t('search__account_checking')
  const account = accountStatus.value.accounts[provider]
  if (account.state == 'connected') return window.i18n.t('search__account_valid')
  if (account.state == 'expired') return window.i18n.t('search__account_expired')
  if (account.state == 'unavailable') return window.i18n.t('search__account_unavailable')
  if (provider == 'kg') return window.i18n.t('search__account_kugou_tip')
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
  ? window.i18n.t(isPlaylistDetailLoading.value ? 'search__account_playlist_loading' : playlistDetailError.value || 'search__account_playlist_empty')
  : dailyDetailEmptyText.value)
const isDetailLoading = computed(() => detailKind.value == 'playlist' ? isPlaylistDetailLoading.value : isDailyLoading.value)
// 封面加载完成后再淡入，避免图片逐行硬切出现
const handleCoverLoad = event => {
  event.target.classList.add('q-cover-loaded')
}
const loadDailyRecommend = async(force = false, sourceOverride = selectedDailyProvider.value) => {
  if (!props.visible) return
  const requestId = ++dailyRequestId
  isDailyLoading.value = true
  dailyRecommendMode.value = 'loading'
  dailyRecommendList.value = []
  dailyCoverUrls.value = []
  try {
    let mode = 'fallback'
    let kind = sourceOverride == 'tx' ? 'radar' : sourceOverride == 'kg' ? 'kugou_daily' : 'netease_daily'
    let list = []
    const account = accountStatus.value.accounts[sourceOverride]
    let fallbackReason = account.state == 'unavailable' ? 'unavailable' : 'login_required'
    if (accountStatus.value[sourceOverride] || account.state == 'unavailable') {
      const result = await getMusicAccountDaily(sourceOverride).catch(() => null)
      if (requestId != dailyRequestId) return
      fallbackReason = result?.status == 'login_required' ? 'login_required' : 'unavailable'
      if (result?.ids.length) {
        if (sourceOverride == 'kg') {
          const { loadKugouHashMusic } = await import('@renderer/views/List/MyList/importPlaylist')
          list = await loadKugouHashMusic(result.ids, undefined, () => requestId != dailyRequestId).catch(() => [])
        } else if (sourceOverride == 'wy') {
          list = await wyMusicDetail.getList(result.ids.slice(0, 30)).then(data => data.list.map(item => toNewMusicInfo(item))).catch(() => [])
        } else {
          const details = await Promise.all(result.ids.slice(0, 30).map(id => txMusicInfo(id).catch(() => null)))
          list = details.filter(Boolean).map(item => toNewMusicInfo(item))
        }
      }
      if (list.length && result?.status == 'personalized') mode = 'personalized'
      if (result?.kind) kind = result.kind
    }
    if (requestId != dailyRequestId) return
    if (!list.length) {
      list = await getDailyRecommend(sourceOverride, force)
    }
    if (requestId != dailyRequestId) return
    dailyFallbackReason.value = fallbackReason
    dailyRecommendMode.value = mode
    dailyRecommendKind.value = kind
    dailyRecommendList.value = list
    dailyCoverUrls.value = list.slice(0, 4).map(item => item.meta.picUrl ?? '')
    const coverUrls = await Promise.all(list.slice(0, 4).map(async item => {
      if (item.meta.picUrl) return item.meta.picUrl
      return loadTrackArtwork(item)
    }))
    if (requestId == dailyRequestId) dailyCoverUrls.value = coverUrls
  } catch {
    if (requestId == dailyRequestId) {
      dailyRecommendList.value = []
      dailyCoverUrls.value = []
      dailyFallbackReason.value = 'unavailable'
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

const playDailyRecommend = async(index) => {
  if (!dailyRecommendList.value.length) return
  if (typeof index == 'number') { await playFromPage('daily_selection', dailyRecommendList.value, index); return }
  await setTempList(`q_daily_${new Date().toISOString().slice(0, 10)}`, [...dailyRecommendList.value])
  playList(LIST_IDS.TEMP, 0)
}

const openDailyDetail = () => {
  detailKind.value = 'daily'
  isShowDailyDetail.value = true
}

const closeDailyDetail = () => {
  isShowDailyDetail.value = false
}

const canReadAccountPlaylists = provider => !!accountStatus.value[provider] || !!accountStatus.value.accounts[provider]?.hasSession
const loadAccountPlaylists = async(force = false, provider = selectedDailyProvider.value) => {
  accountPlaylistsError.value = ''
  if (!canReadAccountPlaylists(provider)) {
    accountPlaylistsRequestId++
    if (accountPlaylistsProvider.value == provider) {
      accountPlaylistsProvider.value = ''
      accountPlaylists.value = []
    }
    isPlaylistsLoading.value = false
    return
  }
  if (accountPlaylistsProvider.value == provider && accountPlaylists.value.length && !force) return
  const requestId = ++accountPlaylistsRequestId
  isPlaylistsLoading.value = true
  accountPlaylistsProvider.value = provider
  accountPlaylists.value = []
  try {
    const result = await getMusicAccountPlaylists(provider)
    if (requestId == accountPlaylistsRequestId && accountPlaylistsProvider.value == provider) {
      accountPlaylists.value = result?.status == 'available' && Array.isArray(result.playlists) ? result.playlists : []
      if (result?.status != 'available') accountPlaylistsError.value = result?.status || 'unavailable'
    }
  } catch {
    if (requestId == accountPlaylistsRequestId && accountPlaylistsProvider.value == provider) {
      accountPlaylists.value = []
      accountPlaylistsError.value = 'unavailable'
    }
  } finally {
    if (requestId == accountPlaylistsRequestId) isPlaylistsLoading.value = false
  }
}

const openAccountPlaylist = async(playlist) => {
  // 歌单列表的提供方与“每日推荐”选择可以不同；必须沿用列表请求
  // 的 provider，否则切换推荐平台后点击旧列表会请求错接口。
  const provider = accountPlaylistsProvider.value || selectedDailyProvider.value
  if (playlist?.id == null || playlist.id === '' || !canReadAccountPlaylists(provider)) return
  const requestId = ++playlistDetailRequestId
  selectedAccountPlaylist.value = playlist
  playlistDetailError.value = ''
  selectedAccountPlaylistProvider.value = provider
  playlistDetailList.value = []
  detailKind.value = 'playlist'
  isShowDailyDetail.value = true
  isPlaylistDetailLoading.value = true
  try {
    const result = await getMusicAccountPlaylistDetail(provider, playlist.id)
    if (requestId != playlistDetailRequestId) return
    if (result.status != 'available') {
      playlistDetailError.value = result.status == 'verification_required' ? 'kugou__verification_required' : result.status == 'login_required' ? 'search__account_expired' : 'list__load_failed'
      return
    }
    if (Array.isArray(result?.ids) && result.ids.length) {
      if (provider == 'kg') {
        const { loadKugouHashMusic } = await import('@renderer/views/List/MyList/importPlaylist')
        const list = await loadKugouHashMusic(result.ids, undefined, () => requestId != playlistDetailRequestId)
        if (requestId == playlistDetailRequestId) playlistDetailList.value = list
      } else if (provider == 'wy') {
        const list = await wyMusicDetail.getList(result.ids).then(data => data.list.map(item => toNewMusicInfo(item))).catch(() => [])
        if (requestId == playlistDetailRequestId) playlistDetailList.value = list
      } else {
        const list = []
        for (let index = 0; index < result.ids.length; index += 30) {
          const items = await Promise.all(result.ids.slice(index, index + 30).map(id => txMusicInfo(id).catch(() => null)))
          if (requestId != playlistDetailRequestId) return
          list.push(...items.filter(Boolean).map(item => toNewMusicInfo(item)))
        }
        if (requestId == playlistDetailRequestId) playlistDetailList.value = list
      }
    }
  } catch {
    if (requestId == playlistDetailRequestId) {
      playlistDetailList.value = []
      playlistDetailError.value = 'list__load_failed'
    }
  } finally {
    if (requestId == playlistDetailRequestId) isPlaylistDetailLoading.value = false
  }
}

const isCurrentTrack = item => playMusicInfo.musicInfo?.id == item.id
const playDetailList = async(index) => {
  const list = detailMusicList.value
  if (!list.length) return
  if (list[index] && isCurrentTrack(list[index])) {
    togglePlay()
    return
  }
  const listId = detailKind.value == 'playlist' ? `q_playlist_${selectedAccountPlaylistProvider.value}_${selectedAccountPlaylist.value?.id ?? 'unknown'}` : `q_daily_${new Date().toISOString().slice(0, 10)}`
  if (typeof index == 'number') { await playFromPage(listId, list, index); return }
  await setTempList(listId, [...list])
  playList(LIST_IDS.TEMP, 0)
}

const refreshAccountStatus = async() => {
  const requestId = ++accountStatusRequestId
  isAccountStatusLoading.value = true
  const status = await getMusicAccountStatus().catch(() => createEmptyAccountStatus())
  if (requestId != accountStatusRequestId) return
  accountStatus.value = status
  isAccountStatusLoading.value = false
  if (accountPlaylistsProvider.value && !canReadAccountPlaylists(accountPlaylistsProvider.value)) {
    accountPlaylistsRequestId++
    accountPlaylistsProvider.value = ''
    accountPlaylists.value = []
  }
  const playlistProvider = canReadAccountPlaylists(accountPlaylistsProvider.value)
    ? accountPlaylistsProvider.value
    : [selectedDailyProvider.value, 'tx', 'wy', 'kg'].find(canReadAccountPlaylists)
  if (playlistProvider) void loadAccountPlaylists(false, playlistProvider)
}

const selectDailyProvider = (provider, force = false) => {
  if (!force && selectedDailyProvider.value == provider && dailyRecommendList.value.length) return
  playlistDetailRequestId++
  isShowDailyDetail.value = false
  selectedDailyProvider.value = provider
  window.localStorage.setItem('qmusic.dailyRecommend.provider', provider)
  void loadDailyRecommend(true, provider)
  if (canReadAccountPlaylists(provider)) void loadAccountPlaylists(false, provider)
  else {
    accountPlaylistsRequestId++
    accountPlaylistsProvider.value = ''
    accountPlaylists.value = []
    isPlaylistsLoading.value = false
  }
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
  if (isAccountLoginPending.value || isAccountLogoutPending.value) return
  isShowAccountModal.value = false
}

const handleAccountAvatarError = provider => {
  accountStatus.value.accounts[provider].avatar = ''
}

const connectMusicAccount = async(provider) => {
  if (isAccountLoginPending.value || isAccountLogoutPending.value) return
  isAccountLoginPending.value = true
  accountLoginProvider.value = provider
  accountLoginError.value = ''
  try {
    const result = await loginMusicAccount(provider)
    await refreshAccountStatus()
    if (result.status == 'connected') {
      if (selectedDailyProvider.value == provider) void loadDailyRecommend(true, provider)
      void loadAccountPlaylists(true, provider)
    }
  } catch {
    accountLoginError.value = t('search__account_login_failed')
  } finally {
    isAccountLoginPending.value = false
    accountLoginProvider.value = ''
  }
}

const disconnectMusicAccount = async(provider) => {
  if (isAccountLoginPending.value || isAccountLogoutPending.value) return
  isAccountLogoutPending.value = provider
  try {
    const result = await logoutMusicAccount(provider)
    if (result.status != 'disconnected') return
    playlistDetailRequestId++
    accountPlaylists.value = accountPlaylistsProvider.value == provider ? [] : accountPlaylists.value
    if (accountPlaylistsProvider.value == provider) accountPlaylistsProvider.value = ''
    if (provider == 'tx') await refreshQQDailyKeyStatus()
    await refreshAccountStatus()
    void loadDailyRecommend(true, selectedDailyProvider.value)
  } finally {
    isAccountLogoutPending.value = ''
  }
}

const handleProviderAction = provider => {
  expandedAccountProvider.value = expandedAccountProvider.value == provider ? '' : provider
}
const openAccountImport = provider => {
  importProvider.value = provider
  isShowAccountModal.value = false
  isShowAccountImport.value = true
}
const useAccountRecommendation = provider => {
  selectDailyProvider(provider)
  isShowAccountModal.value = false
}

void refreshAccountStatus().then(() => {
  void loadDailyRecommend(false, selectedDailyProvider.value)
})

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
  > * { flex-shrink: 0; }
  gap: 18px;
  overflow-y: auto;
  padding: 2px 8px 12px;
  box-sizing: border-box;
}
.welcomeBar {
  order: 0;
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
  order: 2;
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
  background: linear-gradient(118deg, var(--color-primary-alpha-800), var(--q-surface-strong) 62%, transparent);
  border: 0;
  box-shadow: 0 12px 34px rgba(35, 54, 46, .1);
  cursor: pointer;
  outline: none;
  transition: transform @transition-fast, box-shadow @transition-fast, border-color @transition-fast;

  &:hover, &:focus-visible {
    transform: translateY(-2px);
    border-color: var(--color-primary-alpha-700);
    box-shadow: inset 0 1px 0 var(--q-border), 0 24px 54px rgba(35, 54, 46, .16);
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
  box-shadow: 0 18px 38px rgba(35, 54, 46, .18), inset 0 0 0 1px var(--q-border);
}
.coverTile {
  min-width: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  background: linear-gradient(145deg, var(--color-primary-alpha-900), var(--q-surface-strong));

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
  background: var(--q-surface-strong);
  box-shadow: 0 10px 28px rgba(35, 54, 46, .2), inset 0 0 0 1px var(--q-border);
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
  order: 3;
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
      &:hover { color: var(--color-primary); background: transparent; }
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
    // 列宽与封面使用同一 rem 尺寸，跟随界面字号一起缩放。
    grid-template-columns: 4.875rem minmax(0, 1fr);
    grid-template-rows: 1fr 1fr;
    column-gap: .75rem;
    align-items: center;
    padding: 8px;
    border-radius: 14px;
    background: var(--q-surface-soft);
    transition: background-color @transition-fast, transform @transition-fast, box-shadow @transition-fast;

    &:hover {
      transform: translateY(-2px);
      background: var(--q-surface-strong);
      box-shadow: 0 12px 26px rgba(35, 54, 46, .1);
    }

    .playlistCover {
      grid-column: 1;
      grid-row: 1 / 3;
      width: 100%;
      height: auto;
    }

    strong { grid-column: 2; min-width: 0; margin-top: auto; align-self: end; font-size: 12.5px; }
    small { grid-column: 2; min-width: 0; margin-bottom: auto; align-self: start; }
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
  background: transparent;
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
  background: var(--q-surface);
  box-shadow: 0 8px 22px rgba(35, 54, 46, .08), inset 0 1px 0 var(--q-border);
  transition: transform @transition-fast, box-shadow @transition-fast, opacity @transition-fast;

  :global(.svg-icon) { width: 17px; height: 17px; }
  b { margin-left: 1px; font-size: 17px; font-weight: 500; opacity: .72; }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 26px rgba(35, 54, 46, .13), inset 0 1px 0 var(--q-border);
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
    border: 2px solid var(--q-border);
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
  background: var(--q-surface);
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
  box-shadow: inset 0 1px 0 var(--q-border), 0 14px 36px rgba(35, 54, 46, .08);
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

    &:hover { background: transparent; }
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
.detailTracks li.currentTrack {
  background: transparent;

  > strong { color: var(--color-primary-dark-100); }
  > button { color: #fff; background: var(--color-primary); }
}
.playingBars {
  height: 14px;
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;

  i {
    width: 3px;
    height: 100%;
    border-radius: 2px;
    background: var(--color-primary);
    transform-origin: bottom;
    animation: q-daily-bars .9s ease-in-out infinite alternate;

    &:nth-child(2) { animation-delay: -.3s; }
    &:nth-child(3) { animation-delay: -.6s; }
  }
}
.playingBarsPaused i {
  animation-play-state: paused;
}
@keyframes q-daily-bars {
  from { transform: scaleY(.3); }
  to { transform: scaleY(1); }
}
.trackDuration { font-variant-numeric: tabular-nums; }
.detailEmpty {
  margin: auto;
  color: var(--color-font-label);
  font-size: 12px;
}
.accountModal {
  width: min(520px, 82vw);
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  scrollbar-gutter: stable;
  padding: 25px;
  box-sizing: border-box;
  color: var(--color-font);
}
.qrHeading {
  display: flex;
  align-items: center;
  gap: 13px;

  > div:last-child { min-width: 0; }

  h2 { margin: 0 0 5px; font-size: 18px; }
  p { margin: 0; color: var(--color-font-label); font-size: 11px; line-height: 1.5; }
}
.qrIcon {
  width: 90px;
  height: 42px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 7px;
  box-sizing: border-box;

  > * {
    overflow: hidden;
    border: 3px solid var(--q-border);
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
}
.providerCard {
  border: 1px solid var(--color-primary-alpha-900);
  border-radius: 17px;
  overflow: hidden;
  background: var(--color-content-background);
}
.providerHeader { position: relative; }
.providerToggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 9px;
  border-radius: 8px;
  background: var(--color-primary-alpha-900);
  color: var(--color-font);
  font-size: 11px;
  white-space: nowrap;
  i {
    width: 6px;
    height: 6px;
    border-right: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    transform: rotate(45deg) translateY(-2px);
    transition: transform .24s ease;
    &.chevronExpanded { transform: rotate(225deg) translate(-2px, -1px); }
  }
}
.providerReveal {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: grid-template-rows .28s cubic-bezier(.2,.8,.2,1), opacity .2s ease;
}
.providerRevealed { grid-template-rows: 1fr; opacity: 1; }
.providerRevealInner { min-height: 0; overflow: hidden; }
.providerFooter { display: flex; justify-content: flex-end; margin-top: 10px; }
@media (prefers-reduced-motion: reduce) {
  .providerReveal, .providerToggle i { transition: none; }
}
.providerDetails {
  padding: 8px 16px 12px;
  > p { margin: 0 0 12px; font-size: 11px; color: var(--color-font-label); line-height: 1.65; }
}
.providerTools {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  button {
    flex: 1;
    min-height: 34px;
    padding: 7px 12px;
    border: 1px solid var(--color-primary-alpha-800);
    border-radius: 10px;
    color: var(--color-font);
    background: transparent;
    font: inherit;
    font-size: 11px;
    cursor: pointer;
    &:hover { background: var(--color-primary-background-hover); }
    &:disabled { opacity: .5; cursor: default; }
    &[aria-pressed="true"] { color: var(--color-primary); font-weight: 650; }
  }
}
.recommendProviders {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  margin: 6px 0 16px;
  > span { margin-right: 5px; color: var(--color-font-label); font-size: 11px; }
  button {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 34px;
    padding: 7px 13px;
    border-radius: 18px;
    border: 1px solid var(--color-primary-alpha-900);
    background: var(--color-primary-background);
    color: var(--color-font-label);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
    transition: background-color @transition-fast, border-color @transition-fast;
    &:hover { background: var(--color-primary-background-hover); }
    &.providerSelected { background: var(--color-primary-alpha-900); border-color: var(--color-primary-alpha-500); color: var(--color-font); }
  }
}
.libraryImportButton {
  border: 0;
  background: transparent;
  color: var(--color-primary);
  font: inherit;
  font-size: 12px;
  padding: 0 0 12px;
  cursor: pointer;
}
.providerAction {
  width: 100%;
  min-height: 82px;
  padding: 15px 16px;
  border: 0;
  border-radius: 0;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  color: var(--color-font);
  background: transparent;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: background-color @transition-fast;

  &:hover:not(:disabled) {
    background: var(--color-primary-background-hover);
  }
  &:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -3px; }
  > div { min-width: 0; }
  strong { font-size: 14px; }
  strong, > div span { display: block; .mixin-ellipsis-1(); }
  > div span { margin-top: 4px; color: var(--color-font-label); font-size: 11px; }
  > div .accountIdentity { color: var(--color-font); font-size: 10px; opacity: .76; }
  em {
    color: var(--color-font-label);
    font-style: normal;
    font-size: 22px;
  }
}
.activeProvider { border-color: var(--color-primary-alpha-600); }
.accountAvatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--color-primary-background);
  box-shadow: 0 5px 14px rgba(35, 54, 46, .12);
}
.logoutButton {
  min-height: 30px;
  padding: 5px 8px;
  border: 0;
  border-radius: 8px;
  color: var(--color-font-label);
  background: transparent;
  font: inherit;
  font-size: 10px;
  cursor: pointer;
  &:hover:not(:disabled) { color: var(--color-font); background: var(--color-primary-background-hover); }
  &:disabled { cursor: wait; opacity: .55; }
}
.officialDailySetup {
  margin-top: 14px;
  padding: 15px;
  border: 1px solid rgba(54, 83, 70, .12);
  border-radius: 15px;
  background: transparent;

  > summary {
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    list-style: none;
    &::-webkit-details-marker { display: none; }
    &::after {
      content: '';
      flex: none;
      width: 6px;
      height: 6px;
      border-right: 1.5px solid currentColor;
      border-bottom: 1.5px solid currentColor;
      transform: rotate(45deg);
    }
    strong { color: var(--color-font); font-size: 12px; flex: 1; }
    span { color: var(--color-font-label); font-size: 10px; }
    .keyConnected { color: var(--color-primary); font-weight: 650; }
  }
  &[open] > summary::after { transform: rotate(225deg); }
  > p { margin: 12px 0 11px; color: var(--color-font-label); font-size: 10px; line-height: 1.55; }
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
    background: var(--q-surface-strong);
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
@keyframes q-search-skeleton {
  from { background-position: 100% 0; }
  to { background-position: -100% 0; }
}

.skeletonBlock() {
  display: block;
  border-radius: 6px;
  background: linear-gradient(100deg, var(--q-surface-soft) 20%, var(--q-surface-strong) 45%, var(--q-surface-soft) 70%);
  background-size: 220% 100%;
  animation: q-search-skeleton 1.4s ease-in-out infinite;
}

.trackPreviewSkeleton {
  li { align-items: center; height: 15px; }
  i {
    .skeletonBlock();
    height: 9px;
    &:first-child { width: 34%; }
    &:last-child { width: 22%; opacity: .7; }
  }
  li:nth-child(2) i:first-child { width: 42%; }
  li:nth-child(3) i:first-child { width: 28%; }
}

.playlistSkeleton > div {
  min-width: 0;

  i {
    .skeletonBlock();
    aspect-ratio: 1;
    border-radius: 10px;
  }
  b {
    .skeletonBlock();
    height: 10px;
    margin-top: 10px;
    width: 76%;
    & + b { width: 44%; height: 8px; margin-top: 7px; opacity: .7; }
  }
}

.detailTracksSkeleton {
  min-height: 0;
  flex: 1;
  margin: 0;
  padding: 7px 8px 12px;
  list-style: none;
  overflow: hidden;

  li {
    display: grid;
    grid-template-columns: 42px minmax(210px, 1.55fr) minmax(130px, .82fr) minmax(160px, 1fr) 58px 42px;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 0 8px;
  }
  i {
    .skeletonBlock();
    height: 10px;
    &:nth-child(1) { width: 20px; }
    &:nth-child(2) { width: 62%; height: 12px; }
    &:nth-child(3) { width: 48%; }
    &:nth-child(4) { width: 54%; }
    &:nth-child(5) { width: 34px; }
  }
  // 越往下越淡，暗示列表仍在延伸
  li:nth-child(n + 5) { opacity: .7; }
  li:nth-child(n + 7) { opacity: .4; }
}

.fadeImg {
  opacity: 0;
  transition: opacity .38s ease;

  &:global(.q-cover-loaded) { opacity: 1; }
}

.panelEnterActive {
  transition: opacity .24s ease, transform .34s cubic-bezier(.22, 1, .36, 1);
}
.panelLeaveActive {
  transition: opacity .14s ease;
}
.panelFromRight {
  opacity: 0;
  transform: translateX(18px);
}
.panelFromLeft {
  opacity: 0;
  transform: translateX(-18px);
}
.panelFade {
  opacity: 0;
}

@media (max-width: 900px) {
  .noitem {
    padding-left: 28px;
    padding-right: 28px;
  }
  .detailHeader { flex-wrap: wrap; }
  .detailActions { width: 100%; padding-left: 54px; }
  .detailTableHeader, .detailTracks li {
    grid-template-columns: 38px minmax(160px, 1.4fr) minmax(110px, .8fr) 54px 40px;

    > :nth-child(4) { display: none; }
  }
  .detailTracksSkeleton li {
    grid-template-columns: 38px minmax(160px, 1.4fr) minmax(110px, .8fr) 54px 40px;

    > :nth-child(4) { display: none; }
  }
  .playlistRail { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .discoveryGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .playlistSkeleton > div:nth-child(n + 4) { display: none; }
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
