import { eapiRequest } from './utils/index'
import { formatPlayTime, sizeFormate } from '../../index'
import { formatSingerName } from '../utils'

export default {
  /**
   * 获取歌手信息
   * @param {*} id
   */
  getInfo(id) {
    return eapiRequest('/api/artist/head/info/get', { id }).promise.then(({ body }) => {
      if (!body || body.code != 200) throw new Error('get singer info faild.')
      return {
        source: 'wy',
        id: body.artist.id,
        info: {
          name: body.artist.name,
          desc: body.artist.briefDesc,
          avatar: body.user?.avatarUrl ?? body.artist.picUrl,
          gender: body.user?.gender === 1 ? 'man' : 'woman',
        },
        count: {
          music: body.artist.musicSize,
          album: body.artist.albumSize,
        },
      }
    })
  },
  /**
   * 获取歌手歌曲列表
   * @param {*} id
   * @param {*} page
   * @param {*} limit
   */
  getSongList(id, page = 1, limit = 100) {
    return eapiRequest('/api/v2/artist/songs', {
      id,
      limit,
      offset: limit * (page - 1),
    }).promise.then(({ body }) => {
      if (!Array.isArray(body?.songs) || body.code != 200) throw new Error('get singer song list faild.')

      const list = this.filterSongList(body.songs)
      return {
        list,
        limit,
        page,
        total: Number.isSafeInteger(body.total) ? body.total : (page - 1) * limit + list.length + Number(body.more === true),
        source: 'wy',
      }
    })
  },
  /**
   * 获取歌手专辑列表
   * @param {*} id
   * @param {*} page
   * @param {*} limit
   */
  getAlbumList(id, page = 1, limit = 10) {
    return eapiRequest(`/api/artist/albums/${id}`, {
      limit,
      offset: limit * (page - 1),
    }).promise.then(({ body }) => {
      if (!Array.isArray(body?.hotAlbums) || body.code != 200) throw new Error('get singer album list faild.')

      const list = this.filterAlbumList(body.hotAlbums)
      return {
        source: 'wy',
        list,
        limit,
        page,
        total: body.artist.albumSize,
      }
    })
  },
  filterAlbumList(raw) {
    const list = []
    raw.forEach(item => {
      if (!item.id) return
      list.push({
        id: item.id,
        count: item.size,
        info: {
          name: item.name,
          author: formatSingerName(item.artists),
          img: item.picUrl,
          desc: null,
        },
      })
    })
    return list
  },
  filterSongList(raw) {
    const list = []
    raw.forEach(item => {
      if (!item?.id) return

      const types = []
      const _types = {}
      const formats = [
        ['128k', item.l ?? item.lMusic, 128000],
        ['320k', item.h ?? item.hMusic, 320000],
        ['flac', item.sq ?? item.sqMusic, 999000],
        ['flac24bit', item.hr ?? item.hrMusic, 1999000],
      ]
      for (const [type, file, rate] of formats) {
        if (!file && !item.privilege?.chargeInfoList?.some(info => info.rate === rate)) continue
        const size = file?.size ? sizeFormate(file.size) : null
        types.push({ type, size })
        _types[type] = { size }
      }
      const album = item.al ?? item.album
      list.push({
        singer: formatSingerName(item.ar ?? item.artists ?? []),
        name: item.name,
        albumName: album?.name ?? '',
        albumId: album?.id,
        songmid: item.id,
        source: 'wy',
        interval: formatPlayTime((item.dt ?? item.duration ?? 0) / 1000),
        img: album?.picUrl ?? null,
        lrc: null,
        otherSource: null,
        types,
        _types,
        typeUrl: {},
      })
    })
    return list
  },
}
