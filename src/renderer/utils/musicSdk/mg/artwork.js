// 咪咕歌单返回相对图片路径；统一补全域名，避免被移动端当成本地文件。
export const getMiguArtwork = (...values) => {
  for (const value of values) {
    if (typeof value != 'string') continue
    const url = value.trim()
    if (/^https?:\/\//.test(url)) return url
    if (url.startsWith('//')) return 'https:' + url
    if (url.startsWith('/')) return 'https://d.musicapp.migu.cn' + url
  }
  return ''
}
