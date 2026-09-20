const assert = require('node:assert/strict')
const { load } = require('./verify-account-playlists.cjs')
const state = { historyList: [] }
const setting = { setting: { 'search.isShowHistorySearch': false } }
let persisted = []
const actions = load('store/search/action.ts', { './state': { default: state } })
const history = load('core/search/search.ts', {
  '@/store/search/state': { default: state }, '@/store/search/action': actions, '@/store/setting/state': { default: setting },
  '@/utils/data': { getSearchHistory: async () => persisted.slice(), saveSearchHistory: async list => { persisted = list.slice() } },
})
const hotState = { sources: ['tx', 'wy', 'all'], sourceList: {} }
const hotActions = load('store/hotSearch/action.ts', { './state': { default: hotState } })
let version = 1
const hot = load('core/hotSearch.ts', {
  '@/store/hotSearch/state': { default: hotState }, '@/store/hotSearch/action': hotActions,
  '@/utils/musicSdk': { default: {
    tx: { hotSearch: { getList: async () => ({ list: [`热门${version}`] }) } },
    wy: { hotSearch: { getList: () => new Promise(() => {}) } },
  } },
}, { setTimeout: callback => setTimeout(callback, 10) })
async function main() {
  await history.addHistoryWord('不应记录')
  assert.equal(persisted.length, 0)
  setting.setting['search.isShowHistorySearch'] = true
  await history.addHistoryWord('晴天')
  await history.addHistoryWord('夜曲')
  await history.addHistoryWord('晴天')
  assert.equal(persisted.join(','), '晴天,夜曲')
  state.historyList = []
  assert.equal((await history.getSearchHistory()).join(','), '晴天,夜曲', '重新读取保留历史')
  history.removeHistoryWord(0)
  assert.equal(persisted.join(','), '夜曲')
  history.clearHistoryList()
  assert.equal(persisted.length, 0)
  assert.equal((await hot.getList('all')).join(','), '热门1', '慢平台超时后仍显示成功平台')
  version++
  hotActions.default.clearList('all')
  assert.equal((await hot.getList('all')).join(','), '热门2', '聚合刷新同时清除子平台缓存')
  assert.equal((await hot.getList('kw')).length, 0, '不支持热搜的平台安全返回')
  console.log('PASS: history recording preference, persistence, deduplication, deletion; hot-search timeout isolation and aggregate refresh')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
