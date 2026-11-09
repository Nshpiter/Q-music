const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const root = path.resolve(__dirname, '..')
const mobile = fs.existsSync(path.join(root, 'src/core/player/player.ts'))
const sdkRoot = mobile ? 'src/utils/musicSdk' : 'src/renderer/utils/musicSdk'
const fixture = require('./fixtures/migu-playlist.json')
function load(file, dependencies) {
 const context = { exports: {}, require: id => { if (!(id in dependencies)) throw Error(id); return dependencies[id] } }
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
 return context.exports
}
const artwork = load(sdkRoot + '/mg/artwork.js', {})
function sdk(request) {
 const utils = { sizeFormate: String, formatPlayTime: String, formatPlayCount: String }
 const music = load(sdkRoot + '/mg/musicInfo.js', { './artwork': artwork, '../../index': utils, './utils': {}, '../utils': { formatSingerName: (rows, key) => (rows || []).map(row => row[key]).join(' / ') } })
 return load(sdkRoot + '/mg/songList.js', { '../../request': { httpFetch: url => ({ promise: Promise.resolve().then(() => request(url)) }) }, '../../index': utils, './musicInfo': music, './musicSearch': {}, './utils/index': {} }).default
}
test('咪咕真实响应：推荐、标签列表和歌单详情正确解析', async () => {
 const api = sdk(url => ({ body: fixture[url.includes('/song/') ? 'songs' : url.includes('/resource/playlist/') ? 'info' : url.includes('listbytag') ? 'tag-list' : 'recommend'] }))
 const home = await api.getList('15127315', null, 1)
 assert.ok(home.list.some(item => item.id == '233247680')); assert.ok(home.list.every(item => item.name && item.id))
 const tags = await api.getList('15127315', '1000001672', 1)
 assert.ok(tags.list.length > 10)
 const detail = await api.getListDetail('233247680', 1)
 assert.equal(detail.total, 105); assert.equal(detail.list.length, 2); assert.equal(detail.info.name, fixture.info.data.title)
 assert.equal(detail.list[0].songmid, fixture.songs.data.songList[0].songId)
 assert.equal(detail.list[0].img, 'https://d.musicapp.migu.cn' + fixture.songs.data.songList[0].img3)
})
test('咪咕元信息失败只重试元信息，保留页码且严格限制重试', async () => {
 const urls = []
 const api = sdk(url => { urls.push(url); return { body: url.includes('/song/') ? fixture.songs : { code: 'failed' } } })
 await assert.rejects(api.getListDetail('233247680', 2), /try max num/)
 assert.equal(urls.filter(url => url.includes('/song/')).length, 1)
 assert.ok(urls[0].includes('pageNo=2'))
 assert.equal(urls.length, 4)
})
test('咪咕缺可选封面统计和空装饰块不报错，错误正文不伪装空歌单', async () => {
 const info = sdk(() => ({ body: { code: '000000', data: { title: 'empty', originalImgUrl: 'cover' } } }))
 assert.equal((await info.getListDetailInfo('1')).img, 'cover')
 const list = sdk(() => ({ body: { code: '000000', data: { contentItemList: [{}, { itemList: [{ title: 'a', logEvent: { contentId: '1' } }] }] } } }))
 assert.equal((await list.getList('', '', 1)).list[0].id, '1')
 const bad = sdk(() => ({ body: '<html>error</html>' }))
 await assert.rejects(bad.getListDetailList('1', 1), /try max num/)
 const shape = sdk(() => ({ body: { code: '000000', data: {} } }))
 await assert.rejects(shape.getList('', '', 1), /invalid playlist response/)
})

function picture(response) {
 return load(sdkRoot + '/mg/pic.js', {
  './artwork': artwork,
  '../../request': { httpFetch: url => ({ promise: Promise.resolve().then(() => response(url)) }) },
  './songId': { default: async song => song.songmid },
 }).default
}

test('咪咕封面返回图片 URL 而非请求对象，失败重试保持歌曲身份且有上限', async () => {
 const urls = []
 const api = picture(url => { urls.push(url); return { body: urls.length < 2 ? { returnCode: 'failed' } : { returnCode: '000000', largePic: '//image.migu.cn/cover.jpg' } } })
 assert.equal(await api.getPic({ songmid: '123' }), 'https://image.migu.cn/cover.jpg')
 assert.equal(urls.length, 2); assert.ok(urls.every(url => url.includes('songId=123')))
 let requests = 0
 await assert.rejects(picture(() => { requests++; return { body: '<html>offline</html>' } }).getPic({ songmid: '456' }), /图片获取失败/)
 assert.equal(requests, 3)
 const missing = picture(() => ({ body: { returnCode: '000000', largePic: {}, mediumPic: 'javascript:bad' } }))
 await assert.rejects(missing.getPic({ songmid: '123' }), /图片获取失败/)
})

test('咪咕相对封面补全 CDN，绝对地址保留并跳过异常字段', () => {
 assert.equal(artwork.getMiguArtwork('/data/cover.webp'), 'https://d.musicapp.migu.cn/data/cover.webp')
 assert.equal(artwork.getMiguArtwork({}, '', 'https://image/cover.jpg'), 'https://image/cover.jpg')
 assert.equal(artwork.getMiguArtwork('javascript:bad'), '')
})
