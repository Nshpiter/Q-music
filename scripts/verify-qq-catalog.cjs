const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.join(__dirname, '..')
const source = fs.existsSync(path.join(root, 'src/core/musicAccount')) ? 'src/utils' : 'src/common/utils'
const context = { exports: {}, Error }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, source, 'qqAccountCatalog.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context)
const { getQQAccountCatalog } = context.exports
const owned = [{ dirId: 201, dirName: '我喜欢', songNum: 12 }, { dirId: 2, tid: '300', dirName: '自建', songNum: 3 }]

test('QQ 缺少主页标识仍分页读完收藏，正常音乐接口不触发回退', async() => {
  const offsets = []
  const web = async offset => {
    offsets.push(offset)
    return { v_list: Array.from({ length: Math.min(100, 205 - offset) }, (_, i) => ({ dissid: String(1000 + offset + i) })), total: 205, hasmore: offset < 200 }
  }
  const result = await getQQAccountCatalog('123', '', async() => ({ v_playlist: owned }), web)
  assert.equal(result.favorite.length, 205)
  assert.equal(result.warnings.length, 0)
  assert.deepEqual(offsets, [0, 100, 200])
  await getQQAccountCatalog('123', 'encrypted', async name => name == 'created' ? { v_playlist: owned } : { v_list: [] }, async() => { throw Error('must not fall back') })
})

test('QQ 收藏接口中途不可用时从零回退，不混合两条接口的结果', async() => {
  const offsets = []
  const result = await getQQAccountCatalog('123', 'encrypted', async(name, module, method, param) => {
    if (name == 'created') return { v_playlist: owned }
    if (param.offset) throw Error('network unavailable')
    return { v_list: [{ tid: '999' }], hasmore: 1 }
  }, async offset => {
    offsets.push(offset)
    return { v_list: [{ dissid: '500' }], total: 1, hasmore: 0 }
  })
  assert.deepEqual(offsets, [0])
  assert.equal(result.favorite.map(row => row.dissid).join(','), '500')
  assert.equal(result.warnings.length, 0)
})

test('QQ 收藏回退不能吞掉登录失效、账号变化、取消及不完整数据', async() => {
  for (const reason of ['login_required', 'account_changed', 'cancelled', 'incomplete']) {
    let fallbackCalls = 0
    await assert.rejects(getQQAccountCatalog('123', 'encrypted', async name => {
      if (name == 'created') return { v_playlist: owned }
      throw Error(reason)
    }, async() => { fallbackCalls++; return { v_list: [] } }), new RegExp(reason))
    assert.equal(fallbackCalls, 0)
  }
  for (const pages of [
    [{ v_list: [{ tid: '1' }], total: 2, hasmore: 0 }],
    [{ v_list: [{ tid: '1' }], total: 0, hasmore: 0 }],
    [{ v_list: [{ tid: '1' }], total: 2, hasmore: 1 }, { v_list: [{ tid: '2' }], total: 3, hasmore: 0 }],
    [{ v_list: [{ tid: '1' }], hasmore: 1 }, { v_list: [{ tid: '1' }], hasmore: 0 }],
  ]) {
    await assert.rejects(getQQAccountCatalog('123', '', async() => ({ v_playlist: owned }), async() => pages.shift()), /incomplete/)
  }
  const partial = await getQQAccountCatalog('123', '', async() => ({ v_playlist: owned }), async() => { throw Error('network unavailable') })
  assert.equal(partial.created.length, 2)
  assert.equal(partial.warnings.join(','), 'favorite')
  const missingLiked = await getQQAccountCatalog('123', '', async() => ({ v_playlist: [owned[1]] }), async() => ({ v_list: [], total: 0 }))
  assert.equal(missingLiked.warnings.join(','), 'liked')
})

test('QQ 自建列表已提供我喜欢时，不额外请求歌曲详情', async() => {
  const calls = []
  const result = await getQQAccountCatalog('123', 'encrypted', async(name) => {
    calls.push(name)
    if (name == 'created') return { v_playlist: owned, bFinish: true }
    if (name == 'favorite') return { v_list: [], hasmore: 0 }
    throw Error('unexpected liked request')
  })
  assert.deepEqual(calls, ['created', 'favorite'])
  assert.equal(result.created[0].songNum, 12)
  assert.equal(result.warnings.length, 0)
})

