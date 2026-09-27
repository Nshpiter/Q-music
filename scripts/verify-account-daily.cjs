// 真实推荐适配、官方请求、WEAPI 加密和歌曲转换；网络及原生存储使用夹具。
const assert = require('node:assert/strict')
const vm = require('node:vm')
const h = require('./verify-account-playlists.cjs')
const storage = new Map()
const credentials = new Map()
let fallbackCalls = 0
const key = 'qmk-test_daily_fixture_1234'
const api = h.load('core/musicAccount/daily.ts', {
  '@react-native-async-storage/async-storage': { default: { getItem: async k => storage.get(k), setItem: async(k, v) => storage.set(k, v) } },
  'react-native': {
    NativeModules: {
      MusicCredentialModule: {
        getQQDailyKey: async owner => credentials.get(owner),
        setQQDailyKey: async(owner, value) => { credentials.clear(); credentials.set(owner, value) },
        clearQQDailyKey: async() => credentials.clear(),
      },
    },
  },
  './cookies': h.cookies,
  './requests': h.requests,
  '@/utils/musicSdk/tx/songList': h.qq,
  '@/utils/musicSdk/wy/songList': h.wy,
  '@/utils': h.utils,
  '@/core/dailyRecommend': { getDailyRecommend: async() => { fallbackCalls++; return [{ id: 'local' }] } },
})
const bridge = h.load('core/musicAccount/dailyAuthorization.ts', {})
let mode = 'official'
const calls = []
h.setHandler((url, init) => {
  calls.push(url)
  if (url.includes('daily-mix')) {
    assert.equal(init.headers.Authorization, `Bearer ${key}`)
    assert.match(init.headers.Cookie, /qm_keyst=test-key/)
    assert.equal(JSON.parse(init.body).comm.skill_version, '0.0.3')
    if (mode === 'network') throw new Error('offline')
    if (mode === 'radar' || mode === 'local') return { ret: 1 }
    if (mode === 'bulk') return { songlist: Array.from({ length: 30 }, (_, index) => ({ songMid: `mid${index + 1}` })) }
    return { ret: 0, sub_ret: 0, songlist: [{ songMid: 'mid2' }, { songMid: 'mid1' }, { songMid: 'mid2' }] }
  }
  if (url.includes('musicu')) {
    const body = JSON.parse(init.body)
    if (body.radio) {
      if (mode === 'local') throw new Error('offline')
      return { code: 0, radio: { code: 0, data: { VecSongs: body.radio.param.Page === 1 ? [{ Track: { mid: 'mid3' } }] : [] } } }
    }
    if (mode === 'change') h.setCookie('uin=456; qm_keyst=test-other; MUSIC_U=test-netease')
    const result = { code: 0 }
    for (const [name, call] of Object.entries(body)) {
      if (name === 'comm') continue
      result[name] = { code: 0, data: { track_info: h.qqTrack(Number(call.param.song_mid.slice(3))) } }
    }
    return result
  }
  const data = h.decodeForm(init.body)
  if (url.includes('recommend/songs')) return { code: 200, data: { dailySongs: [{ id: 2 }, { id: 1 }, { id: 2 }] } }
  const ids = JSON.parse(data.c).map(item => Number(item.id)).reverse()
  return { code: 200, songs: ids.map(h.wyTrack), privileges: ids.map(id => ({ id, maxbr: 128000 })) }
})
async function main() {
  assert.equal(await api.getDailyProvider(), 'tx')
  await api.setDailyProvider('wy')
  assert.equal(await api.getDailyProvider(), 'wy')
  await assert.rejects(api.saveQQDailyKey('invalid'), /invalid_key/)
  assert.equal(credentials.size, 0)
  await api.saveQQDailyKey(key)
  assert.equal(credentials.get('123'), key)
  let result = await api.getAccountDaily('tx')
  assert.equal(result.kind, 'official_daily')
  assert.equal(result.list.map(item => item.id).join(','), 'tx_mid2,tx_mid1')
  assert.equal(result.list[0].meta.strMediaMid, 'media2')
  const count = calls.length
  await api.getAccountDaily('tx')
  assert.equal(calls.length, count, '相同账号缓存复用')
  const controller = new AbortController(); controller.abort()
  await assert.rejects(api.getAccountDaily('tx', false, controller.signal), /cancelled/)
  mode = 'bulk'
  calls.length = 0
  result = await api.getAccountDaily('tx', true)
  assert.equal(result.list.length, 30)
  assert.equal(calls.filter(url => url.includes('musicu')).length, 3, '30 首详情分三组并发请求')
  mode = 'radar'
  await assert.rejects(api.saveQQDailyKey(key), /invalid_key/)
  mode = 'network'
  await assert.rejects(api.saveQQDailyKey(key), /offline/)
  mode = 'radar'
  result = await api.getAccountDaily('tx', true)
  assert.equal(result.kind, 'radar')
  assert.equal(result.reason, 'official_unavailable')
  assert.equal(result.list[0].id, 'tx_mid3')
  mode = 'local'
  result = await api.getAccountDaily('tx', true)
  assert.equal(result.kind, 'local')
  assert.equal(fallbackCalls, 1)
  result = await api.getAccountDaily('wy')
  assert.equal(result.kind, 'netease_daily')
  assert.equal(result.list.map(item => item.id).join(','), 'wy_2,wy_1')
  mode = 'change'
  result = await api.getAccountDaily('tx', true)
  assert.equal(result.kind, 'local', '请求中换号不显示旧账号结果')
  assert.equal(result.reason, 'login_required')
  assert.equal((await api.getQQDailyKeyStatus()).configured, false)
  h.setCookie('')
  result = await api.getAccountDaily('wy')
  assert.equal(result.reason, 'login_required')
  await api.clearQQDailyKey()
  assert.equal(credentials.size, 0)
  for (const url of ['https://y.qq.com/n/ryqq_v2/qqmusic_skills', 'https://a.qq.com/']) assert.equal(bridge.isQQDailyOrigin(url), true)
  assert.match(bridge.QQ_DAILY_USER_AGENT, /Windows NT/)
  assert.doesNotMatch(bridge.QQ_DAILY_USER_AGENT, /Mobile|Android/)
  for (const url of ['http://y.qq.com/', 'https://y.qq.com.evil.test/', 'https://y.qq.com@evil.test/', 'https://evil.test/', 'https://y.qq.com\\@evil.test/']) assert.equal(bridge.isQQDailyOrigin(url), false)
  const messages = []
  let inspect
  vm.runInNewContext(bridge.QQ_DAILY_BRIDGE, {
    location: { href: 'https://y.qq.com/n/ryqq_v2/qqmusic_skills' },
    document: { body: { innerText: `Your key: ${key}` }, querySelectorAll: () => [] },
    window: { ReactNativeWebView: { postMessage: value => messages.push(JSON.parse(value)) } },
    setInterval: callback => { inspect = callback; return 1 },
  })
  inspect(); inspect()
  assert.equal(messages.length, 1, '同一授权不重复提交')
  assert.equal(messages[0].key, key)
  await assert.rejects(h.requests.request('https://evil.test/', {}, {}), /invalid_host/)
  console.log('PASS: provider persistence, official authorization, QQ radar/local fallback, NetEase order, cache/cancellation, account isolation, origin checks and bridge deduplication')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
