import { rendererInvoke } from '@common/rendererIpc'
import { WIN_MAIN_RENDERER_EVENT_NAME } from '@common/ipcNames'
import { PlayHistory } from '@common/utils/playHistory'
export const playHistory = new PlayHistory<LX.Music.MusicInfo>(
  async() => rendererInvoke(WIN_MAIN_RENDERER_EVENT_NAME.get_data, 'playHistory'),
  async data => { await rendererInvoke(WIN_MAIN_RENDERER_EVENT_NAME.save_data, { path: 'playHistory', data }) },
)
