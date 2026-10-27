import type { DailyRecommendation } from './daily'

// 平台推荐由平台决定更新，重拉接口不等于换歌；本地混合和失败重试分别提示。
export const getDailyRefreshAction = (result?: Pick<DailyRecommendation, 'kind' | 'reason'>): 'shuffle' | 'retry' | undefined => {
  if (!result || result.kind != 'local') return undefined
  return result.reason == 'login_required' || !result.reason ? 'shuffle' : 'retry'
}