test('QQ 主页或收藏接口暂时失败时保留自建歌单，并明确部分结果', async() => {
  for (const encrypted of ['', 'encrypted']) {
    const result = await getQQAccountCatalog('123', encrypted, async(name) => {
      if (name == 'created') return { v_playlist: owned }
      throw Error('network unavailable')
    })
    assert.equal(result.created.length, 2)
    assert.equal(result.favorite.length, 0)
    assert.equal(result.warnings.join(','), encrypted ? 'favorite' : 'profile')
  }
})

test('QQ 空收藏仅在平台明确声明总数为零时允许省略数组', async() => {
  for (const data of [{ total: 0, hasmore: 0 }, { number: 0, hasmore: false }, { v_list: [] }]) {
    const result = await getQQAccountCatalog('123', 'encrypted', async(name) => name == 'created' ? { v_playlist: owned } : data)
    assert.equal(result.warnings.length, 0)
  }
  const result = await getQQAccountCatalog('123', 'encrypted', async(name) => name == 'created' ? { v_playlist: owned } : {})
  assert.equal(result.warnings.join(','), 'favorite')
})

test('QQ 自建与收藏列表均分页读取，支持 bFinish 和 hasmore', async() => {
  const calls = []
  const result = await getQQAccountCatalog('123', 'encrypted', async(name, module, method, param) => {
    calls.push([name, param.offset])
    if (name == 'created') return { v_playlist: param.offset ? [owned[1]] : [owned[0]], bFinish: !!param.offset }
    return { v_list: [{ tid: String(400 + param.offset), title: '收藏' }], hasmore: param.offset ? 0 : 1 }
  })
  assert.deepEqual(calls, [['created', 0], ['created', 1], ['favorite', 0], ['favorite', 1]])
  assert.equal(result.created.length, 2)
  assert.equal(result.favorite.length, 2)
})

test('QQ 掉登录、换号、取消和不完整分页不能变成成功空列表', async() => {
  for (const reason of ['login_required', 'account_changed', 'cancelled', 'incomplete']) {
    await assert.rejects(getQQAccountCatalog('123', 'encrypted', async(name) => {
      if (name == 'created') return { v_playlist: owned }
      throw Error(reason)
    }), new RegExp(reason))
  }
  const aborted = new Error('aborted'); aborted.name = 'AbortError'
  await assert.rejects(getQQAccountCatalog('123', 'encrypted', async(name) => {
    if (name == 'created') return { v_playlist: owned }
    throw aborted
  }), /aborted/)
  const expired = Object.assign(new Error('QQ Music module favorite failed: 104401'), { reason: 'login_required' })
  await assert.rejects(getQQAccountCatalog('123', 'encrypted', async(name) => {
    if (name == 'created') return { v_playlist: owned }
    throw expired
  }), /104401/)
  await assert.rejects(getQQAccountCatalog('123', 'encrypted', async() => ({ v_playlist: owned, hasmore: 1 })), /incomplete/)
  await assert.rejects(getQQAccountCatalog('123', 'encrypted', async(name) => name == 'created' ? { v_playlist: owned } : { v_list: [{ tid: 500 }], hasmore: 1 }), /incomplete/)
})

test('QQ 缺少我喜欢条目才回退到详情，失败时不伪造零首的我喜欢', async() => {
  const read = async(name) => name == 'created' ? { v_playlist: [owned[1]] } : name == 'favorite' ? { v_list: [] } : { total_song_num: 18 }
  const result = await getQQAccountCatalog('123', 'encrypted', read)
  assert.equal(result.created[0].dirId, 201)
  assert.equal(result.created[0].songNum, 18)
  const missing = await getQQAccountCatalog('123', 'encrypted', async(name) => {
    if (name == 'liked') throw Error('unavailable')
    return read(name)
  })
  assert.equal(missing.created.length, 1)
  assert.equal(missing.warnings.join(','), 'liked')
  await assert.rejects(getQQAccountCatalog('123', '', async() => ({ v_playlist: [] })), /unavailable/)
})
