import { PlayHistory } from '@/utils/playHistory'
import { getData, saveData } from '@/plugins/storage'
export const playHistory = new PlayHistory<LX.Music.MusicInfo>(
  async() => getData('qmusic.playHistory'),
  async data => saveData('qmusic.playHistory', data),
)
