import type { TagInfo, ListDetailInfo, ListInfo, Source } from './state'
import state from './state'

export default {
  setTags(tagInfo: TagInfo, source: LX.OnlineSource) {
    state.tags[source] = tagInfo
  },
  setListInfo(source: Source, tagId: string, sortId: string) {
    state.listInfo.source = source
    state.listInfo.tagId = tagId
    state.listInfo.sortId = sortId
  },
  setList(result: ListInfo, tagId: string, sortId: string, page: number) {
    const list = page == 1 ? [] : [...state.listInfo.list]
    const seen = new Set(list.map(item => `${item.source}:${item.id}`))
    let added = 0
    for (const item of result.list) {
      const key = `${item.source}:${item.id}`
      if (seen.has(key)) continue
      seen.add(key)
      list.push(item)
      added++
    }
    // 平台末页可能重复返回旧数据；不再追加重复 key，也不继续请求同一批歌单。
    const ended = !result.list.length || (page > 1 && !added)
    state.listInfo.list = list
    state.listInfo.total = ended ? list.length : Math.max(list.length, Number(result.total) || 0)
    state.listInfo.limit = result.limit
    state.listInfo.page = page
    state.listInfo.source = result.source
    state.listInfo.tagId = tagId
    state.listInfo.sortId = sortId
    state.listInfo.maxPage = ended ? page : Math.max(1, Math.ceil(state.listInfo.total / result.limit))

    return state.listInfo
  },
  clearList() {
    state.listInfo.list = []
    state.listInfo.total = 0
    state.listInfo.page = 1
    state.listInfo.key = ''
    state.listInfo.maxPage = 1
  },
  setListDetailInfo(source: Source, id: string) {
    state.listDetailInfo.source = source
    state.listDetailInfo.id = id
  },
  setListDetail(result: ListDetailInfo, id: string, page: number) {
    state.listDetailInfo.list = page == 1 ? [...result.list] : [...state.listDetailInfo.list, ...result.list]
    state.listDetailInfo.id = id
    state.listDetailInfo.source = result.source
    if (page == 1 || (result.total && result.list.length)) state.listDetailInfo.total = result.total
    else state.listDetailInfo.total = result.limit * page
    state.listDetailInfo.limit = result.limit
    state.listDetailInfo.page = page
    state.listDetailInfo.info = { ...result.info }
    state.listDetailInfo.maxPage = Math.ceil(state.listDetailInfo.total / result.limit)

    return state.listDetailInfo
  },
  clearListDetail() {
    state.listDetailInfo.list = []
    state.listDetailInfo.id = ''
    state.listDetailInfo.source = 'kw'
    state.listDetailInfo.total = 0
    state.listDetailInfo.limit = 30
    state.listDetailInfo.page = 1
    state.listDetailInfo.key = null
    state.listDetailInfo.info = {}
    state.listDetailInfo.maxPage = 1
  },
}
