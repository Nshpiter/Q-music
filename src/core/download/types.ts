export type DownloadStatus = 'waiting' | 'run' | 'error' | 'completed'

export interface DownloadTaskInfo {
  id: string
  status: DownloadStatus
  statusText: string
  /** 0 - 100 */
  progress: number
  downloaded: number
  total: number
  speed: string
  musicInfo: LX.Music.MusicInfoOnline
  quality: LX.Quality
  fileName: string
  filePath: string | null
}
