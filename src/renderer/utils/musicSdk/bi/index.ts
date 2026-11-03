import { httpFetch } from '../../request'
import { createBilibiliClient } from '@common/utils/bilibili'

export const bilibiliClient = createBilibiliClient(async(url, headers, signal) => {
  const request = httpFetch(url, { headers, timeout: 15000 }) as unknown as { promise: Promise<{ statusCode: number, body: Record<string, any> | string }>, cancelHttp: () => void }
  const cancel = () => { request.cancelHttp() }
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    if (signal?.aborted) { cancel(); throw new Error('cancelled') }
    const response = await request.promise
    if (response.statusCode && response.statusCode != 200) throw new Error(`Bilibili HTTP ${response.statusCode}`)
    return typeof response.body == 'string' ? JSON.parse(response.body) : response.body
  } finally { signal?.removeEventListener('abort', cancel) }
})

// 能力为空时不进入榜单/歌单等选择器。
const sdk: any = {
  musicSearch: { search: bilibiliClient.search },
  songList: null,
  leaderboard: null,
  tipSearch: { search: bilibiliClient.suggest },
  hotSearch: null,
  comment: null,
  getMusicUrl: (song: { songmid: string }) => ({ promise: bilibiliClient.playback(String(song.songmid)) }),
  getPic: (song: { img?: string }) => ({ promise: Promise.resolve(song.img ?? '') }),
  getLyric: () => ({ promise: Promise.resolve({ lyric: '' }) }),
  getMusicDetailPageUrl: (song: { songmid: string }) => `https://www.bilibili.com/video/${String(song.songmid).split(':')[0]}`,
}
export default sdk
