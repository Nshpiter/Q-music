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
          <button type="button" :class="[$style.syncAction, { [$style.connected]: isCloudConnected }]" @click="handleCloudAction">
            <svg-icon name="phone" />
            <span>{{ syncActionText }}</span>
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
              <span :class="$style.eyebrow">{{ $t('search__daily_eyebrow') }}</span>
              <h3>{{ $t('search__daily_recommend') }} · {{ $t('search__daily_count', { count: dailyRecommendList.length || 12 }) }}</h3>
              <p>{{ $t('search__daily_recommend_subtitle') }}</p>
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
          </div>
          <div :class="$style.detailActions">
            <base-btn min :disabled="!dailyRecommendList.length" @click="playDailyRecommend()">{{ $t('search__daily_recommend_play') }}</base-btn>
            <base-btn min :disabled="isDailyLoading" @click="loadDailyRecommend(true)">{{ $t('search__daily_recommend_refresh') }}</base-btn>
          </div>
        </header>
        <div :class="$style.detailList">
          <material-online-list
            :page="1" :limit="dailyRecommendList.length || 12" :total="dailyRecommendList.length"
            :list="dailyRecommendList" :no-item="dailyDetailEmptyText" check-api-source
            @play-list="playDailyRecommend"
          />
        </div>
      </div>
    </div>
  </transition>
  <material-modal :show="isShowSyncQr" :bg-close="false" @close="closeSyncQr">
    <main :class="$style.qrModal">
      <div :class="$style.qrHeading">
        <div :class="$style.qrIcon"><svg-icon name="phone" /></div>
        <div>
          <h2>{{ $t('search__sync_qr_title') }}</h2>
          <p>{{ $t('search__sync_qr_desc') }}</p>
        </div>
      </div>
      <div :class="$style.qrStage">
        <img v-if="syncQrImage" :src="syncQrImage" :alt="$t('search__sync_qr_title')">
        <div v-else :class="$style.qrLoading">{{ syncQrStatusText }}</div>
      </div>
      <p :class="$style.qrTip">{{ $t('search__sync_qr_tip') }}</p>
      <p v-if="syncQrHost" :class="$style.qrAddress">{{ syncQrHost }}</p>
      <div :class="$style.loginFooter">
        <base-btn min @click="openSyncSettings">{{ $t('search__cloud_manage') }}</base-btn>
        <base-btn min :disabled="!sync.server.status.status" @click="refreshSyncCode">{{ $t('setting__sync_server_refresh_code') }}</base-btn>
        <base-btn min @click="closeSyncQr">{{ $t('btn_close') }}</base-btn>
      </div>
    </main>
  </material-modal>
</template>

<script setup>
import { computed, watch, shallowRef, ref } from '@common/utils/vueTools'
import { historyList } from '@renderer/store/search/state'
import { getHistoryList, removeHistoryWord, clearHistoryList } from '@renderer/store/search/action'
import { clearList, getList } from '@renderer/store/hotSearch'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { useRouter } from '@common/utils/vueRouter'
import { getDailyRecommend } from '@renderer/core/dailyRecommend'
import { setTempList } from '@renderer/store/list/action'
import { playList } from '@renderer/core/player/action'
import { getPicPath } from '@renderer/core/music'
import { LIST_IDS } from '@common/constants'
import { sync } from '@renderer/store'
import { sendSyncAction } from '@renderer/utils/ipc'
import QRCode from 'qrcode'

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
const isShowSyncQr = ref(false)
const syncQrImage = ref('')
let hotSearchRequestId = 0
let dailyRequestId = 0
let qrRequestId = 0
const now = new Date()
const todayDay = String(now.getDate()).padStart(2, '0')
const todayMonth = new Intl.DateTimeFormat(window.i18n.locale || 'zh-CN', { month: 'short' }).format(now)
const todayLabel = new Intl.DateTimeFormat(window.i18n.locale || 'zh-CN', { month: 'long', day: 'numeric' }).format(now)
const isCloudConnected = computed(() => sync.enable && (
  (sync.mode == 'server' && sync.server.status.devices.length > 0) ||
  (sync.mode == 'client' && sync.client.status.status)
))
const syncActionText = computed(() => {
  if (sync.mode == 'server' && sync.server.status.devices.length) {
    return window.i18n.t('search__sync_connected_devices', { count: sync.server.status.devices.length })
  }
  if (sync.mode == 'client' && sync.client.status.status) return window.i18n.t('search__cloud_connected')
  return window.i18n.t('search__sync_scan')
})
const syncQrHost = computed(() => {
  const addresses = sync.server.status.address
  const address = addresses.find(ip => /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(ip)) ?? addresses[0]
  if (!address) return ''
  return `http://${address}:${appSetting['sync.server.port']}`
})
const syncQrPayload = computed(() => {
  if (!syncQrHost.value || !sync.server.status.code) return ''
  const data = encodeURIComponent(JSON.stringify({
    host: syncQrHost.value,
    authCode: sync.server.status.code,
  }))
  return `qmusic://sync/connect?data=${data}`
})
const syncQrStatusText = computed(() => sync.server.status.message || window.i18n.t('search__sync_qr_preparing'))
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

