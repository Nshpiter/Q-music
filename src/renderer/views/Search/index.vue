<template>
  <div :class="$style.container">
    <div v-if="searchText" :class="$style.header">
      <base-tab v-model="searchType" :list="searchTypes" @change="handleTypeChange" />
    </div>
    <div :class="$style.main">
      <song-list-list v-show="searchText && searchType == 'songlist'" :page="page" :source-id="source" />
      <music-list v-show="searchText && searchType == 'music'" :page="page" :source-id="source" />
      <blank-view :visible="!searchText" :source="source" />
    </div>
  </div>
</template>

<script>
import { useRoute, useRouter } from '@common/utils/vueRouter'
import { DEFAULT_SETTING } from '@common/constants'
import { searchText } from '@renderer/store/search/state'
import { getSearchSetting, setSearchSetting } from '@renderer/utils/data'

import MusicList from './MusicList/index.vue'
import SongListList from './SongListList/index.vue'
import BlankView from './components/BlankView.vue'
import { computed, ref } from '@common/utils/vueTools'

const source = ref('all')
const searchType = ref(null)
const page = ref(1)

const verifyQueryParams = async(to, from, next) => {
  const _source = 'all'
  let _type = to.query.type
  let _page = to.query.page

  if (to.query.source != _source || _type == null) {
    const setting = await getSearchSetting().catch(() => ({ ...DEFAULT_SETTING.search }))
    _type ??= setting.type

    next({
      path: to.path,
      query: { ...to.query, source: _source, type: _type, page: _page },
    })
    return
  }
  source.value = _source
  searchType.value = _type

  if (_page) page.value = parseInt(_page)

  searchText.value = to.query.text ?? ''
  if (to.query.text != null) {
    if (!_page) page.value = 1
  }
  next()
  void setSearchSetting({ source: _source, type: _type })
}

export default {
  components: {
    MusicList,
    SongListList,
    BlankView,
  },
  beforeRouteEnter: verifyQueryParams,
  beforeRouteUpdate: verifyQueryParams,
  setup() {
    const route = useRoute()
    const router = useRouter()

    const searchTypes = computed(() => {
      return [
        { label: window.i18n.t('search__type_music'), id: 'music' },
        { label: window.i18n.t('search__type_songlist'), id: 'songlist' },
      ]
    })
    const handleTypeChange = (type) => {
      searchType.value = type
      void router.replace({
        path: route.path,
        query: {
          ...route.query,
          type,
          page: 1,
        },
      })
    }


    return {
      source,
      searchTypes,
      searchType,
      handleTypeChange,
      page,
      searchText,
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
  justify-content: flex-end;
}

.main {
  position: relative;
  flex: auto;
  min-height: 0;
  overflow: hidden;
}
</style>
