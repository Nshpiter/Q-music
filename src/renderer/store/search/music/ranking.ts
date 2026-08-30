export interface SearchSourceRank {
  rank: number
  sourceOrder: number
}

export interface SearchAlbumEvidence {
  name: string
  key?: string
}

export interface SearchRankingItem<T> {
  data: T
  name: string
  singer: string
  albums: SearchAlbumEvidence[]
  sourceRanks: SearchSourceRank[]
  index: number
}

export interface SearchRankingOptions {
  /** 单平台搜索可启用保守的专辑/原声簇识别；聚合搜索仍只使用跨平台共识。 */
  allowSingleSourceCollection?: boolean
}

interface ScoredSearchRankingItem<T> extends SearchRankingItem<T> {
  normalizedName: string
  normalizedSinger: string
  matchingAlbumKeys: string[]
  titleStrength: number
  singerStrength: number
  albumStrength: number
  variantPenalty: number
  score: number
  bestRank: number
  bestSourceOrder: number
}

interface AlbumCluster {
  titles: Set<string>
  singerTitles: Map<string, Set<string>>
  crossSourceTitleSources: Map<string, Set<number>>
  albumNames: Set<string>
}

export type SearchVariantKind = 'cover' | 'mix' | 'accompaniment' | 'live' | 'speed' | 'edit'

interface VariantDescriptor {
  kind: SearchVariantKind
  pattern: RegExp
}

/**
 * 版本词按语义分组，而不是只匹配少数中文写法。搜索结果里经常混有
 * 日文标题和英文后缀（例如 `MIX`、`カバー`），这些都应该被视为同一类
 * 变体，只有用户明确输入了对应版本词时才取消惩罚。
 */
const variantDescriptors: VariantDescriptor[] = [
  {
    kind: 'cover',
    pattern: /翻唱|翻自|翻奏|翻弹|翻制|カバー|カヴァー|\bcover\b/i,
  },
  {
    kind: 'mix',
    // `mix` 必须是独立单词，避免把普通单词的一部分误判为混音版本。
    pattern: /\bdj\b|\bremix\b|\bmix\b|混音|混剪|重混|电音版|リミックス|ミックス/i,
  },
  {
    kind: 'accompaniment',
    pattern: /伴奏(?:版)?|纯音乐|纯享(?:版)?|氛围(?:纯享|版)?|演奏版|インスト|カラオケ|\binstrumental\b|\bkaraoke\b/i,
  },
  {
    kind: 'live',
    pattern: /现场|\blive\b|ライブ|生放送/i,
  },
  {
    kind: 'speed',
    pattern: /加速|降速|变速|\bsped\s*up\b|\bslowed\b/i,
  },
  {
    kind: 'edit',
    pattern: /女(?:生|声|性)?版|男(?:生|声|性)?版|女生版|男生版|女版|男版|女性版|男性版|片段|剪辑|铃声|钢琴版?|八音盒|不插电|试听|电台版|管弦|电影版|版本|\bmovie\s*(?:edit|version)\b|\bver(?:sion)?\.?\b|\bedit\b|\bfemale(?:\s+version)?\b|\bmale(?:\s+version)?\b|\bpiano\b|\bacoustic\b|\bdemo\b|\bradio\s*edit\b|\borchestra(?:l)?\b/i,
  },
]

/**
 * 返回歌曲/专辑元数据中明确出现的版本类别。聚合搜索使用该签名区分
 * 原曲、翻唱、混音、现场等同名条目，避免把不可互换的播放线路合并。
 */
export const getSearchVariantKinds = (text: string) => {
  const normalizedText = normalizeVariantText(text)
  return [...new Set(variantDescriptors
    .filter(({ pattern }) => pattern.test(normalizedText))
    .map(({ kind }) => kind))].sort()
}