const loadDailyRecommend = async(force = false) => {
  if (!props.visible) return
  const requestId = ++dailyRequestId
  isDailyLoading.value = true
  try {
    const list = await getDailyRecommend(props.source, force)
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

watch(syncQrPayload, async(payload) => {
  const requestId = ++qrRequestId
  syncQrImage.value = ''
  if (!payload) return
  try {
    const image = await QRCode.toDataURL(payload, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#242726', light: '#ffffff' },
    })
    if (requestId == qrRequestId) syncQrImage.value = image
  } catch {
    if (requestId == qrRequestId) syncQrImage.value = ''
  }
}, { immediate: true })

const prepareSyncServer = async() => {
  if (sync.mode == 'client' && sync.enable) {
    await sendSyncAction({ action: 'enable_client', data: { enable: false, host: sync.client.host } })
  }
  sync.enable = true
  sync.mode = 'server'
  sync.server.port = appSetting['sync.server.port']
  updateSetting({
    'sync.enable': true,
    'sync.mode': 'server',
  })
  if (!sync.server.status.status) {
    await sendSyncAction({
      action: 'enable_server',
      data: { enable: true, port: appSetting['sync.server.port'] },
    })
  }
}

const handleCloudAction = () => {
  if (isCloudConnected.value) {
    openSyncSettings()
    return
  }
  isShowSyncQr.value = true
  void prepareSyncServer()
}

const closeSyncQr = () => {
  isShowSyncQr.value = false
}

const refreshSyncCode = () => {
  syncQrImage.value = ''
  void sendSyncAction({ action: 'generate_code' })
}

const openSyncSettings = () => {
  closeSyncQr()
  void router.push({ name: 'Setting', query: { name: 'SettingSync' } })
}

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
.detailActions {
  display: flex;
  gap: 9px;
}
.detailList {
  min-height: 0;
  flex: 1;
  overflow: hidden;
  border: 1px solid rgba(54, 83, 70, .11);
  border-radius: 22px;
  background: rgb(from var(--color-main-background) r g b / .46);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .68), 0 14px 36px rgba(35, 54, 46, .08);
  backdrop-filter: blur(18px) saturate(1.12);
}
.qrModal {
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
.qrStage {
  width: 250px;
  height: 250px;
  margin: 22px auto 13px;
  padding: 5px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 22px;
  background: #fff;
  box-shadow: 0 16px 38px rgba(35, 54, 46, .14);

  img { width: 240px; height: 240px; border-radius: 17px; }
}
.qrLoading {
  width: 180px;
  color: #777;
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
}
.qrTip, .qrAddress {
  margin: 0;
  text-align: center;
  font-size: 11px;
  line-height: 1.6;
}
.qrTip { color: var(--color-font-label); }
.qrAddress {
  margin-top: 4px;
  color: var(--color-primary-dark-100);
  word-break: break-all;
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
