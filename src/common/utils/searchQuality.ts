export type SearchSort = 'relevance' | 'quality'
interface Track { name: string, singer: string, meta: object }
const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')
const relevance = (track: Track, query: string) => {
  const name = normalize(track.name)
  const singer = normalize(track.singer)
  const version = /翻唱|伴奏|现场|remix|\blive\b|\bcover\b/i.test(track.name) && !/翻唱|伴奏|现场|remix|\blive\b|\bcover\b/i.test(query) ? 1 : 0
  if (name == query || name + singer == query || singer + name == query) return version
  if (name.includes(query) || singer == query) return 2 + version
  if ((name + singer).includes(query)) return 4 + version
  return 6 + version
}
export const audioQualityRank = (track: Track) => {
  const meta = track.meta as { _qualitys?: object, qualitys?: Array<{ type: string }> }
  const keys = new Set([...Object.keys(meta._qualitys ?? {}), ...(meta.qualitys ?? []).map(item => item.type)])
  return keys.has('flac24bit') ? 5 : keys.has('flac') ? 4 : keys.has('320k') ? 3 : keys.has('192k') ? 2 : keys.has('128k') ? 1 : 0
}
// 不拿平台搜索名次冒充播放热度；同等匹配层级内比较实际可用音质。
export const sortSearchQuality = <T extends Track>(list: T[], keyword: string, mode: SearchSort): T[] => {
  if (mode == 'relevance') return list
  const query = normalize(keyword)
  return list.map((track, index) => ({ track, index, match: relevance(track, query), quality: audioQualityRank(track) }))
    .sort((a, b) => a.match - b.match || b.quality - a.quality || a.index - b.index).map(item => item.track)
}
