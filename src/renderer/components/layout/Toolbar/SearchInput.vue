<template>
  <div :class="[$style.searchSlot, { [$style.focused]: isFocused }]">
    <material-search-input v-model="searchText" :placeholder="$t('search')" :list="tipList" :visible-list="visibleList" @event="handleEvent" />
  </div>
</template>

<script>
import music from '@renderer/utils/musicSdk'
import { debounce } from '@common/utils'
import { DEFAULT_SETTING } from '@common/constants'
import {
  ref,
  watch,
  nextTick,
} from '@common/utils/vueTools'
import { useRouter, useRoute } from '@common/utils/vueRouter'
import { appSetting } from '@renderer/store/setting'
import { searchText as _searchText } from '@renderer/store/search/state'
import { setSearchText } from '@renderer/store/search/action'
import { getSearchSetting } from '@renderer/utils/data'

export default {
  setup() {
    const searchText = ref('')
    const visibleList = ref(false)
    const tipList = ref([])
    const isFocused = ref(false)

    const route = useRoute()
    const router = useRouter()

    watch(() => route.name, (newValue, oldValue) => {
      if (oldValue == 'Search' && newValue != 'SongListDetail') {
        setTimeout(() => {
          if (appSetting['odc.isAutoClearSearchInput'] && searchText.value) searchText.value = ''
          if (appSetting['odc.isAutoClearSearchList']) setSearchText('')
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
      if (!visibleList.value && isFocused.value) visibleList.value = true
      tipSearch()
    }

    const handleSearch = () => {
      visibleList.value &&= false
      if (!searchText.value && route.path != '/search') {
        setSearchText('')
        return
      }
      setTimeout(() => {
        router.push({
          path: '/search',
          query: {
            text: searchText.value,
          },
        }).catch(_ => _)
      }, searchText.value ? 200 : 0)
    }

    const handleEvent = ({ action, data }) => {
      switch (action) {
        case 'focus':
          isFocused.value = true
          visibleList.value ||= true
          if (searchText.value) handleTipSearch()
          break
        case 'blur':
          isFocused.value = false
          setTimeout(() => {
            visibleList.value &&= false
          }, 50)
          break
        case 'submit':
          handleSearch()
          break
        case 'listClick':
          searchText.value = tipList.value[data]
          void nextTick(handleSearch)
      }
    }

    return {
      searchText,
      visibleList,
      tipList,
      handleEvent,
      isFocused,
    }
  },
}

</script>

<style lang="less" module>
.searchSlot {
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
}

@media (max-width: 940px) {
  .searchSlot,
  .searchSlot.focused {
    width: min(430px, 52vw);
    min-width: 240px;
  }
}
</style>
