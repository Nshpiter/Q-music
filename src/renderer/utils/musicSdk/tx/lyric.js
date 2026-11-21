import { httpFetch } from '../../request'
import getMusicInfo from './musicInfo'
import { rendererInvoke } from '@common/rendererIpc'
import { WIN_MAIN_RENDERER_EVENT_NAME } from '@common/ipcNames'

const songIdMap = new Map()
const promises = new Map()
export const decodeLyric = (lrc, tlrc, rlrc) => rendererInvoke(WIN_MAIN_RENDERER_EVENT_NAME.handle_tx_decode_lyric, { lrc, tlrc, rlrc })


const parseTools = {
  rxps: {
    info: /^{"/,
    lineTime: /^\[(\d+),\d+\]/,
    lineTime2: /^\[([\d:.]+)\]/,
    wordTime: /\(\d+,\d+\)/,
    wordTimeAll: /(\(\d+,\d+\))/g,
    timeLabelFixRxp: /(?:\.0+|0+)$/,
  },
  msFormat(timeMs) {
    if (Number.isNaN(timeMs)) return ''
    let ms = timeMs % 1000
    timeMs /= 1000
    let m = parseInt(timeMs / 60).toString().padStart(2, '0')
    timeMs %= 60
    let s = parseInt(timeMs).toString().padStart(2, '0')
    return `[${m}:${s}.${String(ms).padStart(3, '0')}]`
  },
  parseLyric(lrc) {
    lrc = lrc.trim()
    lrc = lrc.replace(/\r/g, '')
    if (!lrc) return { lyric: '', lxlyric: '' }
    const lines = lrc.split('\n')

    const lxlrcLines = []
    const lrcLines = []

    for (let line of lines) {
      line = line.trim()
      let result = this.rxps.lineTime.exec(line)
      if (!result) {
        if (line.startsWith('[offset')) {
          lxlrcLines.push(line)
          lrcLines.push(line)
        }
        if (this.rxps.lineTime2.test(line)) {
          // lxlrcLines.push(line)
          lrcLines.push(line)
        }
        continue
      }

      const startMsTime = parseInt(result[1])
      const startTimeStr = this.msFormat(startMsTime)
      if (!startTimeStr) continue

      let words = line.replace(this.rxps.lineTime, '')

      lrcLines.push(`${startTimeStr}${words.replace(this.rxps.wordTimeAll, '')}`)

      let times = words.match(this.rxps.wordTimeAll)
      if (!times) continue
      times = times.map(time => {
        const result = /\((\d+),(\d+)\)/.exec(time)
        return `<${Math.max(parseInt(result[1]) - startMsTime, 0)},${result[2]}>`
      })
      const wordArr = words.split(this.rxps.wordTime)
      const newWords = times.map((time, index) => `${time}${wordArr[index]}`).join('')
      lxlrcLines.push(`${startTimeStr}${newWords}`)
    }
    return {
      lyric: lrcLines.join('\n'),
      lxlyric: lxlrcLines.join('\n'),
    }
  },
  parseRlyric(lrc) {
    lrc = lrc.trim()
    lrc = lrc.replace(/\r/g, '')
    if (!lrc) return ''
    const lines = lrc.split('\n')

    const lrcLines = []

    for (let line of lines) {
      line = line.trim()
      let result = this.rxps.lineTime.exec(line)
      if (!result) continue

      const startMsTime = parseInt(result[1])
      const startTimeStr = this.msFormat(startMsTime)
      if (!startTimeStr) continue

      let words = line.replace(this.rxps.lineTime, '')

      lrcLines.push(`${startTimeStr}${words.replace(this.rxps.wordTimeAll, '')}`)
    }
    return lrcLines.join('\n')
  },
  removeTag(str) {
    return str.replace(/^[\S\s]*?LyricContent="/, '').replace(/"\/>[\S\s]*?$/, '')
  },
  alignTimedLines(extra, lyric) {
    const timedRows = value => value.split(/\r?\n/).flatMap(line => {
      const match = /^\[(\d+):(\d+)(?:\.(\d{1,3}))?\](.+)$/.exec(line.trim())
      if (!match || !match[4].trim()) return []
      const time = Number(match[1]) * 60000 + Number(match[2]) * 1000 + Number((match[3] ?? '').padEnd(3, '0'))
      return [{ time, tag: line.trim().slice(0, match[0].length - match[4].length), text: match[4] }]
    })
    const originals = timedRows(lyric)
    const byTime = new Map(originals.map(row => [row.time, row]))
    const matches = new Map()
    for (const row of timedRows(extra)) {
      let target = byTime.get(row.time)
      if (!target) {
        const near = originals.filter(original => Math.abs(original.time - row.time) < 100)
        if (near.length !== 1) continue
        target = near[0]
      }
      const distance = Math.abs(target.time - row.time)
      const previous = matches.get(target.time)
      if (!previous || distance < previous.distance) matches.set(target.time, { distance, line: target.tag + row.text })
    }
    return Array.from(matches.values(), match => match.line).join('\n')
  },
  parse(lrc, tlrc, rlrc) {
    const info = {
      lyric: '',
      tlyric: '',
      rlyric: '',
      lxlyric: '',
    }
    if (lrc) {
      let { lyric, lxlyric } = this.parseLyric(this.removeTag(lrc))
      info.lyric = lyric
      info.lxlyric = lxlyric
      // console.log(lyric)
      // console.log(lxlyric)
    }
    if (rlrc) info.rlyric = this.alignTimedLines(this.parseRlyric(this.removeTag(rlrc)), info.lyric)
    if (tlrc) info.tlyric = this.alignTimedLines(tlrc, info.lyric)
    // console.log(info.lyric)
    // console.log(info.tlyric)
    // console.log(info.rlyric)

    return info
  },
}


export default {
  successCode: 0,
  async getSongId({ songId, songmid }) {
    if (songId) return songId
    if (songIdMap.has(songmid)) return songIdMap.get(songmid)
    if (promises.has(songmid)) return (await promises.get(songmid)).songId
    const promise = getMusicInfo(songmid)
    promises.set(songmid, promise)
    try {
      const info = await promise
      songIdMap.set(songmid, info.songId)
      return info.songId
    } finally {
      promises.delete(songmid)
    }
  },
  async parseLyric(lrc, tlrc, rlrc) {
    const { lyric, tlyric, rlyric } = await decodeLyric(lrc, tlrc, rlrc)
    // return {

    // }
    // console.log(lyric)
    // console.log(tlyric)
    // console.log(rlyric)
    return parseTools.parse(lyric, tlyric, rlyric)
  },
  getLyric(mInfo, retryNum = 0) {
    return {
      cancelHttp() {

      },
      promise: this.getSongId(mInfo).then(songId => {
        const requestObj = httpFetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
          method: 'post',
          headers: {
            referer: 'https://y.qq.com',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36',
          },
          body: {
            comm: {
              ct: '19',
              cv: '1859',
              uin: '0',
            },
            req: {
              method: 'GetPlayLyricInfo',
              module: 'music.musichallSong.PlayLyricInfo',
              param: {
                format: 'json',
                crypt: 1,
                ct: 19,
                cv: 1873,
                interval: 0,
                lrc_t: 0,
                qrc: 1,
                qrc_t: 0,
                roma: 1,
                roma_t: 0,
                songID: songId,
                trans: 1,
                trans_t: 0,
                type: -1,
              },
            },
          },
        })
        return requestObj.promise.then(({ body }) => {
          // console.log(body)
          if (body?.code != this.successCode || body.req?.code != this.successCode) {
            if (retryNum >= 3) throw new Error('Get lyric failed')
            return this.getLyric({ songId }, retryNum + 1).promise
          }
          const data = body.req.data
          return this.parseLyric(data.lyric, data.trans, data.roma)
        })
      }),
    }
  },
}

// export default {
//   regexps: {
//     matchLrc: /.+"lyric":"([\w=+/]*)".+/,
//   },
//   getLyric(songmid) {
//     const requestObj = httpFetch(`https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${songmid}&g_tk=5381&loginUin=0&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&platform=yqq`, {
//       headers: {
//         Referer: 'https://y.qq.com/portal/player.html',
//       },
//     })
//     requestObj.promise = requestObj.promise.then(({ body }) => {
//       if (body.code != 0 || !body.lyric) return Promise.reject(new Error('Get lyric failed'))
//       return {
//         lyric: decodeName(b64DecodeUnicode(body.lyric)),
//         tlyric: decodeName(b64DecodeUnicode(body.trans)),
//       }
//     })
//     return requestObj
//   },
// }
