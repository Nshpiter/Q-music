<template>
  <div :class="$style.container">
    <div :class="$style.songListHeader">
      <button type="button" :class="$style.backButton" :aria-label="$t('back')" :title="$t('back')" @click="handleBack">
        <svg-icon name="angle-right-solid" />
      </button>
      <div :class="$style.songListHeaderLeft">
        <img v-if="picUrl || listDetailInfo.info.img" :key="picUrl || listDetailInfo.info.img" :class="$style.coverImg" :src="picUrl || listDetailInfo.info.img" alt="" decoding="async">
        <empty-cover-mark v-else :class="$style.coverPlaceholder" />
        <span v-if="listDetailInfo.info.play_count" :class="$style.playNum">{{ listDetailInfo.info.play_count }}</span>
      </div>
      <div :class="$style.songListHeaderMiddle">
        <h3 :title="listDetailInfo.info.name">{{ listDetailInfo.info.name }}</h3>
        <p v-if="listDetailInfo.info.desc" :title="listDetailInfo.info.desc">{{ listDetailInfo.info.desc }}</p>
        <div :class="$style.songListHeaderRight">
          <base-btn
            :class="[$style.headerRightBtn, $style.primaryPlayBtn]"
            :disabled="!listDetailInfo.list.length || !!listDetailInfo.noItemLabel"
            @click="playSongListDetail(listDetailInfo.id, listDetailInfo.source, listDetailInfo.list)"
          >
            <svg-icon name="play-outline" />{{ $t('list__play') }}
          </base-btn>
          <base-btn
            :class="$style.headerRightBtn"
            :disabled="!listDetailInfo.list.length || !!listDetailInfo.noItemLabel"
            @click="addSongListDetail(listDetailInfo.id, listDetailInfo.source, listDetailInfo.info.name)"
          >
            {{ $t('list__collect') }}
          </base-btn>
          <base-btn :class="$style.headerRightBtn" outline :disabled="listDetailInfo.noItemLabel == $t('list__loading')" @click="getListData(source, id, listDetailInfo.page, true)">{{ $t('playlist_import_modal__refresh') }}</base-btn>
        </div>
      </div>
    </div>
    <div :class="$style.list">
      <material-online-list
        ref="listRef"
        :page="listDetailInfo.page"
        :limit="listDetailInfo.limit"
        :total="listDetailInfo.total"
        :list="listDetailInfo.list"
        :no-item="listDetailInfo.noItemLabel"
        source-tag
        @play-list="handlePlayList"
        @toggle-page="togglePage"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { ref, watch } from '@common/utils/vueTools'
import { listDetailInfo } from '@renderer/store/songList/state'
import { setVisibleListDetail } from '@renderer/store/songList/action'
import { useRoute, useRouter } from '@common/utils/vueRouter'
import { addSongListDetail, playSongListDetail } from './action'
import EmptyCoverMark from '@renderer/components/common/EmptyCoverMark.vue'
import useList from './useList'
import useKeyBack from './useKeyBack'


const source = ref<LX.OnlineSource>('kw')
const id = ref<string>('')
const page = ref<number>(1)
const picUrl = ref<string>('')
const refresh = ref<boolean>(false)

const normalizePage = (value: unknown): number => {
  const text = typeof value == 'number' ? String(value) : typeof value == 'string' ? value : ''
  if (!/^\d+$/.test(text)) return 1
  const normalized = Number(text)
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : 1
}


interface Query {
  source?: string
  id?: string
  page?: string
  picUrl?: string
  refresh?: 'true'
  fromName?: string
}

const verifyQueryParams = async function(this: any, to: { query: Query, path: string }, from: any, next: (route?: { path: string, query: Query }) => void) {
  let _source = to.query.source
  let _id = to.query.id
  let _page: string | undefined = to.query.page
  let _picUrl: string | undefined = to.query.picUrl
  let _refresh: 'true' | undefined = to.query.refresh

  if (_source == null || _id == null) {
    if (listDetailInfo.key) {
      _source = listDetailInfo.source
      _id = listDetailInfo.id
      _page = listDetailInfo.page.toString()
      _picUrl = listDetailInfo.info.img
    } else {
      setVisibleListDetail(false)
      next({ path: '/songList/list', query: {} })
      return
    }

    next({
      path: to.path,
      query: { ...to.query, source: _source, id: _id, page: _page, picUrl: _picUrl, refresh: _refresh },
    })
    return
  }
  const normalizedPage = normalizePage(_page)
  if (_page != null && _page != String(normalizedPage)) {
    next({ path: to.path, query: { ...to.query, page: String(normalizedPage) } })
    return
  }
  next()
  setVisibleListDetail(true)
  source.value = _source as LX.OnlineSource
  id.value = _id
  page.value = normalizedPage
  picUrl.value = _picUrl ?? ''
  refresh.value = _refresh ? _refresh == 'true' : false
  if (to.query.fromName) window.lx.songListInfo.fromName = to.query.fromName
}


