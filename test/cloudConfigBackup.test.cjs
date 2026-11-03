const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '..')
function load(relative, deps = {}, extra = {}) {
  const context = { exports: {}, Buffer, console, ...extra, require: id => id in deps ? deps[id] : require(id) }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, context)
  return context.exports
}
const protocol = load('src/common/utils/cloudSnapshot.ts')
const cipher = load('src/main/modules/winMain/cloudCipher.ts')
const password = '测试配置密钥-12345'
const script = '/*\n * @name Test\n */\n// fixture only'

function setup() {
  let config = { prefix: 'test', provider: 'webdav' }
  const objects = new Map()
  const apiList = [{ id: 'old-id', name: 'Test' }]
  const scripts = new Map([['old-id', script]])
  const writes = []
  const defaults = { 'player.playQuality': '128k', 'common.apiSource': '', 'common.apiBackupSources': [] }
  const appSetting = { ...defaults, 'player.playQuality': 'flac', 'common.apiSource': 'old-id', 'common.apiBackupSources': ['old-id'] }
  const module = load('src/main/modules/winMain/cloudConfigBackup.ts', {
    electron: { app: { getPath: () => os.tmpdir() } },
    '@common/defaultSetting': { default: defaults, __esModule: true },
    '@common/utils/cloudSnapshot': protocol,
    '@main/modules/userApi': { getApiList: () => apiList, importApi: async code => { const id = 'new-id'; apiList.push({ id, name: 'Test' }); scripts.set(id, code); writes.push('source'); return { apiInfo: { id } } } },
    '@main/modules/userApi/utils': { getScript: async id => scripts.get(id) },
    './cloudLibrary': { readCloudConfig: () => config },
    './cloudStorage': { createCloudStorage: () => ({ list: async prefix => [...objects.keys()].filter(key => key.startsWith(prefix)), put: async(key, file) => objects.set(key, await fs.promises.readFile(file)), get: async(key, file) => { if (!objects.has(key)) throw Error('404'); await fs.promises.writeFile(file, objects.get(key)) } }) },
    './cloudCipher': cipher,
    './musicAccount': { exportSnapshotAccounts: async() => ({ wy: { MUSIC_U: 'test-private-cookie' } }), restoreSnapshotAccounts: async value => writes.push(['accounts', value]) },
  }, { global: { lx: { appSetting, event_app: { update_config: setting => writes.push(['settings', setting]) } } } })
  return { module, objects, writes, apiList, scripts, changeConnection: () => { config = { ...config, prefix: 'other' } } }
}

test('上传只写加密快照；先预览再恢复，去重音源并应用主备映射', async() => {
  const { module, objects, writes, apiList, scripts } = setup()
  const selected = { settings: true, sources: true, accounts: true }
  const id = await module.uploadConfigBackup(password, selected)
  const encrypted = [...objects.values()][0]
  assert.equal(encrypted.subarray(0, 4).toString(), 'QMCE')
  assert.ok(!encrypted.includes(Buffer.from('test-private-cookie')))
  assert.ok(!encrypted.includes(Buffer.from(script)))
  assert.deepEqual(Array.from(await module.listConfigBackups()), [id])
  const preview = await module.previewConfigBackup(id, password)
  assert.equal(preview.settings, 1)
  assert.equal(writes.length, 0)
  apiList.length = 0; scripts.clear()
  await module.restoreConfigBackup(preview.token, selected)
  assert.equal(writes[0], 'source')
  const settings = writes.find(item => Array.isArray(item) && item[0] == 'settings')[1]
  assert.equal(settings['common.apiSource'], 'new-id')
  assert.equal(settings['common.apiBackupSources'][0], 'new-id')
  await assert.rejects(module.restoreConfigBackup(preview.token, selected), /过期/)
  const second = await module.previewConfigBackup(id, password)
  await module.restoreConfigBackup(second.token, selected)
  assert.equal(writes.filter(item => item == 'source').length, 1)
})

