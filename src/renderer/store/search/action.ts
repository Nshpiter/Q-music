
import { throttle } from '@common/utils/common'
import { toRaw } from '@common/utils/vueTools'
import {
  getSearchHistoryList,
  saveSearchHistoryList,
} from '@renderer/utils/ipc'
import { searchText, historyList } from './state'


export const setSearchText = (text: string) => {
  searchText.value = text
}

let isInitedSearchHistory = false
// 顶部工具栏和空白搜索页可能同时挂载/聚焦，复用同一个读取任务，避免
// 两次 IPC 返回后把持久化记录重复追加到共享响应式列表。
let historyLoadPromise: Promise<void> | null = null
let historyLoadVersion = 0
let historySaveVersion = 0
const saveSearchHistoryListThrottle = throttle((list: LX.List.SearchHistoryList, version: number) => {
  if (version != historySaveVersion) return
  saveSearchHistoryList(list)
}, 500)

const saveHistorySnapshot = () => {
  saveSearchHistoryListThrottle(toRaw(historyList).slice(), historySaveVersion)
}


export const getHistoryList = async() => {
  if (isInitedSearchHistory || historyList.length) {
    // 其他调用方可能已经提前恢复列表，此时同样视为已完成初始化。
    isInitedSearchHistory = true
    return
  }
  if (historyLoadPromise) return historyLoadPromise

  const version = historyLoadVersion
  historyLoadPromise = getSearchHistoryList()
    .then(list => {
      // IPC 读取期间可能发生清空操作，避免旧结果重新填充列表。
      if (version != historyLoadVersion) return
      if (Array.isArray(list) && !historyList.length) historyList.push(...list)
      isInitedSearchHistory = true
    })
    .catch(() => {
      // 搜索历史不是关键数据，存储/IPC 失败时不让聚焦事件产生未处理拒绝；
      // 保持未初始化状态，后续聚焦可再次尝试。
    })
    .finally(() => {
      historyLoadPromise = null
    })
  return historyLoadPromise
}
export const addHistoryWord = async(word: string) => {
  if (!isInitedSearchHistory) await getHistoryList()
  let index = historyList.indexOf(word)
  if (index == 0) return
  if (index > -1) historyList.splice(index, 1)
  if (historyList.length >= 15) historyList.splice(14, historyList.length - 14)
  historyList.unshift(word)
  saveHistorySnapshot()
}
export const removeHistoryWord = (index: number) => {
  if (index < 0 || index >= historyList.length) return
  historyList.splice(index, 1)
  saveHistorySnapshot()
}
export const clearHistoryList = () => {
  // 将空列表视为用户主动清空，并使进行中的读取结果失效。
  historyLoadVersion++
  historySaveVersion++
  isInitedSearchHistory = true
  historyList.splice(0, historyList.length)
  saveSearchHistoryList([])
}
