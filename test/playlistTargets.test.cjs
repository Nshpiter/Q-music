const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const utils = fs.existsSync(path.join(root, 'src/core/musicAccount')) ? 'src/utils' : 'src/common/utils'
const load = name => {
  const context = { exports: {}, setTimeout, Error }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, utils, name + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context)
  return context.exports
}

test('QQ 指定公开歌单必须映射到当前账号的目录 ID；不接受他人歌单', async() => {
  const { resolveQQPlaylistTarget, isQQPlaylistId, checkQQPlaylistSong } = load('qqPlaylistTarget')
  const call = async() => ({ v_playlist: [{ tid: '987654321', dirId: 5 }, { tid: '123456789', dirId: 201 }] })
  const target = await resolveQQPlaylistTarget('987654321', '100', call)
  assert.equal(target.dirId, 5)
  assert.equal(target.dissId, 987654321)
  assert.equal((await resolveQQPlaylistTarget('dir:201', '100', call)).dirId, 201)
  await assert.rejects(resolveQQPlaylistTarget('999', '100', call), /unsupported/)
  for (const id of ['0', 'dir:0', '1.2', '9007199254740992', '', null]) assert.equal(isQQPlaylistId(id), false)
  let calls = 0
  const read = async(name, module, method, data) => {
    calls++
    assert.equal(data.disstid, 987654321)
    assert.equal(data.dirid, 0)
    return { songlist: [{ mid: data.song_begin ? 'target' : 'other' }], total_song_num: 2 }
  }
  assert.equal(await checkQQPlaylistSong(target, 'target', '', read), true)
  assert.equal(calls, 2)
  await assert.rejects(checkQQPlaylistSong(target, 'target', '', async() => ({ songlist: [], total_song_num: 2 })), /unavailable/)
})

test('网易云只写选中的自建歌单，分页核验权限并在同一歌单回查', async() => {
  const { createNeteaseFavoriteClient } = load('neteaseFavorite')
  const contents = new Map([['10', []], ['20', []]])
  const writes = []
  const client = createNeteaseFavoriteClient(async() => ({
    assertSession: async() => {},
    request: async(route, data) => {
      if (route == 'w/nuser/account/get') return { code: 200, account: { id: 1 } }
      if (route == 'user/playlist') return { code: 200, playlist: [{ id: 10, creator: { userId: 1 } }, { id: 20, creator: { userId: 1 } }, { id: 30, creator: { userId: 2 } }] }
      if (route == 'playlist/manipulate/tracks') { writes.push(data.pid); contents.set(data.pid, [{ id: 456 }]); return { code: 200 } }
      return { code: 200, playlist: { id: data.id, creator: { userId: 1 }, trackIds: contents.get(data.id), trackCount: contents.get(data.id).length } }
    },
  }), async() => {})
  const results = await Promise.all(['10', '20'].map(playlistId => client({ songId: '456', playlistId })))
  assert.ok(results.every(r => r.status == 'added'))
  assert.deepEqual(writes.sort(), ['10', '20'])
  assert.equal((await client({ songId: '456', playlistId: '30' })).status, 'unsupported')
  assert.equal((await client({ songId: '456', playlistId: '10', action: 'check' })).status, 'added')
  assert.equal(writes.length, 2)
})

test('酷狗明确只读/未知权限的歌单不能写入；并发不同目标不会合并', async() => {
  const { createKugouFavoriteClient } = load('kugouFavorite')
  const contents = new Map([['10', []], ['20', []]])
  const writes = []
  const hash = 'A'.repeat(32)
  const client = createKugouFavoriteClient(async() => ({
    assertSession: async() => {},
    getFavorites: async() => [{ id: '10', writable: true }, { id: '20', writable: true }, { id: '30', writable: false }, { id: '40', kind: 'created' }],
    getHashes: async id => contents.get(id),
    addSong: async id => { writes.push(id); contents.set(id, [hash]) },
  }), async() => {})
  const results = await Promise.all(['10', '20'].map(playlistId => client({ hash, name: 'test', playlistId })))
  assert.ok(results.every(r => r.status == 'added'))
  assert.deepEqual(writes.sort(), ['10', '20'])
  for (const playlistId of ['30', '40', '99']) assert.equal((await client({ hash, name: 'test', playlistId })).status, 'unsupported')
  assert.equal(writes.length, 2)
})

