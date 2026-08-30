import assert from 'node:assert/strict'
import test from 'node:test'

import { getSearchVariantKinds, normalizeSearchText, rankSearchItems } from '../../src/renderer/store/search/music/ranking.ts'

interface MusicFixture {
  id: string
  name: string
  singer: string
  albumName: string
}

const candidate = (
  music: MusicFixture,
  rank: number,
  index: number,
  extraRanks: Array<{ rank: number, sourceOrder: number }> = [],
  albumKey = `album:${music.albumName}`,
) => ({
  data: music,
  name: music.name,
  singer: music.singer,
  albums: [{ name: music.albumName, key: albumKey }],
  sourceRanks: [{ rank, sourceOrder: 0 }, ...extraRanks],
  index,
})

test('电影或专辑关键词优先展示成簇的原声曲目', () => {
  const results = rankSearchItems([
    candidate({ id: 'clone', name: '天气之子', singer: '网络歌手', albumName: '单曲发行' }, 0, 0),
    candidate({ id: 'dj', name: '天气之子（DJ版）', singer: '网络歌手', albumName: '热歌合集' }, 1, 1),
    candidate(
      { id: 'fireworks', name: '花火大会', singer: 'RADWIMPS', albumName: '天気の子' },
      18,
      2,
      [{ rank: 15, sourceOrder: 1 }],
    ),
    candidate(
      { id: 'theme', name: '「天気の子」のテーマ', singer: 'RADWIMPS', albumName: '天気の子' },
      19,
      3,
      [{ rank: 16, sourceOrder: 1 }],
    ),
    candidate({ id: 'okay', name: '大丈夫 (Movie edit)', singer: 'RADWIMPS', albumName: '天気の子' }, 20, 4),
    candidate({ id: 'festival', name: '祝祭 (Movie edit)', singer: '三浦透子', albumName: '天気の子' }, 21, 5),
  ], '天气之子')

  assert.deepEqual(results.slice(0, 4).map(item => item.id).sort(), ['fireworks', 'theme', 'okay', 'festival'].sort())
})

test('有可信原曲时精确曲名优先于同专辑的原声曲目', () => {
  const albumKey = 'album:天気の子'
  const results = rankSearchItems([
    candidate({ id: 'clone', name: '天气之子', singer: '网络歌手', albumName: '单曲' }, 0, 0),
    candidate({ id: 'exact', name: '天气之子', singer: 'RADWIMPS', albumName: '天気の子' }, 80, 1, [], albumKey),
    candidate({ id: 'fireworks', name: '花火大会', singer: 'RADWIMPS', albumName: '天気の子' }, 18, 2, [{ rank: 15, sourceOrder: 1 }], albumKey),
    candidate({ id: 'theme', name: '「天気の子」のテーマ', singer: 'RADWIMPS', albumName: '天気の子' }, 19, 3, [{ rank: 16, sourceOrder: 1 }], albumKey),
    candidate({ id: 'okay', name: '大丈夫 (Movie edit)', singer: 'RADWIMPS', albumName: '天気の子' }, 20, 4, [], albumKey),
  ], '天气之子')

  assert.equal(results[0].id, 'exact')
})

test('跨平台靠前返回的同一歌曲获得共识加权', () => {
  const results = rankSearchItems([
    candidate({ id: 'single-source', name: '同名歌曲', singer: '网络歌手', albumName: '单曲' }, 0, 0),
    candidate(
      { id: 'consensus', name: '同名歌曲', singer: '正式歌手', albumName: '正式专辑' },
      10,
      1,
      [{ rank: 8, sourceOrder: 1 }, { rank: 12, sourceOrder: 2 }],
    ),
  ], '同名歌曲')

  assert.equal(results[0].id, 'consensus')
})

test('用户明确搜索版本词时不惩罚对应版本', () => {
  const results = rankSearchItems([
    candidate({ id: 'plain', name: '天气之子', singer: '甲', albumName: '单曲' }, 0, 0),
    candidate({ id: 'dj', name: '天气之子 DJ', singer: '乙', albumName: '单曲' }, 4, 1),
  ], '天气之子 DJ')

  assert.equal(results[0].id, 'dj')
})