test('错误密钥、损坏密文、连接切换、未预览和关闭选择均不写本地', async() => {
  const { module, objects, writes, changeConnection } = setup()
  const selected = { settings: true, sources: false, accounts: false }
  const id = await module.uploadConfigBackup(password, selected)
  await assert.rejects(module.previewConfigBackup(id, 'wrong-password'), /密钥/)
  await assert.rejects(module.restoreConfigBackup('invented', selected), /过期/)
  const preview = await module.previewConfigBackup(id, password)
  changeConnection()
  await assert.rejects(module.restoreConfigBackup(preview.token, selected), /连接/)
  assert.equal(writes.length, 0)
  const bytes = [...objects.values()][0]; bytes[45] ^= 1
  assert.throws(() => cipher.decryptBuffer(bytes, password))
})

test('预览后只恢复勾选项，不替换未选择的账号或音源', async() => {
  const { module, writes } = setup()
  const id = await module.uploadConfigBackup(password, { settings: true, sources: true, accounts: true })
  const preview = await module.previewConfigBackup(id, password)
  await module.restoreConfigBackup(preview.token, { settings: true, sources: false, accounts: false })
  assert.equal(writes.length, 1)
  assert.equal(writes[0][0], 'settings')
  assert.equal(writes[0][1]['common.apiSource'], undefined)
})

test('勾选了备份里不存在的账号时，明确失败且不修改配置', async() => {
  const { module, writes } = setup()
  const id = await module.uploadConfigBackup(password, { settings: true, sources: false, accounts: false })
  const preview = await module.previewConfigBackup(id, password)
  await assert.rejects(module.restoreConfigBackup(preview.token, { settings: false, sources: false, accounts: true }), /不包含勾选/)
  assert.equal(writes.length, 0)
})

test('Android 原生 AES-GCM/PBKDF2 与 PC 双向互通，中文密钥及损坏数据验证', context => {
  const nativePath = path.join(process.env.QMUSIC_ANDROID_SOURCE || path.join(root, '../q-music-mobile-v0323'), 'android/app/src/main/java/cn/toside/music/mobile/utils/CloudLibraryModule.java')
  if (!fs.existsSync(nativePath)) { context.skip('独立桌面检出不包含安卓源码；跨端验证在同时检出两端时执行'); return }
  const localJava = 'D:/Program Files/Java/jdk-21/bin/java.exe'
  const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : fs.existsSync(localJava) ? localJava : 'java'
  const native = fs.readFileSync(nativePath, 'utf8')
  const methods = native.slice(native.indexOf('  private SecretKey cloudKey('), native.indexOf('  private void encryptFile('))
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qmusic-config-crypto-'))
  const file = path.join(directory, 'CloudConfigCrypto.java')
  fs.writeFileSync(file, `import java.nio.*; import java.nio.charset.*; import java.security.*; import java.io.*; import javax.crypto.*; import javax.crypto.spec.*; import java.util.Base64;
class CloudConfigCrypto {
private static final byte[] MAGIC = new byte[]{'Q','M','C','E',1}; private static final int KDF_ROUNDS = 250000; private final SecureRandom random = new SecureRandom();
${methods}
public static void main(String[] args) throws Exception { CloudConfigCrypto c = new CloudConfigCrypto(); byte[] data = Base64.getDecoder().decode(args[2]); byte[] result = args[0].equals("encrypt") ? c.encryptBytes(data,args[1]) : c.decryptBytes(data,args[1]); System.out.print(Base64.getEncoder().encodeToString(result)); }
}`)
  const run = (mode, bytes) => spawnSync(java, [file, mode, password, bytes.toString('base64')], { encoding: 'utf8', timeout: 30000 })
  try {
    const plain = Buffer.from(JSON.stringify({ format: 'qmusic-config', text: '中文 🎵 配置' }))
    const encoded = cipher.encryptBuffer(plain, password)
    const decrypted = run('decrypt', encoded)
    assert.equal(decrypted.status, 0, decrypted.stderr)
    assert.deepEqual(Buffer.from(decrypted.stdout, 'base64'), plain)
    const encrypted = run('encrypt', plain)
    assert.equal(encrypted.status, 0, encrypted.stderr)
    assert.deepEqual(cipher.decryptBuffer(Buffer.from(encrypted.stdout, 'base64'), password), plain)
    encoded[40] ^= 1
    assert.notEqual(run('decrypt', encoded).status, 0)
  } finally { fs.rmSync(directory, { recursive: true, force: true }) }
})
