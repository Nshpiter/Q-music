// 离线回归：真实适配/加密/同步代码，只有网络、原生桥和本地存储使用夹具。
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const crypto = require('node:crypto')
const ts = require('typescript')
const root = path.join(__dirname, '../src')
function load(file, dependencies, globals = {}) {
  const context = { exports: {}, Buffer, URLSearchParams, AbortController, setTimeout, clearTimeout, Error, ...globals,
    require: id => { if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`); return dependencies[id] },
  }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context)
  return context.exports
}
let rawCookie = 'uin=123; qm_keyst=test-key; MUSIC_U=test-netease; __csrf=test-csrf'
const cookies = load('core/musicAccount/cookies.ts', { 'react-native': { NativeModules: { UtilsModule: { getWebCookie: async () => rawCookie } } } })
let secret
const encryption = load('utils/musicSdk/wy/utils/crypto.js', {
  'react-native-quick-base64': { btoa: text => Buffer.from(text).toString('base64') },
  '@/utils/nativeModules/crypto': {
    AES_MODE: { CBC_128_PKCS7Padding: 'aes-128-cbc' }, RSA_PADDING: { NoPadding: crypto.constants.RSA_NO_PADDING },
    aesEncryptSync: (data, key, iv, mode) => {
      const keyBuffer = Buffer.from(key, 'base64')
      assert.equal(keyBuffer.length, 16)
      secret = keyBuffer
      const cipher = crypto.createCipheriv(mode, keyBuffer, Buffer.from(iv, 'base64'))
      return Buffer.concat([cipher.update(Buffer.from(data, 'base64')), cipher.final()]).toString('base64')
    },
    rsaEncryptSync: (data, key, padding) => crypto.publicEncrypt({ key, padding }, Buffer.from(data, 'base64')).toString('base64'),
  }, '../../utils': {},
}, { Math: { ...Math, random: () => 0.5, floor: Math.floor } })
const decrypt = (value, key) => {
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, Buffer.from('0102030405060708'))
  return Buffer.concat([decipher.update(Buffer.from(value, 'base64')), decipher.final()]).toString()
}
const decodeForm = body => JSON.parse(decrypt(decrypt(new URLSearchParams(body).get('params'), secret), Buffer.from('0CoJUm6Qyw8W8jud')))
assert.equal(decodeForm(new URLSearchParams(encryption.weapi({ test: '中文' })).toString()).test, '中文')
const utils = load('utils/index.ts', { './common': {}, he: {}, '@/utils/simplify-chinese-main': {} })
const sdkDeps = { '../../request': {}, '../../index': { formatPlayTime: value => String(value), sizeFormate: value => String(value) }, '../utils': { formatSingerName: rows => rows.map(row => row.name).join('、') } }
const qq = load('utils/musicSdk/tx/songList.js', sdkDeps)
const wy = load('utils/musicSdk/wy/songList.js', { ...sdkDeps, './utils/crypto': {}, './musicDetail': {}, './utils/index': {} })
let handler
const requests = load('core/musicAccount/requests.ts', { './cookies': cookies, '@/utils/musicSdk/wy/utils/crypto': encryption }, {
  fetch: async (url, init) => {
    assert.match(new URL(url).hostname, /(?:^|\.)(?:qq\.com|163\.com)$/)
    if (!init.headers.Authorization) assert.match(init.headers.Cookie, /test-/)
    if (init.signal.aborted) throw new Error('aborted')
    const result = await handler(url, init)
    return { ok: true, json: async () => result }
  },
})
const api = load('core/musicAccount/playlists.ts', { './requests': requests, './cookies': cookies, '@/utils/musicSdk/tx/songList': qq, '@/utils/musicSdk/wy/songList': wy, '@/utils': utils })
const wyTrack = id => ({ id, name: `歌 ${id}`, ar: [{ name: '歌手' }], al: { id: 2, name: '专辑', picUrl: 'https://example.test/cover' }, dt: 120000 })
const qqTrack = id => ({ id, mid: `mid${id}`, title: `歌 ${id}`, singer: [{ name: '歌手' }], album: { mid: 'album', name: '专辑' }, file: { media_mid: `media${id}`, size_128mp3: 100, size_320mp3: 0, size_flac: 0, size_hires: 0 }, interval: 120 })
const state = { userList: [] }
const storage = new Map()
let failWrite = false
const sync = load('core/musicAccount/playlistSync.ts', {
  '@/store/list/state': { default: state }, './playlists': api,
  '@/core/list': {
    setFetchingListStatus: () => {},
    createList: async info => { state.userList.push(info); storage.set(info.id, info.list) },
    overwriteListMusics: async (id, tracks) => { if (failWrite) throw new Error('disk'); storage.set(id, tracks) },
  }, '@/utils/data': { setListUpdateTime: async () => {} },
})
let incomplete = false
let total = 205
let detailCalls = 0
function neteaseHandler(url, init) {
  const data = decodeForm(init.body)
  assert.equal(data.csrf_token, 'test-csrf')
  if (url.includes('account/get')) return { code: 200, profile: { userId: 42 } }
  if (url.includes('user/playlist')) return { code: 200, more: data.offset === 0, playlist: [{ id: data.offset + 1, name: '测试歌单', trackCount: 205, creator: { userId: data.offset ? 7 : 42 } }] }
  if (url.includes('playlist/detail')) return { code: 200, playlist: { trackCount: total, trackIds: Array.from({ length: total }, (_, i) => ({ id: i + 1 })) } }
  if (url.includes('song/detail')) {
    detailCalls++
    const ids = JSON.parse(data.c).map(item => Number(item.id))
    if (incomplete) ids.pop()
    return { code: 200, songs: ids.map(wyTrack).reverse(), privileges: ids.map(id => ({ id, maxbr: 128000 })) }
  }
  throw new Error('Unexpected NetEase request')
}
async function main() {
  handler = neteaseHandler
  const session = await api.openPlaylistSession('wy')
  const lists = await api.getAccountPlaylists(session)
  assert.equal(lists.length, 2)
  assert.equal(lists[0].kind, 'created')
  assert.equal(lists[1].kind, 'favorite')
  const first = await sync.syncAccountPlaylist(session, lists[0])
  assert.equal(first.count, 205)
  assert.equal(detailCalls, 2)
  assert.equal(storage.get(first.id)[0].id, 'wy_1')
  assert.equal(storage.get(first.id)[204].id, 'wy_205')
  assert.equal(storage.get(first.id)[0].meta.albumName, '专辑')
  await sync.syncAccountPlaylist(session, lists[0])
  assert.equal(state.userList.length, 1, '重复同步不新建')
  const ongoing = sync.syncAccountPlaylist(session, lists[0])
  await assert.rejects(sync.syncAccountPlaylist(session, lists[0]), /busy/)
  await ongoing
  incomplete = true
  await assert.rejects(sync.syncAccountPlaylist(session, lists[0]), /incomplete/)
  assert.equal(storage.get(first.id).length, 205, '不完整返回不能覆盖')
  incomplete = false
  const controller = new AbortController(); controller.abort()
  await assert.rejects(sync.syncAccountPlaylist(session, lists[0], controller.signal), /aborted|cancelled/)
  assert.equal(storage.get(first.id).length, 205)
  rawCookie = rawCookie.replace('MUSIC_U=test-netease', 'MUSIC_U=changed')
  await assert.rejects(sync.syncAccountPlaylist(session, lists[0]), /account_changed/)
  rawCookie = rawCookie.replace('MUSIC_U=changed', 'MUSIC_U=test-netease')
  handler = (url, init) => {
    const result = neteaseHandler(url, init)
    if (url.includes('song/detail')) rawCookie = rawCookie.replace('MUSIC_U=test-netease', 'MUSIC_U=changed')
    return result
  }
  await assert.rejects(sync.syncAccountPlaylist(session, lists[0]), /account_changed/)
  assert.equal(storage.get(first.id).length, 205, '读取过程中换号也不能写入')
  rawCookie = rawCookie.replace('MUSIC_U=changed', 'MUSIC_U=test-netease')
  handler = neteaseHandler
  failWrite = true
  await assert.rejects(sync.syncAccountPlaylist(session, lists[0]), /disk/)
  failWrite = false
  const duplicate = { ...state.userList[0], id: 'local-duplicate' }
  state.userList.push(duplicate)
  storage.set(duplicate.id, [])
  await sync.syncAccountPlaylist(session, lists[0], undefined, duplicate)
  assert.equal(storage.get(duplicate.id).length, 205, '列表菜单更新指定副本')
  total = 0
  await sync.syncAccountPlaylist(session, lists[0])
  assert.equal(storage.get(first.id).length, 0, '确认完整的空歌单可以同步')
  let truncatedQQ = false
  handler = (url, init) => {
    if (url.includes('profile_homepage')) return { code: 0, data: { creator: { encrypt_uin: 'encrypted123' } } }
    const calls = JSON.parse(init.body)
    assert.equal(calls.comm.authst, 'test-key')
    const result = { code: 0 }
    for (const [key, call] of Object.entries(calls)) {
      if (key === 'comm') continue
      let data
      if (key === 'created') data = { v_playlist: [{ dirId: 201, dirName: '我喜欢' }, { tid: 99, dirName: '自建' }] }
      if (key === 'favorite') data = { v_list: [{ tid: call.param.offset + 100, title: '收藏歌单' }], hasmore: call.param.offset === 0 ? 1 : 0 }
      if (key === 'liked') data = { total_song_num: 205 }
      if (key === 'detail') {
        const start = call.param.song_begin
        const size = start === 200 && truncatedQQ ? 0 : Math.min(100, 205 - start)
        data = { total_song_num: 205, songlist: Array.from({ length: size }, (_, i) => qqTrack(start + i + 1)) }
      }
      result[key] = { code: 0, data }
    }
    return result
  }
  const qqSession = await api.openPlaylistSession('tx')
  const qqLists = await api.getAccountPlaylists(qqSession)
  assert.equal(qqLists.length, 4)
  assert.equal(qqLists[0].id, 'dir:201')
  assert.equal(qqLists[0].count, 205)
  const qqResult = await sync.syncAccountPlaylist(qqSession, qqLists[0])
  assert.equal(qqResult.count, 205)
  assert.equal(storage.get(qqResult.id)[0].meta.strMediaMid, 'media1')
  assert.equal(storage.get(qqResult.id)[204].id, 'tx_mid205')
  truncatedQQ = true
  await assert.rejects(sync.syncAccountPlaylist(qqSession, qqLists[0]), /incomplete/)
  assert.equal(storage.get(qqResult.id).length, 205)
  handler = () => ({ code: 0, detail: { code: 104401, data: {} } })
  await assert.rejects(api.getAccountPlaylistTracks(qqSession, 'dir:201'), /login_required/)
  handler = () => ({ code: 0 })
  await assert.rejects(api.getAccountPlaylistTracks(qqSession, 'dir:201'), /unavailable/)
  assert.notEqual(sync.accountSourceId('42', 'dir:201'), sync.accountSourceId('123', 'dir:201'))
  assert.equal(sync.parseAccountSourceId('account:42:dir:201').id, 'dir:201')
  console.log('PASS: real WEAPI encryption, both catalogs and pagination, 205-track imports, metadata/order, repeat updates, incomplete/error protection, empty list, cancellation, account isolation and storage failures (fixture network/storage)')
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1 })
module.exports = { load, cookies, requests, qq, wy, utils, qqTrack, wyTrack, decodeForm, setHandler: value => { handler = value }, setCookie: value => { rawCookie = value } }