test('全角版本词会被识别为用户明确指定的版本', () => {
  const results = rankSearchItems([
    candidate(
      { id: 'plain', name: '天气之子', singer: '甲', albumName: '单曲' },
      0,
      0,
      [{ rank: 0, sourceOrder: 1 }],
    ),
    candidate({ id: 'dj', name: '天气之子 DJ', singer: '乙', albumName: '单曲' }, 0, 1),
  ], '天气之子 ＤＪ')

  assert.equal(results[0].id, 'dj')
})

test('中英文同义版本词不会误罚用户明确选择的版本', () => {
  const results = rankSearchItems([
    candidate({ id: 'plain', name: '天气之子', singer: '甲', albumName: '单曲' }, 0, 0),
    candidate({ id: 'cover', name: '天气之子 cover', singer: '乙', albumName: '单曲' }, 0, 1),
  ], '天气之子 翻唱')

  assert.equal(results[0].id, 'cover')
})

test('单字查询不触发专辑集合加权', () => {
  const results = rankSearchItems([
    candidate({ id: 'exact', name: '爱', singer: '正式歌手', albumName: '单曲' }, 0, 0),
    candidate({ id: 'cluster-a', name: '序曲', singer: '原声作者', albumName: '爱' }, 10, 1),
    candidate({ id: 'cluster-b', name: '终曲', singer: '原声作者', albumName: '爱' }, 11, 2),
    candidate({ id: 'cluster-c', name: '主题曲', singer: '原声作者', albumName: '爱' }, 12, 3),
  ], '爱')

  assert.equal(results[0].id, 'exact')
})

test('未指定的变体不借原声专辑集合加权置顶', () => {
  const results = rankSearchItems([
    candidate({ id: 'piano', name: '天气之子 钢琴版', singer: '钢琴演奏', albumName: '天気の子' }, 0, 0),
    candidate(
      { id: 'fireworks', name: '花火大会', singer: 'RADWIMPS', albumName: '天気の子' },
      10,
      1,
      [{ rank: 9, sourceOrder: 1 }],
    ),
    candidate(
      { id: 'okay', name: '大丈夫 (Movie edit)', singer: 'RADWIMPS', albumName: '天気の子' },
      11,
      2,
      [{ rank: 10, sourceOrder: 1 }],
    ),
    candidate({ id: 'festival', name: '祝祭 (Movie edit)', singer: '三浦透子', albumName: '天気の子' }, 12, 3),
  ], '天气之子')

  assert.notEqual(results[0].id, 'piano')
})

test('未指定的英文 mix 变体不能压过精确结果', () => {
  const results = rankSearchItems([
    candidate({ id: 'mix', name: '天气之子 MIX', singer: '网络歌手', albumName: '热门合集' }, 0, 0),
    candidate({ id: 'exact', name: '天气之子', singer: '正式歌手', albumName: '原声带' }, 80, 1),
  ], '天气之子')

  assert.equal(results[0].id, 'exact')
})

test('未指定的日文版本词和男女声版本不能压过精确结果', () => {
  const variants = [
    { id: 'cover', name: '天气之子 カバー' },
    { id: 'live', name: '天气之子 ライブ' },
    { id: 'remix', name: '天气之子 リミックス' },
    { id: 'female', name: '天气之子 女生版' },
    { id: 'female-short', name: '天气之子 女版' },
    { id: 'male', name: '天气之子 男版' },
  ]
  const results = rankSearchItems([
    ...variants.map((variant, index) => candidate(
      { id: variant.id, name: variant.name, singer: '网络歌手', albumName: '热门合集' },
      0,
      index,
    )),
    candidate({ id: 'exact', name: '天气之子', singer: '正式歌手', albumName: '原声带' }, 80, variants.length),
  ], '天气之子')

  assert.equal(results[0].id, 'exact')
})

