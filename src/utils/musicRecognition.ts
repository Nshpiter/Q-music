export interface RecognitionSong { id: string, name: string, singer: string, album: string, source?: 'wy' | 'kg' }
export interface RecognitionSample { pcm: string, duration: number, rms: number }

export const parseKugouRecognitionResults = (body: any): RecognitionSong[] => {
  if (body?.status != 1 || body.error_code != 0 || !Array.isArray(body.data)) throw new Error('recognition_service_error')
  const results: RecognitionSong[] = []
  const seen = new Set<string>()
  for (const item of body.data) {
    const id = String(item?.mixsongid ?? item?.songid ?? '')
    if (!/^[1-9]\d*$/.test(id) || typeof item.songname != 'string' || !item.songname.trim() || seen.has(id)) continue
    seen.add(id)
    results.push({ id, source: 'kg', name: item.songname.trim().slice(0, 300), singer: typeof item.singername == 'string' ? item.singername.slice(0, 300) : '', album: typeof item.album?.[0]?.albumname == 'string' ? item.album[0].albumname.slice(0, 300) : '' })
    if (results.length == 5) break
  }
  return results
}

// 只保留识别结果需要的字段；不把接口里的播放地址当作播放授权。
export const parseRecognitionResults = (body: any): RecognitionSong[] => {
  if (body?.code != 200 || !body.data || !('result' in body.data)) throw new Error('recognition_service_error')
  if (body.data.result == null) return []
  if (!Array.isArray(body.data.result)) throw new Error('recognition_service_error')
  const seen = new Set<string>()
  const results: RecognitionSong[] = []
  for (const item of body.data.result) {
    const song = item?.song
    if (!Number.isSafeInteger(song?.id) || song.id <= 0 || typeof song.name != 'string' || !song.name.trim()) continue
    const id = String(song.id)
    if (seen.has(id)) continue
    seen.add(id)
    results.push({
      id,
      name: song.name.trim().slice(0, 300),
      singer: Array.isArray(song.artists) ? song.artists.map((artist: any) => typeof artist?.name == 'string' ? artist.name.trim() : '').filter(Boolean).join('、').slice(0, 300) : '',
      album: typeof song.album?.name == 'string' ? song.album.name.slice(0, 300) : '',
    })
    if (results.length == 5) break
  }
  return results
}

export const recognitionUrl = (fingerprint: string, duration: number, sessionId: string) => {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(fingerprint) || fingerprint.length > 16000 || duration < 3 || duration > 6 || !Number.isFinite(duration)) throw new Error('recognition_engine_error')
  return 'https://interface.music.163.com/api/music/audio/match?' +
    `sessionId=${encodeURIComponent(sessionId)}&algorithmCode=shazam_v2&duration=${duration.toFixed(3)}&rawdata=${encodeURIComponent(fingerprint)}&times=1&decrypt=1`
}

// 取消后到达的权限结果、解码结果、指纹及网络响应均不得更新新一轮识别。
export class RecognitionSession {
  private revision = 0
  begin() { return ++this.revision }
  cancel() { ++this.revision }
  current(id: number) { return id == this.revision }
}
