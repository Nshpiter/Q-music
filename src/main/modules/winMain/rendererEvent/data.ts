import { STORE_NAMES } from '@common/constants'
import { WIN_MAIN_RENDERER_EVENT_NAME } from '@common/ipcNames'
import { mainOn, mainHandle } from '@common/mainIpc'
import getStore from '@main/utils/store'

export default () => {
  const save = ({ path, data }: { path: string, data: unknown }) => {
    getStore(STORE_NAMES.DATA).set(path, data)
  }
  mainHandle<string, any>(WIN_MAIN_RENDERER_EVENT_NAME.get_data, ({ params: path }) => {
    return getStore(STORE_NAMES.DATA).get(path) as any
  })

  mainOn<{
    path: string
    data: any
  }>(WIN_MAIN_RENDERER_EVENT_NAME.save_data, ({ params: { path, data } }) => {
    save({ path, data })
  })
  // 历史等需要确认落盘的功能使用 invoke；保留已有的单向保存协议。
  mainHandle<{ path: string, data: unknown }, boolean>(WIN_MAIN_RENDERER_EVENT_NAME.save_data, async({ params }) => { save(params); return true })
}