const normalizeVariantText = (text: string) => text
  .normalize('NFKC')
  .toLocaleLowerCase()
  .replace(/\bcover\b/g, '翻唱')
  .replace(/\b(?:dj|remix)\b/g, 'dj')
  .replace(/\bmix\b/g, 'mix')
  .replace(/\b(?:instrumental|karaoke)\b/g, '伴奏')
  .replace(/\blive\b/g, '现场')
  .replace(/\b(?:sped\s*up)\b/g, '加速')
  .replace(/\bslowed\b/g, '降速')
  .replace(/\bmovie\s*(?:edit|version)\b/g, '电影版')
  .replace(/\bver(?:sion)?\.?\b/g, '版本')
  .replace(/\bedit\b/g, '剪辑')
  .replace(/\bpiano\b/g, '钢琴')
  .replace(/\bacoustic\b/g, '不插电')
  .replace(/\bdemo\b/g, '试听')
  .replace(/\bradio\s*edit\b/g, '电台版')
  .replace(/\borchestra(?:l)?\b/g, '管弦')
  .replace(/現場/g, '现场')
  .replace(/翻彈/g, '翻弹')
  .replace(/翻奏/g, '翻奏')
  .replace(/純享版/g, '纯享版')
  .replace(/純享/g, '纯享')
  .replace(/氛圍/g, '氛围')
  .replace(/伴奏版/g, '伴奏版')
  .replace(/演奏版/g, '演奏版')
  .replace(/電影版/g, '电影版')
  .replace(/版本/g, '版本')
  .replace(/鋼琴/g, '钢琴')
  .replace(/鈴聲/g, '铃声')
  .replace(/純音樂/g, '纯音乐')
  .replace(/女聲/g, '女声')
  .replace(/男聲/g, '男声')

/**
 * 统一搜索文本中的常见全半角与中日异体写法，避免同一专辑因字形差异失配。
 */
export const normalizeSearchText = (text: string) => text
  .normalize('NFKC')
  .toLocaleLowerCase()
  .replace(/\bcover\b/g, '翻唱')
  .replace(/\b(?:instrumental|karaoke)\b/g, '伴奏')
  .replace(/\blive\b/g, '现场')
  .replace(/\b(?:sped\s*up)\b/g, '加速')
  .replace(/\bslowed\b/g, '降速')
  .replace(/\bpiano\b/g, '钢琴')
  .replace(/\bacoustic\b/g, '不插电')
  .replace(/\bdemo\b/g, '试听')
  .replace(/\bradio\s*edit\b/g, '电台版')
  .replace(/\borchestra(?:l)?\b/g, '管弦')
  .replace(/[氣気]/g, '气')
  .replace(/[のノ]/g, '之')
  .replace(/現場/g, '现场')
  .replace(/鋼琴/g, '钢琴')
  .replace(/鈴聲/g, '铃声')
  .replace(/純音樂/g, '纯音乐')
  .replace(/[^\p{L}\p{N}]+/gu, '')

/**
 * 将合作艺人写法拆成稳定 token，兼容「、」「feat.」「with」等常见格式。
 */
export const getSearchSingerTokens = (singer: string) => [...new Set(singer
  .normalize('NFKC')
  .split(/(?:、|，|,|&|\/|\bfeat(?:uring)?\.?\b|\bwith\b|\bx\b)/i)
  .map(normalizeSearchText)
  .filter(Boolean))]
  .sort()

const getSimilarity = (left: string, right: string) => {
  if (!left || !right) return 0
  if (left == right) return 1
  if (left.length > right.length) [left, right] = [right, left]

  const distances = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
    let diagonal = distances[0]
    distances[0] = leftIndex
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
      const previous = distances[rightIndex]
      distances[rightIndex] = Math.min(
        distances[rightIndex] + 1,
        distances[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] == right[rightIndex - 1] ? 0 : 1),
      )
      diagonal = previous
    }
  }
  return 1 - distances[right.length] / right.length
}

const getMatchStrength = (query: string, value: string) => {
  if (!query || !value) return 0
  if (value == query) return 1
  if (value.startsWith(query)) return 0.9
  if (value.includes(query)) return 0.82
  if (query.includes(value) && value.length >= Math.max(2, Math.floor(query.length / 2))) return 0.72
  if (Math.min(query.length, value.length) < 3) return 0
  if (Math.min(query.length, value.length) / Math.max(query.length, value.length) < 0.5) return 0

  const similarity = getSimilarity(query, value)
  return similarity >= 0.72 ? similarity * 0.85 : 0
}

const getTitleScore = (strength: number) => {
  if (strength == 1) return 26
  if (strength >= 0.9) return 18
  if (strength >= 0.82) return 14
  return strength * 10
}

