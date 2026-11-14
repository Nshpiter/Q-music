import { assertAccountSession, openAccountSession, wyClientLogRequest, type AccountSession } from './requests'

export interface PlaybackIdentity { key: string, songId: string, sourceId: string }

export const MIN_REPORT_SECONDS = 5

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

const common = (identity: PlaybackIdentity) => ({ id: Number(identity.songId), type: 'song', mainsite: '1', mainsiteWeb: '1', content: `id=${Number(identity.sourceId)}` })

// startplay 登记「最近播放」；只有接口明确返回 200 才视作请求成功，不代表平台已经入库。
export const reportPlaybackStart = async(session: AccountSession, identity: PlaybackIdentity, playedSeconds: number) => {
  if (session.provider != 'wy' || !Number.isFinite(playedSeconds) || playedSeconds < MIN_REPORT_SECONDS) return
  await assertAccountSession(session)
  await wyClientLogRequest(session, { action: 'startplay', json: common(identity) })
}

// play 在本次播放结束时按实际收听秒数发送，用于听歌排行。
export const reportPlaybackFinish = async(session: AccountSession, identity: PlaybackIdentity, playedSeconds: number) => {
  if (session.provider != 'wy' || !Number.isFinite(playedSeconds) || playedSeconds < MIN_REPORT_SECONDS) return
  await assertAccountSession(session)
  await wyClientLogRequest(session, {
    action: 'play',
    json: { ...common(identity), download: 0, end: 'playend', sourceId: identity.sourceId, time: Math.floor(playedSeconds), wifi: 0, source: 'list' },
  })
}
