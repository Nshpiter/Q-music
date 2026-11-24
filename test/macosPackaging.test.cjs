const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const afterPack = require('../build-config/build-after-pack')
const vm = require('node:vm')
const { createRequire } = require('node:module')

test('macOS 打包首次创建语言目录，使用公开 metadata 接口且可重复执行', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qmusic-macos-pack-'))
  const context = {
    electronPlatformName: 'darwin', appOutDir: directory,
    packager: { appInfo: { productFilename: 'Q-music' }, info: { metadata: {
      macLanguagesInfoPlistStrings: { en: { CFBundleName: 'Q-music' }, zh_CN: { CFBundleDisplayName: 'Q-music' } },
    } } },
  }
  await afterPack(context)
  await afterPack(context)
  assert.equal(await fs.readFile(path.join(directory, 'Q-music.app/Contents/Resources/zh_CN.lproj/InfoPlist.strings'), 'utf8'), '"CFBundleDisplayName" = "Q-music";')
})

test('非 macOS 打包不访问 Mac 专用 metadata', async () => {
  await afterPack({ electronPlatformName: 'win32' })
  await afterPack({ electronPlatformName: 'linux' })
})

test('打包清单在隔离目录中保留 SQLite 加载器的传递依赖', async () => {
  let config
  const builderSource = await fs.readFile(path.join(__dirname, '../build-config/build-pack.js'), 'utf8')
  vm.runInNewContext(builderSource, {
    process: { argv: ['node', 'build-pack', 'target=mac', 'arch=arm64', 'type=dmg'], env: {} },
    console: { log() {} },
    require: id => {
      if (id === 'electron-builder') return { build: async options => { config = options.config } }
      if (id === './steam-runtime') return require('../build-config/steam-runtime')
      if (id === './build-before-pack' || id === './build-after-pack') return () => {}
      throw Error(id)
    },
  })
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qmusic-packaged-deps-'))
  for (const name of ['bindings', 'file-uri-to-path']) {
    const entry = `node_modules/${name}`
    assert.ok(config.files.includes(entry), `打包遗漏 ${name}`)
    await fs.cp(path.join(__dirname, '..', entry), path.join(directory, entry), { recursive: true })
  }
  const packagedRequire = createRequire(path.join(directory, 'package.json'))
  for (const entry of require('../build-config/steam-runtime')) assert.ok(config.files.includes(entry), '打包遗漏 ' + entry)
  assert.equal(typeof packagedRequire('bindings'), 'function')
  assert.ok(packagedRequire('file-uri-to-path')('file:///tmp/qmusic.db').endsWith(`${path.sep}tmp${path.sep}qmusic.db`))
})
