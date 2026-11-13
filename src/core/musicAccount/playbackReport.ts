import { assertAccountSession, openAccountSession, wyRequest, type AccountSession } from './requests'

export interface PlaybackIdentity { key: string, songId: string, sourceId: string }

// 身份始终来自播放队列，不能使用换源后同名歌曲的 ID。
export const originalPlaybackIdentity = (music: LX.Player.PlayMusic | null): PlaybackIdentity | null => {
  if (!music || 'progress' in music || music.source != 'wy') return null
  const songId = String(music.meta.songId)
  if (!/^\d+$/.test(songId) || !Number.isSafeInteger(Number(songId)) || Number(songId) <= 0) return null
  const albumId = String(music.meta.albumId ?? '')
  const sourceId = /^\d+$/.test(albumId) && Number.isSafeInteger(Number(albumId)) ? albumId : '0'
  return { key: music.id, songId, sourceId }
}

export const openPlaybackSession = async() => openAccountSession('wy')

export const reportPlayback = async(session: AccountSession, identity: PlaybackIdentity, playedSeconds: number) => {
  if (session.provider != 'wy' || !Number.isFinite(playedSeconds) || playedSeconds < 5) return
  await assertAccountSession(session)
  const sourceId = Number(identity.sourceId)
  const common = { id: Number(identity.songId), type: 'song', mainsite: '1', mainsiteWeb: '1', content: `id=${sourceId}` }
  // 官方网页播放日志协议；只有接口明确返回 200 才视作成功。
  await wyRequest(session, 'feedback/weblog', {
    logs: JSON.stringify([
      { action: 'startplay', json: common },
      { action: 'play', json: { ...common, download: 0, end: 'playend', sourceId, time: Math.floor(playedSeconds), wifi: 0, source: 'list' } },
    ]),
  })
}
