const assert = require('node:assert/strict')
const h = require('./verify-account-playlists.cjs')

const lines = (text, shift = 0) => Array.from({ length: 5 }, (_, index) => `[00:${String(index * 5 + shift).padStart(2, '0')}.00]${text}`).join('\n')
let saved
const source = { id: 'tx_mid1', source: 'tx', name: 'SAKURA (樱花)', singer: '生物股长', interval: '5:54' }
const matching = { id: 'wy_1', source: 'wy', name: 'SAKURA', singer: 'いきものがかり', interval: '5:56' }
let candidates = [matching]
let searchCandidates
let translation = lines('中文译文', 3)
let alternateLyric = lines('さくらひらひら', 3)
const online = h.load('core/music/online.ts', {
  '@/utils/data': { saveLyric: async(...args) => { saved = args } },
  '@/core/list': {},
  '@/store/setting/state': { default: { setting: {} } },
  './utils': { getOtherSource: async() => candidates },
  '@/utils/musicSdk': {
    default: {
      wy: {
        musicSearch: { search: async() => ({ list: searchCandidates ?? candidates }) },
        getLyric: () => ({ promise: Promise.resolve({ lyric: alternateLyric, tlyric: translation }) }),
      },
    },
  },
  '@/utils': { toOldMusicInfo: item => item, toNewMusicInfo: item => item },
})
const lyric = { lyric: lines('さくらひらひら'), tlyric: '', rawlrcInfo: { lyric: lines('さくらひらひら') } }

async function main() {
  assert.equal(await online.findMatchedTranslation(source, lyric), lines('中文译文'))
  assert.equal(saved[0], source)
  assert.equal(saved[1].tlyric, lines('中文译文'))
  candidates = [{ ...matching, name: 'Different Song' }]
  assert.equal(await online.findMatchedTranslation({ ...source, id: 'tx_mid2' }, lyric), '')
  candidates = [matching]
  alternateLyric = lines('另一首歌', 3)
  assert.equal(await online.findMatchedTranslation({ ...source, id: 'tx_mid3' }, lyric), '')
  alternateLyric = lines('さくらひらひら', 3)
  assert.equal(await online.findMatchedTranslation({ ...source, id: 'tx_mid4' }, { ...lyric, tlyric: lines('已有译文') }), '')

  const splitLyric = {
    ...lyric,
    lyric: '[00:01.70]さくら ひらひら\n[00:05.00]舞い降りて落ちて\n[00:08.12]揺れる 想いのたけを 抱きしめた\n[00:14.42]君と 春に 願いし あの夢は\n[00:21.15]今も見えているよ',
  }
  alternateLyric = '[00:01.70]さくら ひらひら 舞い降りて落ちて\n[00:08.12]揺れる 想いのたけを 抱きしめた\n[00:14.42]君と 春に 願いし あの夢は\n[00:21.15]今も見えているよ'
  translation = '[00:01.70]樱花，一片一片飞舞落下\n[00:08.12]摇动拥抱我的思绪\n[00:14.42]和你在春天相遇的那个梦\n[00:21.15]现在仍清晰可见'
  const aligned = await online.findMatchedTranslation({ ...source, id: 'tx_sakura' }, splitLyric)
  assert.match(aligned, /^\[00:01.70\]樱花，一片一片飞舞落下/)
  assert.equal(aligned.split('\n').length, 4, '拆行不重复显示同一译文')
  assert.doesNotMatch(aligned, /\[00:05.00\]/)

  searchCandidates = []
  alternateLyric = lines('さくらひらひら', 3)
  translation = lines('中文译文', 3)
  assert.equal(await online.findMatchedTranslation({ ...source, id: 'tx_fallback' }, { ...lyric, lyric: lines('さくらひらひろ') }), lines('中文译文'))

  const wy = h.load('utils/musicSdk/wy/lyric.js', {
    '../../request': {
      httpFetch: () => ({
        promise: Promise.resolve({
          body: {
            code: 200,
            lrc: { lyric: '[00:01.00]Hello world' },
            yrc: { lyric: '[1000,2000](1000,2000,0)Hello world' },
            tlyric: { lyric: '[00:01.00]你好世界' },
          },
        }),
      }),
    },
    './utils/crypto': { eapi: () => ({}) },
  })
  assert.match((await wy.default('123').promise).tlyric, /你好世界/, '逐字歌词缺少逐字翻译时使用普通译文')

  const qq = h.load('utils/musicSdk/tx/lyric.js', {
    '../../request': { httpFetch: () => ({ promise: Promise.resolve({ body: { code: 0, lyric: Buffer.from(lines('Hello world')).toString('base64') } }) }) },
    '../../index': { b64DecodeUnicode: value => Buffer.from(value, 'base64').toString(), decodeName: value => value },
  })
  assert.equal((await qq.default.getLyric('mid').promise).tlyric, '')
  console.log('PASS: matched translation, fallback search, fuzzy lyrics, NetEase translation fallback, QQ lyric without trans')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
