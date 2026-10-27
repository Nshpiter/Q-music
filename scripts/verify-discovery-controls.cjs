const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, dependencies = {}) {
  const context = { exports: {}, require: id => {
    if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`)
    return dependencies[id]
  } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, context)
  return context.exports
}

const { getDailyRefreshAction } = load('core/musicAccount/dailyPolicy.ts')

test('三个平台返回的个人推荐均不显示换一批，QQ 雷达兜底也不伪装可随机刷新', () => {
  for (const kind of ['official_daily', 'radar', 'netease_daily', 'kugou_daily']) {
    for (const reason of ['', 'official_unavailable']) {
      assert.equal(getDailyRefreshAction({ kind, reason }), undefined)
    }
  }
  assert.equal(getDailyRefreshAction(), undefined, '加载完成前不显示错误的操作')
})

test('本地推荐可换一批，平台请求失败保留可恢复的重试操作', () => {
  assert.equal(getDailyRefreshAction({ kind: 'local', reason: 'login_required' }), 'shuffle')
  assert.equal(getDailyRefreshAction({ kind: 'local', reason: '' }), 'shuffle')
  for (const reason of ['unavailable', 'official_unavailable']) assert.equal(getDailyRefreshAction({ kind: 'local', reason }), 'retry')
})

test('新安装和旧设置合并均默认关闭液态玻璃，主动开启的偏好能保存', () => {
  const defaults = load('config/defaultSetting.ts')
  const settings = load('config/setting.ts', {
    '@/config/constant': {}, '@/config/defaultSetting': defaults, '@/plugins/storage': {},
    './migrateSetting': {}, '@/store/setting/state': { default: { setting: defaults.default } }, './migrate': {}, '@/utils/tools': {},
  })
  assert.equal(settings.updateSetting(null, true).setting['theme.liquidGlass'], false)
  const previous = { ...defaults.default, 'theme.performanceMode': false }
  delete previous['theme.liquidGlass']
  const upgraded = settings.updateSetting(previous, true).setting
  assert.equal(upgraded['theme.liquidGlass'], false)
  assert.equal(upgraded['theme.performanceMode'], false, '不顺带禁用封面和交互动效')
  assert.equal(settings.updateSetting({ ...upgraded, 'theme.liquidGlass': true }, true).setting['theme.liquidGlass'], true)
})
