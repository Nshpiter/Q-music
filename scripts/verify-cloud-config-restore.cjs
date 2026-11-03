const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
function load(file, deps) {
  const context = { exports: {}, require: id => deps[id] }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, context)
  return context.exports
}
const protocol = load('src/utils/cloudSnapshot.ts', {})
const defaults = { 'player.playQuality': '128k' }
const selection = { settings: true, sources: true, accounts: true }
function setup() {
  const writes = []
  let config = { prefix: 'test' }
  const state = { setting: { ...defaults } }
  const apis = []
  const code = '/* @name Fixture */\n// not executed'
  const snapshot = { format: 'qmusic-config', version: 1, platform: 'desktop', createdAt: Date.now(), settings: { 'player.playQuality': 'flac' }, sources: [{ id: 'pc-id', name: 'Fixture', script: code }], sourceSelection: { primary: 'pc-id', backups: ['pc-id'] }, accounts: { wy: { MUSIC_U: 'test-only-cookie' } } }
  const module = load('src/core/cloudConfigBackup.ts', {
    'react-native': { NativeModules: { MusicCredentialModule: { restoreNeteaseCookies: async() => writes.push('account') } } },
    '@/config/defaultSetting': { __esModule: true, default: defaults },
    '@/store/setting/state': { __esModule: true, default: state },
    './common': { updateSetting: data => { Object.assign(state.setting, data); writes.push('settings') }, persistSetting: async() => writes.push('persisted') },
    '@/utils/data': { getUserApiList: async() => apis, getUserApiScript: async() => code, addUserApi: async() => { const item = { id: 'phone-id', name: 'Fixture' }; apis.push(item); writes.push('source'); return item } },
    './userApi': { setUserApiList: () => {} },
    './musicAccount/cookies': {}, './musicAccount/kugou': {}, './musicAccount/qqImportedSession': {},
    './musicAccount/cache': { clearOfficialUrlCache: () => writes.push('urls-cleared') },
    './musicAccount/daily': { clearDailyCache: () => writes.push('daily-cleared') },
    '@/utils/cloudSnapshot': protocol,
    './cloudLibrary': { getCloudConfig: async() => config, readCloudBackup: async() => JSON.stringify(snapshot) },
  })
  return { module, writes, state, snapshot, switchConnection: () => { config = { prefix: 'other' } } }
}
test('安卓恢复 PC 快照：音源重映射、账号缓存刷新、设置等待落盘且重复导入去重', async() => {
  const { module, writes, state } = setup()
  const preview = await module.previewCloudConfig('id', 'password')
  assert.equal(writes.length, 0)
  await preview.restore(selection)
  assert.equal(state.setting['common.apiSource'], 'phone-id')
  assert.equal(state.setting['player.playQuality'], 'flac')
  assert.deepEqual(writes, ['source', 'account', 'urls-cleared', 'daily-cleared', 'settings', 'persisted'])
  await assert.rejects(preview.restore(selection), /过期/)
  await (await module.previewCloudConfig('id', 'password')).restore({ ...selection, accounts: false })
  assert.equal(writes.filter(value => value === 'source').length, 1)
})
test('安卓预览绑定连接，连接切换或选择不存在内容均不写入', async() => {
  const first = setup()
  const preview = await first.module.previewCloudConfig('id', 'password')
  first.switchConnection()
  await assert.rejects(preview.restore(selection), /连接/)
  assert.equal(first.writes.length, 0)
  const second = setup()
  delete second.snapshot.accounts
  await assert.rejects((await second.module.previewCloudConfig('id', 'password')).restore({ settings: false, sources: false, accounts: true }), /不包含勾选/)
  assert.equal(second.writes.length, 0)
})
