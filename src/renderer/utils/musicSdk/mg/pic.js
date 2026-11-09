import { httpFetch } from '../../request'
import getSongId from './songId'
import { getMiguArtwork } from './artwork'

export default {
  async getPicUrl(songId, tryNum = 0) {
    if (tryNum > 2) throw new Error('图片获取失败')
    const { body } = await httpFetch(`https://music.migu.cn/v3/api/music/audioPlayer/getSongPic?songId=${songId}`, {
      headers: {
        Referer: 'http://music.migu.cn/v3/music/player/audio?from=migu',
      },
    }).promise
    if (body?.returnCode !== '000000') return this.getPicUrl(songId, tryNum + 1)
    const url = getMiguArtwork(body.largePic, body.mediumPic, body.smallPic)
    if (!url) throw new Error('图片获取失败')
    // 调用方需要 URL，不能把请求对象写入歌曲封面并传给 Image。
    return url
  },
  async getPic(songInfo) {
    const songId = await getSongId(songInfo)
    return this.getPicUrl(songId)
  },
}