const getFieldScore = (strength: number, exactScore: number, fuzzyScore: number) => {
  return strength == 1 ? exactScore : strength * fuzzyScore
}

const getNativeRankScore = (sourceRanks: SearchSourceRank[]) => {
  const ranks = [...sourceRanks].sort((a, b) => a.rank - b.rank || a.sourceOrder - b.sourceOrder)
  return ranks.reduce((score, item, index) => {
    const rankScore = 12 / (1 + Math.max(0, item.rank) * 0.15)
    return score + (index == 0 ? rankScore : rankScore * 0.55)
  }, Math.max(0, ranks.length - 1) * 6)
}

const getVariantPenalty = (keyword: string, item: SearchRankingItem<unknown>) => {
  const normalizedKeyword = normalizeVariantText(keyword)
  // 版本词只应来自歌曲名或专辑名。艺人名中常见的 DJ、Live 等词是
  // 正常艺名的一部分（例如 DJ Snake），把它们纳入检测会误罚原曲。
  const target = normalizeVariantText(`${item.name} ${item.albums.map(album => album.name).join(' ')}`)
  let penalty = 0
  for (const { pattern } of variantDescriptors) {
    if (pattern.test(target) && !pattern.test(normalizedKeyword)) penalty += 30
  }
  // 多个版本词叠加时继续降权，但给分数保留一个可控上限，避免极端元数据
  // 让变体完全消失。最终排序还会对有可靠非变体结果的场景设置上限。
  return Math.min(penalty, 90)
}

const collectAlbumClusters = <T>(items: Array<ScoredSearchRankingItem<T>>) => {
  const clusters = new Map<string, AlbumCluster>()
  for (const item of items) {
    for (const albumKey of item.matchingAlbumKeys) {
      let cluster = clusters.get(albumKey)
      if (!cluster) {
        cluster = { titles: new Set(), singerTitles: new Map(), crossSourceTitleSources: new Map(), albumNames: new Set() }
        clusters.set(albumKey, cluster)
      }
      cluster.titles.add(item.normalizedName)
      for (const album of item.albums) {
        if (album.key == albumKey) cluster.albumNames.add(normalizeSearchText(album.name))
      }
      const sourceOrders = new Set(item.sourceRanks.map(sourceRank => sourceRank.sourceOrder))
      // 变体可以帮助补足专辑曲目数量，但不能单独制造“跨平台共识”。
      // 这样既能保留电影原声中的 Movie edit 等正式版本，又不会让一组
      // 只在单个平台出现的翻唱/混音条目伪装成可靠专辑簇。
      if (!item.variantPenalty && sourceOrders.size >= 2) {
        let titleSources = cluster.crossSourceTitleSources.get(item.normalizedName)
        if (!titleSources) {
          titleSources = new Set()
          cluster.crossSourceTitleSources.set(item.normalizedName, titleSources)
        }
        for (const sourceOrder of sourceOrders) titleSources.add(sourceOrder)
      }
      for (const singerToken of getSearchSingerTokens(item.singer)) {
        let singerTitles = cluster.singerTitles.get(singerToken)
        if (!singerTitles) {
          singerTitles = new Set()
          cluster.singerTitles.set(singerToken, singerTitles)
        }
        singerTitles.add(item.normalizedName)
      }
    }
  }
  return clusters
}

const getCollectionBoosts = (clusters: Map<string, AlbumCluster>) => {
  const boosts = new Map<string, number>()
  for (const [albumKey, cluster] of clusters) {
    const crossSourceTitles = [...cluster.crossSourceTitleSources.entries()]
      .filter(([, sourceOrders]) => sourceOrders.size >= 2)
    const hasRepeatedSinger = [...cluster.singerTitles.values()]
      .some(titles => titles.size >= 2)
    // 普通歌单也可能恰好拥有相同的专辑名。只有曲目有足够多的变化、至少
    // 两首歌被多个平台共同返回，并且存在重复出现的主艺人时，才认为它是
    // 可信的原声/专辑集合。这是有意偏保守的，宁可少加权也不压过精确结果。
    if (
      cluster.titles.size < 3 ||
      cluster.singerTitles.size < 2 ||
      crossSourceTitles.length < 2 ||
      !hasRepeatedSinger
    ) continue
    boosts.set(albumKey, Math.min(28, 20 + (cluster.titles.size - 3) * 2))
  }
  return boosts
}

