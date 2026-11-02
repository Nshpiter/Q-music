export const normalizeArtwork = (value) => {
  if (typeof value != 'string') return ''
  const url = value.trim().replace(/\{size\}/g, '240').replace(/^http:\/\//i, 'https://').replace(/^\/\//, 'https://')
  return /^https:\/\/[^\s]+$/i.test(url) ? url : ''
}

// 不同接口的封面字段不同；优先专辑封面，不用歌手头像冒充歌曲封面。
export const getKugouArtwork = (item) => {
  const values = [item?.album_info?.sizable_cover, item?.album_info?.cover, item?.album_sizable_cover,
    item?.trans_param?.union_cover, item?.TransParam?.union_cover, item?.sizable_cover, item?.cover,
    item?.Image, item?.image, item?.img, item?.imgurl]
  return values.map(normalizeArtwork).find(Boolean) || ''
}
