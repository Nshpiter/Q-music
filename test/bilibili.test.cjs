const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const root = path.resolve(__dirname, '..')
const file = fs.existsSync(path.join(root, 'src/core/player/session.ts')) ? 'src/utils/bilibili.ts' : 'src/common/utils/bilibili.ts'
const context = { exports: {}, AbortController }
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file),'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
const { createBilibiliClient, isBilibiliMediaUrl } = context.exports
const bvid = 'BV1xx411c7mD'

test('B站联想使用官方suggest，清除高亮、解码实体、去重，不掺其他平台', async() => {
  const client = createBilibiliClient(async(url, headers) => {
    const parsed = new URL(url)
    assert.equal(parsed.hostname, 's.search.bilibili.com')
    assert.equal(parsed.searchParams.get('term'), '原神 OST')
    assert.equal(headers.Referer, 'https://www.bilibili.com/')
    return { code: 0, result: { tag: [{ value: '<em>原神</em> OST' }, { value: '原神 OST' }, { term: 'It&#x27;s&#32;music&#x1f3b5;&nbsp;' }] } }
  })
  assert.deepEqual(Array.from(await client.suggest(' 原神 OST ')), ['原神 OST', "It's music🎵"])
  const failed = createBilibiliClient(async() => ({ code: -412 }))
  await assert.rejects(failed.suggest('曲名'), /invalid_suggestions/)
  assert.equal((await failed.suggest(' ')).length, 0)
})

test('选集保留CID顺序并发现所属合集；失效CID拒绝，取消后不交付旧内容', async() => {
  const data = { bvid, title: '合集&#x27;', owner: { mid: 123 }, ugc_season: { id: 456, title: '音乐合集' }, pages: [{ cid: 20, part: '第二乐章' }, { cid: 10, part: '第一乐章' }] }
  const client = createBilibiliClient(async() => ({ code: 0, data }))
  const result = await client.videoContents(bvid + ':0')
  assert.equal(result.title, "合集'")
  assert.equal(result.parts[0].songmid, bvid + ':20')
  assert.equal(result.parts[1].songmid, bvid + ':10')
  assert.equal(result.collection.url, 'https://space.bilibili.com/123/lists/456?type=season')
  const single = createBilibiliClient(async() => ({ code: 0, data: { ...data, ugc_season: undefined } }))
  assert.equal((await single.videoContents(bvid)).collection, undefined)
  await assert.rejects(client.videoContents('https://evil.test/BV1xx411c7mD'), /invalid_track/)
  const malformed = createBilibiliClient(async() => ({ code: 0, data: { ...data, pages: [{ cid: 0 }] } }))
  await assert.rejects(malformed.videoContents(bvid), /invalid_pages/)
  const controller = new AbortController()
  const cancelled = createBilibiliClient(async() => { controller.abort(); return { code: 0, data } })
  await assert.rejects(cancelled.videoContents(bvid, controller.signal), /cancelled/)
})

test('合集链接支持新旧 season 和 series，拒绝仿冒域名', () => {
  const parse = context.exports.parseBilibiliCollection
  assert.equal(parse('https://space.bilibili.com/123/lists/456?type=season').kind, 'season')
  assert.equal(parse('https://space.bilibili.com/123/channel/collectiondetail?sid=456').id, '456')
  assert.equal(parse('https://space.bilibili.com/123/lists/456?type=series').kind, 'series')
  assert.equal(parse('https://space.bilibili.com.evil.test/123/lists/456'), undefined)
})

test('跨视频合集分页导入保持顺序，页数变化或重复项拒绝部分写入', async() => {
  const seenPages = []
  const client = createBilibiliClient(async(url) => {
    const p = Number(new URL(url).searchParams.get('page_num')); seenPages.push(p)
    return { code: 0, data: { meta: { name: '音乐合集' }, page: { total: 31, page_size: 30 }, archives: Array.from({ length: p == 1 ? 30 : 1 }, (_, i) => ({ bvid: 'BV' + String((p - 1) * 30 + i).padStart(10, '0'), title: 'song' + i, duration: 30 })) } }
  })
  const result = await client.importCollection('https://space.bilibili.com/123/lists/456')
  assert.equal(result.list.length, 31); assert.equal(result.name, '音乐合集')
  assert.deepEqual(seenPages, [1, 2]); assert.equal(result.list[30].songmid, 'BV0000000030:0')
  const repeated = createBilibiliClient(async() => ({ code: 0, data: { meta: {}, page: { total: 2, page_size: 30 }, archives: [{ bvid, title: 'song' }] } }))
  await assert.rejects(repeated.importCollection('https://space.bilibili.com/123/lists/456'), /incomplete/)
  await assert.rejects(client.importCollection('https://space.bilibili.com/123/lists/456', undefined, () => true), /cancelled/)
})

