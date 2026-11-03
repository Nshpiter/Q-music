const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
function load(file, deps = {}) {
  const context = { exports: {}, AbortController, Date, setTimeout, clearTimeout, require: id => {
    if (!(id in deps)) throw Error('Missing dependency ' + id)
    return deps[id]
  } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
  return context.exports
}
const bvid = 'BV1xx411c7mD'
const video = { bvid, title: '音乐合集', pages: [{ cid: 10, part: '第一首' }, { cid: 20, part: '第二首' }] }
const convert = item => ({ id: 'bi_' + item.songmid, source: 'bi', name: item.name, meta: { songId: item.songmid } })

test('搜索短期缓存与详情复用，不把播放地址放入缓存，也不忽略取消', async() => {
  const calls = []
  const { createBilibiliClient } = load('src/utils/bilibili.ts')
  const client = createBilibiliClient(async url => {
    calls.push(new URL(url).pathname)
    if (url.includes('/finger/')) return { code: 0, data: { b_3: '3', b_4: '4' } }
    if (url.includes('/search/')) return { code: 0, data: { result: [{ bvid }], numResults: 1, numPages: 1 } }
    if (url.includes('/playurl')) return { code: 0, data: { dash: { audio: [{ codecs: 'mp4a.40.2', baseUrl: 'https://audio.bilivideo.com/test.m4a' }] } } }
    return { code: 0, data: video }
  })
  await client.prepareSearch()
  await client.search('音乐')
  await client.search('音乐')
  await client.videoContents(bvid + ':0')
  await client.playback(bvid + ':10')
  await client.playback(bvid + ':20')
  assert.equal(calls.filter(url => url.endsWith('/search/type')).length, 1)
  assert.equal(calls.filter(url => url.endsWith('/view')).length, 1)
  assert.equal(calls.filter(url => url.endsWith('/playurl')).length, 2)
  const abort = new AbortController(); abort.abort()
  await assert.rejects(client.search('音乐', 1, 20, abort.signal), /cancelled/)
  await assert.rejects(client.videoContents(bvid, abort.signal), /cancelled/)
})

test('单曲插播模式下点击 B 站多 P，仍以完整分 P 和当前 CID 建立顺序队列', async() => {
  const events = []
  const parts = video.pages.map(p => ({ songmid: bvid + ':' + p.cid, name: p.part }))
  const api = load('src/core/player/selection.ts', {
    '@/utils/musicSdk/bi': { bilibiliClient: { videoContents: async() => ({ parts }) } },
    '@/utils': { toNewMusicInfo: convert },
    '@/config/constant': { LIST_IDS: { TEMP: 'temp', PLAY_LATER: 'later' } },
    '@/store/setting/state': { default: { setting: { 'list.singlePlayMode': 'add' } } },
    '@/core/list': { setTempList: async(key, list) => events.push(['list', list.map(item => item.meta.songId)]), getListMusics: async() => [] },
    '@/store/player/action': { default: { addTempPlayList: () => { throw Error('must not insert one track') } } },
    './player': { playList: async(id, index, continuous) => events.push(['play', index, continuous]), playNext: async() => {} },
  })
  await api.playFromPage('search', [convert(parts[1])], 0)
  assert.deepEqual(JSON.parse(JSON.stringify(events)), [['list', [bvid + ':10', bvid + ':20']], ['play', 1, true]])
  events.length = 0
  await api.playFromPage('collection', parts.map(convert), 1, true)
  assert.equal(events[1][1], 1)
  assert.equal(events[1][2], true)
})

test('纯音乐标记适用于各来源，空响应、元信息、真实歌词及纯音乐同名歌不误判', () => {
  const { isInstrumental } = load('src/utils/lyricStatus.ts')
  for (const lyric of ['[00:00.00]纯音乐，请欣赏', '[ti:歌曲]\n[00:00.00]純音樂，請欣賞', 'Instrumental']) assert.equal(isInstrumental({ lyric }), true)
  for (const lyric of ['', '[ti:Instrumental]', '[00:00.00]暂无歌词', '[00:00.00]Instrumental\n[00:02.00]I love you']) assert.equal(isInstrumental({ lyric }), false)
  assert.equal(isInstrumental({ title: '夜空 (Instrumental)' }), true)
  assert.equal(isInstrumental({ title: '纯音乐爱好者的歌' }), false)
})

test('QQ 自建目标不请求公开主页和喜欢详情，接受只有 dirId 的私有歌单', async() => {
  const calls = []
  const session = { provider: 'tx', cookies: {} }
  const api = load('src/core/musicAccount/playlistTargets.ts', {
    '@/utils/qqPlaylistTarget': load('src/utils/qqPlaylistTarget.ts'),
    './qqCredentials': { getQQCredentials: () => ({ uin: '123' }) },
    './requests': {
      openAccountSession: async() => session, assertAccountSession: async() => {},
      qqRequest: async(s, query) => { calls.push(query); return { targets: { data: { v_playlist: [{ dirId: 201, dirName: '我喜欢' }, { dirId: 5, dirName: '私有歌单', tid: 0 }] } } } },
    },
    './playlists': {},
  })
  const lists = await api.getWritablePlaylists('tx')
  assert.equal(lists.length, 1)
  assert.equal(lists[0].id, 'dir:5')
  assert.deepEqual(Object.keys(calls[0]), ['targets'])
})

test('网易云与酷狗只展示当前账号可写目标，账号切换后拒绝旧结果', async() => {
  for (const provider of ['wy', 'kg']) {
    let changed = false
    const api = load('src/core/musicAccount/playlistTargets.ts', {
      '@/utils/qqPlaylistTarget': {}, './qqCredentials': {}, './requests': {},
      './playlists': {
        openPlaylistSession: async() => ({ owner: '123' }),
        assertPlaylistSession: async() => { if (changed) throw Error('account_changed') },
        getAccountPlaylists: async() => [{ id: '1', name: '我的歌单', kind: 'created', writable: true }, { id: '2', name: '别人的', kind: 'favorite', writable: false }, { id: '3', name: '不可写', kind: 'created', writable: false }],
      },
    })
    const lists = await api.getWritablePlaylists(provider)
    assert.equal(lists.length, provider == 'wy' ? 2 : 1)
    assert.equal(lists[0].id, provider == 'wy' ? '1' : 'account:123:1')
    changed = true
    await assert.rejects(api.getWritablePlaylists(provider), /account_changed/)
  }
})

 test('合集第二页加载时取消，不交付不完整播放队列', async() => {
  const { createBilibiliClient } = load('src/utils/bilibili.ts')
  const controller = new AbortController()
  const client = createBilibiliClient(async url => {
    const page = Number(new URL(url).searchParams.get('page_num'))
    if (page == 2) controller.abort()
    return { code: 0, data: { meta: { name: '合集' }, page: { total: 31, page_size: 30 }, archives: Array.from({length: page == 1 ? 30 : 1}, (_, i) => ({ bvid: 'BV' + String((page - 1) * 30 + i).padStart(10, '0'), title: 'track' })) } }
  })
  await assert.rejects(client.importCollection('https://space.bilibili.com/123/lists/456', undefined, undefined, controller.signal), /cancelled/)
})

test('QQ 目标列表与收藏前校验都遍历分页，不把 dirId 当公开 ID', async() => {
 const api=load('src/utils/qqPlaylistTarget.ts')
 const call=async(name,module,method,param)=>({v_playlist:param.offset ? [{dirId:8,dirName:'后页歌单',tid:0}] : [{dirId:201,dirName:'喜欢'},{dirId:7,dirName:'第一页',tid:123}],hasmore:param.offset?0:1})
 const lists=await api.getQQPlaylistTargets('123',call)
 assert.deepEqual(Array.from(lists, x=>x.id), ['dir:7','dir:8'])
 assert.equal((await api.resolveQQPlaylistTarget('dir:8','123',call)).dirId,8)
 assert.equal((await api.resolveQQPlaylistTarget('123','123',call)).dirId,7)
})
