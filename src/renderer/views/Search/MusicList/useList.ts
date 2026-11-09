import { computed, ref } from '@common/utils/vueTools'
import { sortSearchQuality, type SearchSort } from '@common/utils/searchQuality'
import { searchText } from '@renderer/store/search/state'
import { playFromPage } from '@renderer/core/player/selection'
import { addHistoryWord } from '@renderer/store/search/action'
// import { useI18n } from '@renderer/plugins/i18n'
// import { } from '@renderer/store/search/state'
import { search as searchMusic, listInfos, getAggregateSources, selectAggregateSource, type ListInfo } from '@renderer/store/search/music'

export type SearchSource = LX.OnlineSource | 'all'

export default () => {
  const listRef = ref<any>(null)

  const listInfo = ref<ListInfo>({
    page: 1,
    maxPage: 0,
    limit: 30,
    total: 0,
    list: [],
    key: null,
    noItemLabel: '',
  })

  const search = (text: string, source: SearchSource, page: number) => {
    listInfo.value = listInfos[source] as ListInfo
    if (text.length) void addHistoryWord(text)
    void searchMusic(text, page, source).then((list: LX.Music.MusicInfo[]) => {
      if (list.length) {
        setTimeout(() => {
          if (listRef.value) listRef.value.scrollToTop()
        })
      }
    }).catch(() => {})
  }

  const sortMode = ref<SearchSort>('relevance')
  const displayList = computed(() => sortSearchQuality(listInfo.value.list, searchText.value, sortMode.value))
  const handlePlayList = async(index: number) => {
    let targetSong = displayList.value[index]

    if (!targetSong) return
    await playFromPage(`search_${listInfo.value.key ?? ''}_${listInfo.value.page}`, displayList.value, index)
  }

  const getSourceOptions = (musicInfo: LX.Music.MusicInfo) => {
    return [...new Set(getAggregateSources(musicInfo).map(item => item.source))]
  }

  const getSourceName = (source: LX.OnlineSource) => window.i18n.t(`source_${source}` as any)

  const handleSourceChange = ({ index, source }: { index: number, source: LX.OnlineSource }) => {
    selectAggregateSource(listInfo.value.list.indexOf(displayList.value[index]), source)
  }

  return {
    listRef,
    sortMode,
    displayList,
    listInfo,
    search,
    handlePlayList,
    getSourceOptions,
    getSourceName,
    handleSourceChange,
  }
}