test('真实搜索中的副标题与版本后缀不能压过同歌手原曲', () => {
  const variants = [
    { id: 'subtitle', name: '天气之子（比起晴天我更需要你）' },
    { id: 'fan-made', name: '天气之子（翻奏: STRlighT）' },
    { id: 'movie-edit', name: '天气之子 Movie edit' },
    { id: 'ambient', name: '天气之子 氛围纯享版' },
    { id: 'version', name: '天气之子 ver.' },
  ]
  const results = rankSearchItems([
    ...variants.map((variant, index) => candidate(
      { id: variant.id, name: variant.name, singer: 'RADWIMPS', albumName: '热门合集' },
      index,
      index,
    )),
    candidate({ id: 'exact', name: '天气之子', singer: 'RADWIMPS', albumName: '单曲' }, 80, variants.length),
  ], '天气之子')

  assert.equal(results[0].id, 'exact')
  assert.deepEqual(getSearchVariantKinds('翻奏: STRlighT'), ['cover'])
  assert.deepEqual(getSearchVariantKinds('Movie edit'), ['edit'])
  assert.deepEqual(getSearchVariantKinds('氛围纯享版'), ['accompaniment'])
  assert.deepEqual(getSearchVariantKinds('ver.'), ['edit'])
})

test('单平台搜索电影名时，可信原声首曲优先于孤立同名翻唱', () => {
  const albumKey = 'kw:weather-child'
  const results = rankSearchItems([
    candidate({ id: 'cover', name: '天気の子', singer: 'Amison', albumName: '单曲' }, 0, 0, [], 'kw:cover'),
    candidate({ id: 'theme', name: '愛にできることはまだあるか', singer: 'RADWIMPS', albumName: '天気の子' }, 2, 1, [], albumKey),
    candidate({ id: 'okay', name: '大丈夫(Movie edit)', singer: 'RADWIMPS', albumName: '天気の子' }, 3, 2, [], albumKey),
    candidate({ id: 'fireworks', name: '花火大会', singer: 'RADWIMPS', albumName: '天気の子' }, 4, 3, [], albumKey),
    candidate({ id: 'festival', name: '祝祭(Movie edit)', singer: '三浦透子', albumName: '天気の子' }, 5, 4, [], albumKey),
    candidate({ id: 'sky', name: '空の声', singer: 'RADWIMPS', albumName: '天気の子' }, 6, 5, [], albumKey),
    candidate({ id: 'rain', name: '雨の街', singer: 'RADWIMPS', albumName: '天気の子' }, 7, 6, [], albumKey),
  ], '天气之子', { allowSingleSourceCollection: true })

  assert.equal(results[0].id, 'theme')
})

test('单平台专辑簇不能压过另一张专辑中的可靠精确歌曲', () => {
  const albumKey = 'kw:yesterday-album'
  const results = rankSearchItems([
    candidate({ id: 'exact', name: 'Yesterday', singer: '正式歌手', albumName: 'Single' }, 80, 0),
    candidate({ id: 'track-a', name: 'Track A', singer: 'Band A', albumName: 'Yesterday' }, 0, 1, [], albumKey),
    candidate({ id: 'track-b', name: 'Track B', singer: 'Band A', albumName: 'Yesterday' }, 1, 2, [], albumKey),
    candidate({ id: 'track-c', name: 'Track C', singer: 'Band B', albumName: 'Yesterday' }, 2, 3, [], albumKey),
    candidate({ id: 'track-d', name: 'Track D', singer: 'Band B', albumName: 'Yesterday' }, 3, 4, [], albumKey),
  ], 'Yesterday', { allowSingleSourceCollection: true })

  assert.equal(results[0].id, 'exact')
})