test('QQ 目录 201 映射为账号歌单真实 tid，230 首分页不依赖旧主页', async() => {
  const { resolveQQPlaylistReadTarget, getQQPlaylistReadPage } = load('qqPlaylistTarget')
  const pages = []
  const call = async(name, module, method, param) => {
    if (name == 'targets') return { v_playlist: [{ dirId: 201, tid: '987654321', songNum: 230 }], bFinish: true }
    assert.equal(module, 'music.srfDissInfo.aiDissInfo')
    assert.equal(method, 'uniform_get_Dissinfo')
    assert.equal(param.disstid, 987654321)
    assert.equal(param.dirid, 0)
    assert.equal('enc_host_uin' in param, false)
    pages.push(param.song_begin)
    return { code: 0, total_song_num: 230, songlist: Array.from({ length: Math.min(100, 230 - param.song_begin) }, (_, i) => ({ mid: 'song' + (param.song_begin + i) })) }
  }
  const target = await resolveQQPlaylistReadTarget('dir:201', '123', call)
  let count = 0
  while (count < 230) count += (await getQQPlaylistReadPage(target, '', count, call)).songlist.length
  assert.equal(count, 230)
  assert.deepEqual(pages, [0, 100, 200])
})

test('QQ 新接口不可用才回退同一 tid；过期、换号、取消与缺页不回退', async() => {
  const { getQQPlaylistReadPage } = load('qqPlaylistTarget')
  const calls = []
  const target = { dirId: 201, dissId: 900 }
  const result = await getQQPlaylistReadPage(target, '', 100, async(name, module, method, param) => {
    calls.push(method)
    assert.equal(param.disstid, 900)
    assert.equal(param.song_begin, 100)
    if (method == 'uniform_get_Dissinfo') throw Error('unavailable')
    return { code: 0, songlist: [{ mid: 'a' }], total_song_num: 101 }
  })
  assert.equal(result.songlist[0].mid, 'a')
  assert.deepEqual(calls, ['uniform_get_Dissinfo', 'CgiGetDiss'])
  for (const reason of ['login_required', 'account_changed', 'cancelled', 'incomplete']) {
    let reads = 0
    await assert.rejects(getQQPlaylistReadPage(target, '', 0, async() => { reads++; throw Error(reason) }), new RegExp(reason))
    assert.equal(reads, 1)
  }
  let reads = 0
  await assert.rejects(getQQPlaylistReadPage(target, '', 0, async() => { reads++; return { code: 104401, songlist: [] } }), /login_required/)
  assert.equal(reads, 1, '内层错误不能被 code=0 的外层掩盖')
  await assert.rejects(getQQPlaylistReadPage(target, '', 0, async() => ({ code: 0, total_song_num: 230 })), /incomplete/)
  await assert.rejects(getQQPlaylistReadPage({ ...target, count: 230 }, '', 0, async() => ({ code: 0, total_song_num: 0, songlist: [] })), /incomplete/, '非空目录不能被异常空响应清空')
})

test('QQ 公共 ID 不误当目录 ID；无 tid 的旧目录保留经账号标识读取的兼容路径', async() => {
  const { resolveQQPlaylistReadTarget, getQQPlaylistReadPage } = load('qqPlaylistTarget')
  const direct = await resolveQQPlaylistReadTarget('123456789', '123', async() => { throw Error('unexpected account request') })
  assert.equal(direct.dissId, 123456789)
  assert.equal(direct.dirId, 0)
  const old = await resolveQQPlaylistReadTarget('dir:201', '123', async() => ({ v_playlist: [{ dirId: 201 }] }))
  await getQQPlaylistReadPage(old, 'encrypted', 0, async(name, module, method, param) => {
    assert.equal(method, 'CgiGetDiss')
    assert.equal(param.disstid, 0)
    assert.equal(param.dirid, 201)
    assert.equal(param.enc_host_uin, 'encrypted')
    return { songlist: [], total_song_num: 0 }
  })
  await assert.rejects(getQQPlaylistReadPage(old, '', 0, async() => { throw Error('must not request with unknown owner') }), /unavailable/)
})
