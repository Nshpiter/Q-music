import { ref, shallowReactive } from '@common/utils/vueTools'


export const searchText = ref('')

export type onlineSource = LX.OnlineSource

export type SearchSource = LX.OnlineSource | 'all'

// 顶部搜索框与当前在线内容页共享同一个来源，避免各页面重复维护平台选择器。
export const selectedSource = ref<SearchSource>('all')


export const historyList = shallowReactive<string[]>([])
