const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const root = path.resolve(__dirname, '..')
const mobile = fs.existsSync(path.join(root, 'src/core/player/session.ts'))
function load(file, dependencies = {}) {
  const context = { exports: {}, Error, require: id => { assert.ok(id in dependencies, 'Missing mock: ' + id); return dependencies[id] } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, context)
  return context.exports
}
const plain = value => JSON.parse(JSON.stringify(value))
const track = id => ({ id, source: 'bi', name: id, meta: { songId: id } })

test('B站新建导入歌单保存可刷新来源；失败不会建立空目录，追加到已有目录不改绑定', async() => {
  const saved = [], additions = []
  let failed = false
  const client = { importCollection: async() => { if (failed) throw Error('incomplete'); return { list: [track('new')], name: 'folder', total: 1 } } }
  const create = async data => saved.push(plain(data))
  const add = async(...args) => additions.push(args)
  const utils = { toNewMusicInfo: row => row, filterMusicList: rows => rows }
  const deps = mobile ? {
    '@/config/constant': { LIST_IDS: { LOVE: 'love' } }, '@/core/list': { createList: create, addListMusics: add }, '@/core/songlist': {},
    '@/store/setting/state': { setting: { 'list.addMusicLocationType': 'bottom' } }, '@/utils': utils, '@/utils/musicSdk/bi': { bilibiliClient: client },
  } : {
    '@common/constants': { LIST_IDS: { LOVE: 'love' } }, '@renderer/utils': utils, '@renderer/utils/musicSdk': {}, '@renderer/store/songList/action': {},
    '@renderer/store/list/action': { createUserList: create, addListMusics: add }, '@renderer/utils/data': {}, '@common/utils/playlistMerge': {},
    '@common/utils/qqPlaylist': {}, '@renderer/store/list/state': { userLists: [] }, '@renderer/utils/ipc': {},
    '@renderer/utils/musicSdk/wy/musicDetail': {}, '@renderer/utils/musicSdk/tx/musicInfo': {}, '@renderer/utils/musicSdk/bi': { bilibiliClient: client },
  }
  const api = load(mobile ? 'src/screens/Home/Views/Mylist/importPlaylist.ts' : 'src/renderer/views/List/MyList/importPlaylist.ts', deps)
  const params = { source: 'bi', text: ' ml123 ', listName: '', target: 'new', currentListId: 'existing' }
  await api.importExternalPlaylist(params)
  assert.equal(saved[0].source, 'bi'); assert.equal(saved[0].sourceListId, 'ml123'); assert.equal(saved[0].name, 'folder')
  await api.importExternalPlaylist({ ...params, target: 'current' })
  assert.equal(saved.length, 1); assert.equal(additions.length, 1); assert.equal(additions[0][0], 'existing')
  failed = true
  await assert.rejects(api.importExternalPlaylist(params), /playlist_incomplete/)
  assert.equal(saved.length, 1)
})

test('B站刷新走公开收藏夹完整性校验，保留手工歌曲；请求失败不覆盖已有歌单', async() => {
  const target = { id: 'local', name: 'folder', source: 'bi', sourceListId: 'ml123' }
  const lists = [target], saved = [], settings = { local: { sourceSnapshot: { sourceKey: 'bi:ml123', musicKeys: ['bi:old'] } } }
  let failed = false, requested = ''
  const client = { importCollection: async input => { requested = input; if (failed) throw Error('incomplete'); return { list: [track('new')] } } }
  const data = { getListUpdateInfo: async() => settings, setListUpdateTime: async() => {}, setListSourceSnapshot: async(id, value) => { settings[id].sourceSnapshot = value } }
  const merge = load(mobile ? 'src/utils/playlistMerge.ts' : 'src/common/utils/playlistMerge.ts')
  const listApi = { setFetchingListStatus() {}, getListMusics: async() => [track('old'), { id: 'manual', source: 'wy', meta: { songId: 'manual' } }], overwriteListMusics: async(...args) => { saved.push(args) } }
  const deps = mobile ? {
    '@/utils/data': data, './list': listApi, '@/utils/playlistMerge': merge, '@/core/songlist': {}, '@/core/leaderboard': {}, './musicAccount/playlists': {},
    './musicAccount/playlistSync': { parseAccountSourceId: () => null }, '@/store/list/state': { userList: lists }, './musicAccount/syncState': { setPlaylistSyncState() {} },
    '@/utils/musicSdk/bi': { bilibiliClient: client }, '@/utils': { toNewMusicInfo: row => row },
  } : {
    '@common/utils/vueTools': { reactive: value => value }, '@renderer/utils/data': data, '@common/utils/playlistMerge': merge,
    './action': listApi, './state': { userLists: lists }, '@renderer/store/songList/action': {}, '@renderer/store/leaderboard/action': {},
    '@renderer/utils/musicSdk/bi': { bilibiliClient: client }, '@renderer/utils': { toNewMusicInfo: row => row },
  }
  const api = load(mobile ? 'src/core/syncSourceList.ts' : 'src/renderer/store/list/syncSourceList.ts', deps)
  await api.default(target)
  assert.equal(requested, 'ml123')
  const result = mobile ? saved[0][1] : saved[0][0].musicInfos
  assert.deepEqual(Array.from(result, row => row.id).sort(), ['manual', 'new'])
  failed = true
  await assert.rejects(api.default(target), /incomplete/)
  assert.equal(saved.length, 1)
})