test('同名专辑簇只有在精确条目疑似同名翻唱时才允许置顶', () => {
  const albumKey = 'kw:weather-child'
  const results = rankSearchItems([
    candidate({ id: 'clone', name: '天气之子', singer: 'Amison', albumName: '天気の子' }, 0, 0, [], 'kw:clone'),
    candidate({ id: 'theme', name: '愛にできることはまだあるか', singer: 'RADWIMPS', albumName: '天気の子' }, 2, 1, [], albumKey),
    candidate({ id: 'okay', name: '大丈夫(Movie edit)', singer: 'RADWIMPS', albumName: '天気の子' }, 3, 2, [], albumKey),
    candidate({ id: 'fireworks', name: '花火大会', singer: 'RADWIMPS', albumName: '天気の子' }, 4, 3, [], albumKey),
    candidate({ id: 'festival', name: '祝祭(Movie edit)', singer: '三浦透子', albumName: '天気の子' }, 5, 4, [], albumKey),
    candidate({ id: 'sky', name: '空の声', singer: 'RADWIMPS', albumName: '天気の子' }, 6, 5, [], albumKey),
    candidate({ id: 'rain', name: '雨の街', singer: 'RADWIMPS', albumName: '天気の子' }, 7, 6, [], albumKey),
  ], '天气之子', { allowSingleSourceCollection: true })

  assert.equal(results[0].id, 'theme')
})

test('未识别的查询前缀副标题即使艺人不同也不能压过精确曲名', () => {
  const results = rankSearchItems([
    candidate({ id: 'subtitle', name: '天气之子（比起晴天我更需要你）', singer: '李佳薇', albumName: '热门合集' }, 0, 0),
    candidate({ id: 'original', name: '天气之子', singer: '正式歌手', albumName: '单曲' }, 80, 1),
  ], '天气之子')

  assert.equal(results[0].id, 'original')
})

test('多个精确曲名整体排在未识别副标题之前', () => {
  const results = rankSearchItems([
    candidate({ id: 'exact-album', name: '天气之子', singer: '原唱一', albumName: '天气之子' }, 0, 0),
    candidate({ id: 'subtitle', name: '天气之子（特别版）', singer: '原唱二', albumName: '其他专辑' }, 1, 1),
    candidate({ id: 'exact-single', name: '天气之子', singer: '原唱二', albumName: '单曲' }, 40, 2),
  ], '天气之子')

  assert.deepEqual(results.slice(0, 2).map(item => item.id).sort(), ['exact-album', 'exact-single'].sort())
})

test('只有专辑名命中的普通条目不能凭平台名次压过精确曲名', () => {
  const results = rankSearchItems([
    candidate({ id: 'album-only', name: '曲目一', singer: '普通歌手', albumName: '天气之子' }, 0, 0),
    candidate({ id: 'exact', name: '天气之子', singer: '正式歌手', albumName: '单曲' }, 80, 1),
  ], '天气之子')

  assert.equal(results[0].id, 'exact')
})

test('艺人名中的 DJ 等词不会被当成歌曲变体', () => {
  const results = rankSearchItems([
    candidate({ id: 'dj-artist', name: '晴天', singer: 'DJ Snake', albumName: '单曲' }, 0, 0),
    candidate({ id: 'later', name: '晴天', singer: '正式歌手', albumName: '单曲' }, 1, 1),
  ], '晴天')

  assert.equal(results[0].id, 'dj-artist')
})

test('用户明确搜索日文版本词时允许对应版本优先', () => {
  const results = rankSearchItems([
    candidate({ id: 'plain', name: '天气之子', singer: '正式歌手', albumName: '原声带' }, 0, 0),
    candidate({ id: 'cover', name: '天气之子 カバー', singer: '翻唱歌手', albumName: '翻唱合集' }, 20, 1),
  ], '天气之子 カバー')

  assert.equal(results[0].id, 'cover')
})

test('版本类别签名区分原曲与不可互换的变体', () => {
  assert.deepEqual(getSearchVariantKinds('天气之子'), [])
  assert.deepEqual(getSearchVariantKinds('天气之子 (DJ Remix Live)'), ['live', 'mix'])
  assert.deepEqual(getSearchVariantKinds('天气之子 カバー 女生版'), ['cover', 'edit'])
})

test('DJ 与 Remix 保留不同的标题语义', () => {
  assert.notEqual(normalizeSearchText('Foo DJ'), normalizeSearchText('Foo Remix'))
  const results = rankSearchItems([
    candidate({ id: 'dj', name: '天气之子 DJ', singer: '甲', albumName: '单曲' }, 0, 0),
    candidate({ id: 'remix', name: '天气之子 Remix', singer: '乙', albumName: '单曲' }, 20, 1),
  ], '天气之子 Remix')

  assert.equal(results[0].id, 'remix')
})