const getSingleSourceCollectionBoosts = <T>(
  clusters: Map<string, AlbumCluster>,
  query: string,
  items: Array<ScoredSearchRankingItem<T>>,
) => {
  const boosts = new Map<string, number>()
  for (const [albumKey, cluster] of clusters) {
    const hasExactAlbumName = cluster.albumNames.has(query)
    const singerTitleCounts = [...cluster.singerTitles.values()].map(titles => titles.size)
    const hasRepeatedSinger = singerTitleCounts.some(count => count >= 3)
    // 单平台结果没有跨平台共识可用，因此只在“专辑名精确命中查询 +
    // 至少六首曲目 + 主艺人至少出现三首”时识别为可信原声/专辑簇。
    // 这个较高门槛会避开只有一两首同名歌单曲目的普通结果。
    if (!hasExactAlbumName || cluster.titles.size < 6 || cluster.singerTitles.size < 2 || !hasRepeatedSinger) continue

    // 单平台簇只应在它明显是在“纠正同名翻唱/网络上传”时越过精确曲名。
    // 同一主艺人的精确原曲，或跨平台共同返回的精确条目，仍然保留为
    // 锚点；孤立且艺人不在簇内的精确条目更可能是同名翻唱。
    const repeatedSingerTokens = new Set([...cluster.singerTitles.entries()]
      .filter(([, titles]) => titles.size >= 2)
      .map(([singerToken]) => singerToken))
    const hasBlockingExactTitle = items.some(item => {
      if (item.variantPenalty || item.titleStrength != 1 || item.matchingAlbumKeys.includes(albumKey)) return false
      if (item.sourceRanks.length >= 2) return true
      const singerTokens = getSearchSingerTokens(item.singer)
      return singerTokens.length == 0 || singerTokens.some(token => repeatedSingerTokens.has(token))
    })
    if (hasBlockingExactTitle) continue

    // 这类结果通常是用户按电影/专辑名搜索时看到的原声曲目集合。
    // 提升幅度要足以越过一个孤立的同名翻唱，但仍低于同簇内的精确曲名。
    boosts.set(albumKey, Math.min(56, 48 + (cluster.titles.size - 4) * 2))
  }
  return boosts
}

/**
 * 融合各平台搜索结果。平台原始名次是主信号，文本相关性与同一平台专辑 ID 的曲目簇用于处理同名结果。
 */
