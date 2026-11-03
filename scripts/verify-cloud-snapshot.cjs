const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const mobile = fs.existsSync(path.join(root, 'src/core/cloudConfigBackup.ts'))
const file = path.join(root, mobile ? 'src/utils/cloudSnapshot.ts' : 'src/common/utils/cloudSnapshot.ts')
const context = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
const { parseCloudSnapshot, portableSettings, restoreSnapshotSources, snapshotKey, snapshotFileId, snapshotSummary } = context.exports
const plain = value => JSON.parse(JSON.stringify(value))
const base = () => ({ format: 'qmusic-config', version: 1, platform: 'desktop', createdAt: 1793600000000, settings: { 'player.playQuality': 'flac' } })
const script = name => `/*\n * @name ${name}\n */\nconsole.log('test');`

test('两端使用同一协议源码，格式版本、超限和路径穿越均被拒绝', () => {
  const other = path.join(root, mobile ? '../lx-music-desktop/src/common/utils/cloudSnapshot.ts' : '../q-music-mobile-v0323/src/utils/cloudSnapshot.ts')
  if (fs.existsSync(other)) assert.equal(fs.readFileSync(file, 'utf8'), fs.readFileSync(other, 'utf8'))
  assert.equal(parseCloudSnapshot(JSON.stringify(base())).platform, 'desktop')
  for (const value of [{ ...base(), version: 2 }, { ...base(), createdAt: -1 }, { ...base(), platform: 'unknown' }, { ...base(), settings: [] }]) assert.throws(() => parseCloudSnapshot(JSON.stringify(value)))
  assert.throws(() => parseCloudSnapshot('x'.repeat(8 * 1024 * 1024 + 1)))
  const id = '1793600000000-0123456789abcdef.qmc'
  assert.equal(snapshotKey('/music/', id), `music/qmusic-cloud/config/v1/${id}`)
  assert.equal(snapshotFileId(snapshotKey('music', id)), id)
  for (const id of ['../secret', '/secret', 'meta.qmc', '1793600000000-0123456789abcdef.qmc/evil']) assert.throws(() => snapshotKey('', id))
})

test('跨设备只恢复兼容偏好，路径、权限、音源 ID、网络凭证和非法值均不混入设置', () => {
  const defaults = { 'player.playQuality': '128k', 'player.playbackRate': 1, 'player.startupAutoPlay': false, 'theme.appearance': null, 'theme.dayStart': '07:00', 'list.singlePlayMode': 'replace', 'download.savePath': '', 'common.apiSource': '' }
  const source = { 'player.playQuality': 'flac', 'player.playbackRate': 99, 'player.startupAutoPlay': true, 'theme.appearance': 'system', 'theme.dayStart': '25:12', 'list.singlePlayMode': 'replace', 'download.savePath': 'C:/private', 'common.apiSource': 'old', 'sync.password': 'secret', '__proto__': { polluted: true } }
  assert.deepEqual(plain(portableSettings(source, defaults)), { 'player.playQuality': 'flac', 'theme.appearance': 'system', 'list.singlePlayMode': 'replace' })
  assert.equal(portableSettings({ 'theme.dayStart': '06:15' }, defaults)['theme.dayStart'], '06:15')
  assert.equal(portableSettings({ 'theme.appearance': null }, defaults)['theme.appearance'], null)
  assert.equal(portableSettings({ 'player.playQuality': 'invalid' }, defaults)['player.playQuality'], undefined)
})

test('只接收音乐服务凭证，不接受通用 QQ Cookie、注入字符或损坏账号', () => {
  const snapshot = base()
  snapshot.accounts = { tx: { qqmusic_uin: '123', qqmusic_key: 'test-key', login_type: '1' }, wy: { MUSIC_U: 'test-token' }, kg: { userId: '123', token: 'test-token', mid: 'a'.repeat(32) } }
  assert.equal(Object.keys(parseCloudSnapshot(JSON.stringify(snapshot)).accounts).length, 3)
  for (const accounts of [{ tx: { ...snapshot.accounts.tx, skey: 'general-qq' } }, { wy: { MUSIC_U: 'foo; injected=true' } }, { wy: { MUSIC_U: '' } }, { kg: { ...snapshot.accounts.kg, mid: 'bad' } }, { tx: { ...snapshot.accounts.tx, qqmusic_uin: '0' } }]) assert.throws(() => parseCloudSnapshot(JSON.stringify({ ...snapshot, accounts })))
})

test('音源按脚本内容合并并映射主备顺序，连续恢复不重复添加也不删除现有源', async() => {
  const snapshot = parseCloudSnapshot(JSON.stringify({ ...base(), sources: [{ id: 'old-a', name: 'A', script: script('A') }, { id: 'old-b', name: 'B', script: script('B') }], sourceSelection: { primary: 'old-b', backups: ['old-a', 'old-a'] } }))
  const existing = [{ id: 'local-a', name: 'A', script: script('A') }, { id: 'local-extra', name: 'X', script: script('X') }]
  const added = []
  const importer = async code => { const id = `new-${added.length}`; added.push(code); existing.push({ id, name: 'B', script: code }); return id }
  assert.deepEqual(plain(await restoreSnapshotSources(snapshot, existing, importer)), { 'common.apiSource': 'new-0', 'common.apiBackupSources': ['local-a'] })
  await restoreSnapshotSources(snapshot, existing, importer)
  assert.equal(added.length, 1)
  assert.ok(existing.some(source => source.id == 'local-extra'))
})

test('损坏源及悬空主备引用在恢复前拒绝；预览不暴露脚本和 Cookie', () => {
  for (const sources of [[{ id: 'a', name: 'A', script: 'not-a-script-header' }], [{ id: 'a', name: 'A', script: script('A') }, { id: 'a', name: 'B', script: script('B') }]]) {
    assert.throws(() => parseCloudSnapshot(JSON.stringify({ ...base(), sources, sourceSelection: { primary: 'a', backups: [] } })))
  }
  assert.throws(() => parseCloudSnapshot(JSON.stringify({ ...base(), sources: [], sourceSelection: { primary: 'missing', backups: [] } })))
  const data = parseCloudSnapshot(JSON.stringify({ ...base(), accounts: { wy: { MUSIC_U: 'private-token' } } }))
  const summary = JSON.stringify(snapshotSummary(data, { 'player.playQuality': '128k' }))
  assert.ok(!summary.includes('private-token'))
  assert.match(summary, /wy/)
})