export default {
  components: {
    EmptyCoverMark,
  },
  beforeRouteEnter: verifyQueryParams,
  beforeRouteUpdate: verifyQueryParams,
  setup() {
    const router = useRouter()
    const route = useRoute()

    const {
      listRef,
      listDetailInfo,
      getListData,
      handlePlayList,
    } = useList()


    const togglePage = (nextPage: number) => {
      void router.replace({ path: route.path, query: { ...route.query, page: String(nextPage) } })
    }

    const handleBack = () => {
      setVisibleListDetail(false)
      if (window.lx.songListInfo.fromName) void router.replace({ name: window.lx.songListInfo.fromName })
      else router.back()
    }

    useKeyBack(handleBack)

    watch([source, id, page, refresh], async([_source, _id, _page, _refresh]) => {
      if (!_source || !_id) return router.replace({ path: '/songList/list' })
      // console.log(_source, _id, _page, _refresh, picUrl.value)
      // source.value = _source
      // id.value = _id
      // refresh.value = _refresh
      // page.value = _page ?? 1
      void getListData(_source, _id, _page, _refresh)
    }, {
      immediate: true,
    })

    return {
      source,
      id,
      page,
      picUrl,
      listDetailInfo,
      listRef,
      getListData,
      togglePage,
      addSongListDetail,
      playSongListDetail,
      handlePlayList,
      handleBack,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  display: flex;
  flex-flow: column nowrap;
  gap: 12px;
  --online-list-end-inset: 18px;
  padding: 14px 0 calc(@height-player + 16px) var(--online-list-end-inset);
  container-type: inline-size;
}

.songListHeader {
  margin-right: var(--online-list-end-inset);
  flex: none;
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 14px;
  min-height: 112px;
  padding: 16px 18px;
  box-sizing: border-box;
  border-radius: 20px;
  background: rgb(from var(--color-main-background) r g b / .58);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .68), 0 14px 32px rgba(72, 91, 112, .07);
  backdrop-filter: blur(calc(var(--q-glass-blur, 20px) * .8)) saturate(1.1);
}
.backButton {
  flex: none;
  align-self: flex-start;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 11px;
  color: var(--color-font);
  background: var(--q-surface);
  box-shadow: inset 0 0 0 1px var(--q-border);
  cursor: pointer;
  transition: background-color @transition-fast, color @transition-fast, transform @transition-fast, box-shadow @transition-fast;
  &:hover {
    color: var(--color-primary-dark-200);
    background: var(--q-surface-strong);
    box-shadow: inset 0 0 0 1px var(--color-primary-alpha-800);
    svg { transform: rotate(180deg) translateX(1.5px); }
  }
  &:active { transform: scale(.94); }
  &:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  svg { width: 13px; height: 13px; transform: rotate(180deg); transition: transform @transition-fast; }
}
.songListHeaderLeft {
  flex: none;
  width: 82px;
  height: 82px;
  aspect-ratio: 1 / 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 15px;
  background: var(--color-primary-alpha-900);
  box-shadow: 0 10px 24px rgba(35, 54, 46, .14), inset 0 0 0 1px var(--q-border);
}
.coverImg {
  width: 100%;
  height: 100%;
  object-fit: cover;
  animation: q-detail-cover-in .38s cubic-bezier(.22, 1, .36, 1);
}
.coverPlaceholder {
  width: 34px;
  height: 34px;
  color: var(--color-font-label);
}
@keyframes q-detail-cover-in {
  from { opacity: 0; transform: scale(.93); }
  to { opacity: 1; transform: scale(1); }
}
.playNum {
  position: absolute;
  bottom: 5px;
  right: 5px;
  max-width: calc(100% - 10px);
  padding: 2px 6px;
  border-radius: 999px;
  background-color: rgba(20, 26, 24, .58);
  backdrop-filter: blur(6px);
  color: #fff;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  .mixin-ellipsis-1();
}

.songListHeaderMiddle {
  flex: auto;
  min-width: 0;
  h3 {
    .mixin-ellipsis-1();
    line-height: 1.25;
    padding-bottom: 5px;
    font-size: 18px;
    font-weight: 680;
    color: var(--color-font);
  }
  p {
    .mixin-ellipsis(2);
    font-size: 12px;
    line-height: 1.45;
    color: var(--color-font-label);
  }
}
.songListHeaderRight {
  flex: none;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;

  .headerRightBtn {
    min-height: 30px;
    border-radius: 10px;
    padding: 5px 13px;
    font-size: 12px;
    svg { width: 13px; height: 13px; }
  }
  .primaryPlayBtn:not([disabled]) {
    color: #fff;
    background: var(--color-primary);
    box-shadow: 0 6px 16px var(--color-primary-alpha-700);
    &:hover {
      color: #fff;
      background: var(--color-primary-dark-100);
    }
  }
}

.list {
  position: relative;
  width: 100%;
  min-height: 0;
  flex: auto;
  height: 100%;
  overflow: hidden;
  border-radius: 20px;
  background: rgb(from var(--color-main-background) r g b / .54);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .68), 0 16px 38px rgba(72, 91, 112, .08);
  backdrop-filter: blur(calc(var(--q-glass-blur, 20px) * .8)) saturate(1.1);
}

@container (max-width: 520px) {
  .songListHeader { gap: 10px; padding: 12px; }
  .songListHeaderLeft { width: 64px; height: 64px; }
}
@media (prefers-reduced-motion: reduce) {
  .backButton, .backButton svg, .coverImg { transition: none; animation: none; }
}
</style>

