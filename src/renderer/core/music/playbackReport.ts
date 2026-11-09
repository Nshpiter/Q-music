import type { PlaybackSourceInfo } from '@renderer/store/player/state'

export interface PlaybackReportIdentity {
  provider: 'wy'
  songId: string
  sourceId?: string
}

interface PlaybackReportInfo {
  provider: 'tx' | 'wy'
  songId: string
  mediaId?: string
  sourceId?: string
}

// 上报身份来自用户选择的原曲，解析到的跨平台线路仅用于播放。
export const originalReportIdentity = (music: LX.Music.MusicInfo): PlaybackReportIdentity | null => {
  if (music.source != 'wy') return null
  const songId = String(music.meta.songId ?? '')
  if (!/^[1-9]\d*$/.test(songId)) return null
  const albumId = String(music.meta.albumId ?? '')
  return { provider: 'wy', songId, sourceId: /^\d+$/.test(albumId) ? albumId : '0' }
}

export const playbackReportInfo = (source: PlaybackSourceInfo | null, currentKey: string): PlaybackReportInfo | null => {
  if (!source || !currentKey || source.musicKey != currentKey) return null
  // 本地/下载文件没有在线原曲的播放上下文，不能沿用旧线路身份。
  if (source.mode == 'local' || source.mode == 'download') return null
  const original = source.reportIdentity
  if (original?.provider == 'wy' && /^[1-9]\d*$/.test(original.songId)) return original
  if (source.mode != 'official' || (source.resolvedSource != 'tx' && source.resolvedSource != 'wy') || !source.resolvedSongId) return null
  if (source.resolvedSource == 'wy' && (source.requestedSource != 'wy' || !/^[1-9]\d*$/.test(source.resolvedSongId))) return null
  return { provider: source.resolvedSource, songId: source.resolvedSongId, mediaId: source.resolvedMediaId || undefined, sourceId: source.officialSourceId || undefined }
}
