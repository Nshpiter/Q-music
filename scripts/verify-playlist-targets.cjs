const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const utils = fs.existsSync(path.join(root, 'src/core/musicAccount')) ? 'src/utils' : 'src/common/utils'
const load = name => {
  const context = { exports: {}, setTimeout }
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
