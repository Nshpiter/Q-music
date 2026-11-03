<template>
  <div ref="pageRef" :class="$style.container">
    <div v-if="!isSearchEmpty" :class="$style.header">
      <base-tab v-if="searchText" v-model="searchType" :list="searchTypes" @change="handleTypeChange" />
    </div>
    <div :class="$style.main">
      <blank-view v-if="isSearchEmpty" :visible="true" :source="source" />
      <song-list-list v-else-if="searchType == 'songlist'" :page="page" :source-id="source" />
      <album-list v-else-if="searchType == 'album'" :page="page" :source="source" :text="searchText" />
      <music-list v-else :page="page" :source-id="source" />
    </div>
  </div>
</template>

<script>
import { useRoute, useRouter, onBeforeRouteLeave } from '@common/utils/vueRouter'
import { DEFAULT_SETTING } from '@common/constants'
import { searchText } from '@renderer/store/search/state'
import { getSearchSetting, setSearchSetting } from '@renderer/utils/data'

import MusicList from './MusicList/index.vue'
import SongListList from './SongListList/index.vue'
import BlankView from './components/BlankView.vue'
import AlbumList from './AlbumList.vue'
import { computed, ref, nextTick } from '@common/utils/vueTools'
import { onActivated } from 'vue'
import music from '@renderer/utils/musicSdk'

const source = ref('all')
const searchType = ref(null)
const page = ref(1)

const normalizePage = value => {
  const text = typeof value == 'number' ? String(value) : typeof value == 'string' ? value : ''
  if (!/^\d+$/.test(text)) return 1
  const normalized = Number(text)
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : 1
}

const normalizePageQuery = value => String(normalizePage(value))

const verifyQueryParams = async(to, from, next) => {
  const validSources = new Set(['all', ...music.sources.map(item => item.id)])
  const setting = await getSearchSetting().catch(() => ({ ...DEFAULT_SETTING.search }))
  // 返回主页没有 source 参数时恢复搜索偏好，不能用聚合搜索覆盖用户选择。
  const _source = validSources.has(to.query.source)
    ? to.query.source
    : validSources.has(setting.source) ? setting.source : 'all'
  let _type = to.query.type
  let _page = to.query.page
  const pageNeedsNormalization = _page != null && _page != normalizePageQuery(_page)

  if (to.query.source != _source || _type == null || pageNeedsNormalization || (_source == 'bi' && _type != 'music')) {
    _type = _source == 'bi' ? 'music' : _type ?? setting.type

    next({
      path: to.path,
      query: { ...to.query, source: _source, type: _type, page: pageNeedsNormalization ? normalizePageQuery(_page) : _page },
    })
    return
  }
  source.value = _source
  searchType.value = _type

  page.value = normalizePage(_page)

  searchText.value = to.query.text ?? ''
  if (to.query.text != null) {
    if (!_page) page.value = 1
  }
  next()
  void setSearchSetting({ source: _source, type: _type })
}

export default {
  name: 'Search',
  components: {
    MusicList,
    SongListList,
    BlankView,
    AlbumList,
  },
  beforeRouteEnter: verifyQueryParams,
  beforeRouteUpdate: verifyQueryParams,
  setup() {
    const route = useRoute()
    const router = useRouter()
    const pageRef = ref(null)
    let savedLocation = ''
    let scrollPositions = []
    onBeforeRouteLeave(() => {
      savedLocation = route.fullPath
      scrollPositions = Array.from(pageRef.value?.querySelectorAll('.scroll') ?? [], element => ({ element, top: element.scrollTop, left: element.scrollLeft }))
    })
    onActivated(() => {
      void nextTick(() => {
        if (savedLocation != route.fullPath) return
        for (const { element, top, left } of scrollPositions) {
          if (!pageRef.value?.contains(element)) continue
          element.scrollTop = top
          element.scrollLeft = left
        }
      })
    })
    const isSearchEmpty = computed(() => typeof searchText.value != 'string' || !searchText.value.trim())

    const searchTypes = computed(() => {
      if (source.value == 'bi') return [{ label: window.i18n.t('search__type_music'), id: 'music' }]
      return [
        { label: window.i18n.t('search__type_music'), id: 'music' },
        { label: window.i18n.t('search__type_songlist'), id: 'songlist' },
        { label: window.i18n.t('search__type_album'), id: 'album' },
      ]
    })
    const handleTypeChange = (type) => {
      searchType.value = type
      void router.replace({
        path: route.path,
        query: {
          ...route.query,
          type,
          albumId: undefined,
          albumSource: undefined,
          albumName: undefined,
          albumSinger: undefined,
          albumPic: undefined,
          page: 1,
        },
      })
    }


    return {
      pageRef,
      source,
      searchTypes,
      searchType,
      handleTypeChange,
      page,
      searchText,
      isSearchEmpty,
    }
  },
}


</script>

<style lang="less" module>
.container {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-flow: column nowrap;
}

.header {
  flex: none;
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  justify-content: space-between;
  min-height: 42px;
  padding: 0 22px;
  gap: 16px;
}

.main {
  position: relative;
  flex: auto;
  min-height: 0;
  overflow: hidden;
}
</style>