test('无标签同名专辑簇缺少多曲目跨平台证据时不压过精确结果', () => {
  const albumKey = 'album:同名普通专辑'
  const results = rankSearchItems([
    candidate({ id: 'exact', name: '天气之子', singer: '正式歌手', albumName: '单曲' }, 60, 0),
    candidate(
      { id: 'ordinary-a', name: '曲目一', singer: '甲歌手', albumName: '天气之子' },
      0,
      1,
      [{ rank: 1, sourceOrder: 1 }],
      albumKey,
    ),
    candidate(
      { id: 'ordinary-b', name: '曲目二', singer: '甲歌手', albumName: '天气之子' },
      1,
      2,
      [],
      albumKey,
    ),
    candidate(
      { id: 'ordinary-c', name: '曲目三', singer: '乙歌手', albumName: '天气之子' },
      2,
      3,
      [],
      albumKey,
    ),
  ], '天气之子')

  assert.equal(results[0].id, 'exact')
})

test('原声集合仍需两首跨平台曲目和重复主艺人才能获得加权', () => {
  const albumKey = 'album:可信原声'
  const results = rankSearchItems([
    candidate({ id: 'exact', name: '天气之子', singer: '网络歌手', albumName: '单曲' }, 0, 0),
    candidate(
      { id: 'theme', name: '主题曲', singer: 'RADWIMPS', albumName: '天气之子' },
      20,
      1,
      [{ rank: 21, sourceOrder: 1 }],
      albumKey,
    ),
    candidate(
      { id: 'fireworks', name: '花火大会', singer: 'RADWIMPS', albumName: '天气之子' },
      21,
      2,
      [{ rank: 22, sourceOrder: 1 }],
      albumKey,
    ),
    candidate({ id: 'festival', name: '祝祭', singer: '三浦透子', albumName: '天气之子' }, 22, 3, [], albumKey),
  ], '天气之子')

  assert.deepEqual(results.slice(0, 3).map(item => item.id).sort(), ['theme', 'fireworks', 'festival'].sort())
})

test('同名但不同平台专辑 ID 不会被合并成虚假专辑簇', () => {
  const results = rankSearchItems([
    candidate({ id: 'exact', name: '天气之子', singer: '正式歌手', albumName: '单曲' }, 0, 0),
    candidate(
      { id: 'cover-a', name: '曲目一', singer: '翻唱歌手', albumName: '天気の子' },
      0,
      1,
      [{ rank: 5, sourceOrder: 1 }],
      'tx:cover-a',
    ),
    candidate({ id: 'cover-b', name: '曲目二', singer: '翻唱歌手', albumName: '天気の子' }, 1, 2, [], 'wy:cover-b'),
    candidate({ id: 'cover-c', name: '曲目三', singer: '翻唱歌手', albumName: '天気の子' }, 2, 3, [], 'kw:cover-c'),
  ], '天气之子')

  assert.equal(results[0].id, 'exact')
})

test('聚合项会使用所有平台的专辑元数据', () => {
  const official = candidate({ id: 'official', name: '花火大会', singer: 'RADWIMPS', albumName: '单曲' }, 0, 0)
  official.albums.push({ name: '天気ノ子', key: 'wy:official-album' })
  const results = rankSearchItems([
    official,
    candidate({ id: 'irrelevant', name: '花火大会', singer: '网络歌手', albumName: '夏日合集' }, 0, 1),
  ], '天气之子')

  assert.equal(results[0].id, 'official')
})

test('同分结果按平台名次与原始位置保持稳定', () => {
  const results = rankSearchItems([
    candidate({ id: 'later', name: '测试', singer: '歌手', albumName: '专辑' }, 2, 0),
    candidate({ id: 'earlier', name: '测试', singer: '歌手', albumName: '专辑' }, 0, 1),
  ], '测试')

  assert.deepEqual(results.map(item => item.id), ['earlier', 'later'])
})