test('系列使用独立接口，BV 导入保留各分 P 的 CID', async() => {
  const client = createBilibiliClient(async(url) => {
    const p = new URL(url)
    if (p.pathname.endsWith('/view')) return { code: 0, data: { bvid, title: '多P', pages: [{ cid: 10, part: 'one' }, { cid: 20, part: 'two' }] } }
    if (p.pathname == '/x/series/series') return { code: 0, data: { meta: { name: '系列' } } }
    assert.equal(p.pathname, '/x/series/archives')
    return { code: 0, data: { page: { total: 1, size: 20 }, archives: [{ bvid, title: 'single' }] } }
  })
  assert.equal((await client.search('https://space.bilibili.com/123/lists/456?type=series')).info.name, '系列')
  assert.equal((await client.importCollection(bvid)).list[1].songmid, bvid + ':20')
})
test('B 站搜索处理标题和封面，指纹请求合并，错误不伪装成无结果', async() => {
  let fingers = 0
  const client = createBilibiliClient(async(url, headers) => {
    if (url.includes('/finger/')) { fingers++; return { code: 0, data: { b_3: 'anonymous3', b_4: 'anonymous4' } } }
    assert.match(headers.Cookie, /buvid3=/)
    return { code: 0, data: { result: [{ bvid, title: '<em>曲名</em> &amp; Live', pic: '//i0.hdslb.com/test.jpg', duration: '3:02', author: 'UP' }], numPages: 2, numResults: 30 } }
  })
  const [result] = await Promise.all([client.search('test'), client.search('test')])
  assert.equal(fingers, 1)
  assert.equal(result.list[0].name, '曲名 & Live')
  assert.equal(result.list[0].interval, '03:02')
  assert.equal(result.list[0].songmid, bvid + ':0')
  const failed = createBilibiliClient(async() => ({ code: -412 }))
  await assert.rejects(failed.search('test'), /-412/)
})
test('B 站 BV 链接分 P，播放按 CID 精确取址，不回退到第一个 P', async() => {
  let queries = []
  const client = createBilibiliClient(async(url) => {
    const parsed = new URL(url)
    if (parsed.pathname.endsWith('/view')) return { code: 0, data: { bvid, title: '合辑', pages: [{ cid: 1, part: '第一首' }, { cid: 2, part: '第二首' }] } }
    queries.push(parsed.searchParams.get('cid'))
    return { code: 0, data: { dash: { audio: [{ codecs: 'mp4a.40.2', bandwidth: 192000, baseUrl: 'https://example.bilivideo.com/audio.m4a' }] } } }
  })
  assert.equal((await client.search('https://www.bilibili.com/video/' + bvid, 2, 1)).list[0].songmid, bvid + ':2')
  await client.playback(bvid + ':2')
  await client.playback(bvid + ':2')
  assert.deepEqual(queries, ['2', '2'])
  await assert.rejects(client.playback(bvid + ':3'), /part_removed/)
  const controller = new AbortController(); controller.abort()
  await assert.rejects(client.playback(bvid + ':2', controller.signal), /cancelled/)
  assert.equal(isBilibiliMediaUrl('https://example.bilivideo.com.evil.test/a'), false)
  assert.equal(isBilibiliMediaUrl('https://example.bilivideo.com/a'), true)
})

test('没有分 P 标题时使用视频标题，避免结果列表出现空歌名', async() => {
  const client = createBilibiliClient(async() => ({ code: 0, data: { bvid, title: '视频标题', pages: [{ cid: 1, part: '' }] } }))
  assert.equal((await client.search(bvid)).list[0].name, '视频标题')
})

test('主音频为非常规节点时，使用接口提供的常规 CDN 备用地址', async() => {
  const client = createBilibiliClient(async(url) => url.includes('/view')
    ? { code: 0, data: { pages: [{ cid: 1 }] } }
    : { code: 0, data: { dash: { audio: [{ codecs: 'mp4a.40.2', bandwidth: 128000, baseUrl: 'https://node.edge.mountaintoys.cn/audio', backupUrl: ['https://upos-sz-mirrorcos.bilivideo.com/audio.m4a'] }] } } })
  assert.equal((await client.playback(bvid + ':1')).url, 'https://upos-sz-mirrorcos.bilivideo.com/audio.m4a')
})
