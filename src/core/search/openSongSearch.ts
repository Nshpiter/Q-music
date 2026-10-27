import { popToRoot } from '@/navigation'
import { setNavActiveId } from '@/core/common'
import commonState from '@/store/common/state'
import { buildSongSearchRequest, requestSearch } from './navigation'

export const openSongSearch = async(...args: Parameters<typeof buildSongSearchRequest>) => {
  const request = buildSongSearchRequest(...args)
  if (!request.keyword) return
  const playerId = commonState.componentIds.playDetail
  // 先收起播放详情及其下面的详情页，再交给主页搜索；不改变播放队列。
  if (playerId) await popToRoot(playerId)
  requestSearch(request)
  setNavActiveId('nav_search')
}