export const rankSearchItems = <T>(items: Array<SearchRankingItem<T>>, keyword: string, options: SearchRankingOptions = {}): T[] => {
  const query = normalizeSearchText(keyword)
  const scoredItems: Array<ScoredSearchRankingItem<T>> = items.map(item => {
    const normalizedName = normalizeSearchText(item.name)
    const normalizedSinger = normalizeSearchText(item.singer)
    const albumMatches = item.albums.map(album => ({
      key: album.key,
      normalizedName: normalizeSearchText(album.name),
      strength: getMatchStrength(query, normalizeSearchText(album.name)),
    }))
    const titleStrength = getMatchStrength(query, normalizedName)
    const singerStrength = getMatchStrength(query, normalizedSinger)
    const albumStrength = Math.max(0, ...albumMatches.map(album => album.strength))
    const normalizedAlbumNames = albumMatches.map(album => album.normalizedName).filter(Boolean).join('')
    const combinedStrength = getMatchStrength(query, `${normalizedName}${normalizedSinger}${normalizedAlbumNames}`)
    const variantPenalty = getVariantPenalty(keyword, item)
    const bestNativeRank = [...item.sourceRanks]
      .sort((a, b) => a.rank - b.rank || a.sourceOrder - b.sourceOrder)[0]
    const bestRank = bestNativeRank?.rank ?? Number.MAX_SAFE_INTEGER
    const bestSourceOrder = bestNativeRank?.sourceOrder ?? Number.MAX_SAFE_INTEGER
    const combinedScore = Math.max(titleStrength, singerStrength, albumStrength) < 1 ? combinedStrength * 8 : 0

    return {
      ...item,
      normalizedName,
      normalizedSinger,
      matchingAlbumKeys: [...new Set(albumMatches
        .filter(album => album.key && album.strength >= 0.82)
        .map(album => album.key!))],
      titleStrength,
      singerStrength,
      albumStrength,
      variantPenalty,
      bestRank,
      bestSourceOrder,
      // 标题完全命中时给一个小幅确定性优势。专辑集合若有充分跨平台证据
      // 仍会通过 collection boost 胜出；没有证据时则避免普通同名专辑压过
      // 用户明确输入的歌曲名。
      score: getTitleScore(titleStrength) +
        (titleStrength == 1 ? 4 : 0) +
        getFieldScore(singerStrength, 20, 12) +
        getFieldScore(albumStrength, 20, 16) +
        combinedScore +
        getNativeRankScore(item.sourceRanks) -
        variantPenalty,
    }
  })

  // 一至两个字符的查询过于宽泛，不足以判定用户在寻找一整张专辑或电影原声。
  const albumClusters = query.length >= 3
    ? collectAlbumClusters(scoredItems)
    : new Map<string, AlbumCluster>()
  const collectionBoosts = query.length >= 3
    ? getCollectionBoosts(albumClusters)
    : new Map<string, number>()
  const singleSourceCollectionBoosts = options.allowSingleSourceCollection && query.length >= 3
    ? getSingleSourceCollectionBoosts(albumClusters, query, scoredItems)
    : new Map<string, number>()
  const exactTitleItems = scoredItems.filter(item => !item.variantPenalty && item.titleStrength == 1)
  const trustedCollectionKeys = new Set([...collectionBoosts.keys(), ...singleSourceCollectionBoosts.keys()])
  const hasTrustedCollection = trustedCollectionKeys.size > 0
  const isReliableCollectionCanonical = (item: ScoredSearchRankingItem<unknown>) => {
    if (item.variantPenalty || item.titleStrength != 1) return false
    if (item.sourceRanks.length >= 2) return true
    const trustedKeys = item.matchingAlbumKeys.filter(key => trustedCollectionKeys.has(key))
    if (!trustedKeys.length) return false
    const singerTokens = getSearchSingerTokens(item.singer)
    return trustedKeys.some(key => {
      const cluster = albumClusters.get(key)
      if (!cluster) return false
      const repeatedSingers = new Set([...cluster.singerTitles.entries()]
        .filter(([, titles]) => titles.size >= 2)
        .map(([token]) => token))
      return singerTokens.some(token => repeatedSingers.has(token))
    })
  }
  const isUntrustedCollectionEntry = (item: ScoredSearchRankingItem<unknown>) => {
    const isTitleExtension = item.titleStrength >= 0.82 && item.titleStrength < 1 && item.normalizedName.startsWith(query)
    const isExactClone = !item.variantPenalty && item.titleStrength == 1 && !isReliableCollectionCanonical(item)
    if (!isTitleExtension && !isExactClone) return false
    return item.matchingAlbumKeys.some(key => trustedCollectionKeys.has(key)) || isExactClone
  }
  for (const item of scoredItems) {
    const collectionBoost = isUntrustedCollectionEntry(item) ? 0 : Math.max(0, ...item.matchingAlbumKeys.map(key => Math.max(
      collectionBoosts.get(key) ?? 0,
      singleSourceCollectionBoosts.get(key) ?? 0,
    )))
    item.score += collectionBoost
    // 可信的原声/专辑簇本身就是版本语境：其中的 Movie edit、纯享版等
    // 曲目仍应保留，但未指定版本时让无版本词的原曲排在这些变体前面。
    // 单平台场景只恢复部分惩罚；聚合搜索保留原有的集合排序权重。
    if (collectionBoost > 0 && item.variantPenalty) {
      item.score += item.variantPenalty * (options.allowSingleSourceCollection ? 0.4 : 1)
    }
  }

  const hasExactCanonical = scoredItems.some(item => !item.variantPenalty && item.titleStrength == 1)
  if (hasExactCanonical) {
    for (const item of scoredItems) {
      if (item.variantPenalty || item.titleStrength >= 1 || item.albumStrength < 0.82) continue
      const belongsToUntrustedCluster = item.matchingAlbumKeys.some(key => {
        const cluster = albumClusters.get(key)
        return cluster && cluster.titles.size >= 3 && !collectionBoosts.has(key) && !singleSourceCollectionBoosts.has(key)
      })
      // 同名但没有足够跨平台/艺人证据的专辑簇，不应仅凭专辑名把精确
      // 歌曲挤到后面。只有成簇场景减分，避免影响普通的单张专辑搜索。
      if (belongsToUntrustedCluster) item.score -= 16
    }
  }

  // 标题完全命中是歌曲搜索的最高相关性信号。专辑/电影原声集合只有在
  // 没有可信的精确曲名时才允许整体置顶；否则一首平台排名靠后的原曲会
  // 被同一专辑中的 Movie edit 等条目挤到很后面。
  // 当查询词本身是电影/专辑名时，平台常会把“同名翻唱”也标成相同
  // 专辑名。若它不属于可信原声簇且只有单个平台返回，不应被当成
  // canonical 原曲，从而把真正的原声曲目压到后面。
  const canonicalCandidates = exactTitleItems.filter(item => !hasTrustedCollection || isReliableCollectionCanonical(item))
  // 可信原声簇存在但没有可靠的精确锚点时，孤立同名上传不应凭平台
  // 名次压过原声曲目；即使它误用了同一专辑名，也要保留明显的降权。
  if (hasTrustedCollection) {
    for (const item of exactTitleItems) {
      if (!isReliableCollectionCanonical(item)) item.score -= 22
    }
  }
  // “可信”需要专辑名也命中查询，或至少有两个平台共同返回；这样不会让
  // 一个只有“网络歌手/单曲”元数据的同名条目压过有充分原声证据的集合。
  const strongExactTitleItems = canonicalCandidates.filter(item => item.albumStrength >= 0.82 || item.sourceRanks.length >= 2)
  const canonicalItems = strongExactTitleItems.length ? strongExactTitleItems : canonicalCandidates
  const canonicalAnchor = Math.max(0, ...canonicalItems.map(item => item.score))
  // 版本/副标题的边界要参考所有可靠的精确曲名，而不是只取最高分
  // 的那个；否则变体可能插入两个精确原曲之间。
  const canonicalBoundaryItems = canonicalCandidates.length ? canonicalCandidates : canonicalItems
  const canonicalFloor = canonicalBoundaryItems.length
    ? Math.max(0, Math.min(...canonicalBoundaryItems.map(item => item.score)))
    : 0
  if (canonicalAnchor > 0 && query.length >= 2) {
    for (const item of scoredItems) {
      const hasTrustedCollection = item.matchingAlbumKeys.some(key => collectionBoosts.has(key) || singleSourceCollectionBoosts.has(key))
      const isTitleExtension = item.titleStrength >= 0.82 && item.titleStrength < 1 && item.normalizedName.startsWith(query)
      const isUntrustedAlbumOnlyMatch = item.albumStrength >= 0.82 && item.titleStrength < 0.82 && !hasTrustedCollection
      // 同歌手的“原曲 + 副标题/版本后缀”是最常见的误排序来源；即使后缀
      // 未被词典收录，也不能凭平台原始名次压过完全命中的原曲。专辑名只
      // 命中的普通歌单同样要让位给精确曲名，可信原声簇则保留集合加权。
      const shouldFollowCanonical = (strongExactTitleItems.length > 0 &&
        (item.titleStrength < 1 || item.variantPenalty > 0)) ||
        isUntrustedAlbumOnlyMatch ||
        // 查询词开头带副标题/后缀的条目，即使艺人不同，也通常是翻唱或
        // 版本扩展；不能仅凭更靠前的平台名次压过精确原曲。
        (isTitleExtension && exactTitleItems.length > 0) ||
        (item.variantPenalty > 0 && !hasTrustedCollection)
      if (shouldFollowCanonical) item.score = Math.min(item.score, canonicalFloor - 0.001)
    }
  }

  return scoredItems
    .sort((a, b) => b.score - a.score || a.bestRank - b.bestRank || a.bestSourceOrder - b.bestSourceOrder || a.index - b.index)
    .map(item => item.data)
}
