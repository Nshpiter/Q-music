import hotSearchState, { type Source } from '@/store/hotSearch/state'
import hotSearchActions from '@/store/hotSearch/action'
import musicSdk from '@/utils/musicSdk'

// 聚合热搜对每个平台单独限时，慢平台不能拖住其他平台的结果。
const loadSource = async(source: LX.OnlineSource) => {
  const cached = hotSearchState.sourceList[source]
  if (cached?.length) return { source, list: cached }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const list = await Promise.race([
      musicSdk[source]?.hotSearch?.getList().then((data: { list: string[] }) => data.list) ?? Promise.resolve([]),
      new Promise<string[]>(resolve => { timer = setTimeout(() => { resolve([]) }, 8000) }),
    ])
    return { source, list }
  } catch {
    return { source, list: [] }
  } finally {
    if (timer) clearTimeout(timer)
  }
}
export const getList = async(source: Source): Promise<string[]> => {
  if (source == 'all') {
    const sources = hotSearchState.sources.filter((item): item is LX.OnlineSource => item != 'all')
    return hotSearchActions.setList(source, await Promise.all(sources.map(loadSource)))
  }
  return hotSearchActions.setList(source, (await loadSource(source)).list)
}
