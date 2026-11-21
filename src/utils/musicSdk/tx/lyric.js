import { httpFetch } from '../../request'
import { b64DecodeUnicode, decodeName } from '../../index'

const headers = { Referer: 'https://y.qq.com/portal/player.html' }
const decode = value => value ? decodeName(b64DecodeUnicode(value)) : ''

export default {
  getLyric(songmid) {
    const data = {
      comm: { ct: 24, cv: 0 },
      req: {
        module: 'music.musichallSong.PlayLyricInfo',
        method: 'GetPlayLyricInfo',
        param: { songMid: songmid, trans: 1, qrc: 0, crypt: 0, ct: 19, cv: 2005 },
      },
    }
    let request = httpFetch(`https://u.y.qq.com/cgi-bin/musicu.fcg?data=${encodeURIComponent(JSON.stringify(data))}`, { headers, timeout: 5000 })
    let cancelled = false
    const promise = request.promise.then(({ body }) => {
      const result = body?.req
      const lyric = decode(result?.data?.lyric)
      if (result?.code !== 0 || !/\[\d+:\d+/.test(lyric)) throw new Error('Get lyric failed')
      return { lyric, tlyric: decode(result.data.trans), qqPlayLyric: true }
    }).catch(async error => {
      if (cancelled) throw error
      request = httpFetch(`https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${encodeURIComponent(songmid)}&g_tk=5381&loginUin=0&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&platform=yqq`, { headers })
      const { body } = await request.promise
      if (body?.code != 0 || !body.lyric) throw new Error('Get lyric failed')
      return { lyric: decode(body.lyric), tlyric: decode(body.trans) }
    })
    return {
      promise,
      cancelHttp() {
        cancelled = true
        request.cancelHttp()
      },
    }
  },
}
