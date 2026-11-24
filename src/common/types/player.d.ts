declare namespace LX {
  namespace Player {
    interface ProgressBarOptions {
      progress: number
      mode?: Electron.ProgressBarOptions['mode']
    }

    type StatusButtonActions = 'unCollect'
    | 'collect'
    | 'prev'
    | 'pause'
    | 'play'
    | 'next'
    | 'seek'
    | 'volume'
    | 'mute'
    | 'playMode'

    interface LyricInfo extends LX.Music.LyricInfo {
      rawlrcInfo: LX.Music.LyricInfo
    }

    interface TimedWord {
      text: string
      start: number
      duration: number
    }

    interface Status {
      songId?: string
      detailVisible?: boolean
      songSource?: LX.Source
      playMethod?: LX.AppSetting['player.togglePlayMethod']
      status: 'playing' | 'paused' | 'error' | 'stoped'
      name: string
      singer: string
      albumName: string
      picUrl: string
      progress: number
      duration: number
      playbackRate: number
      lyricLineText: string
      lyricLineWords: TimedWord[]
      lyricLineAllText: string
      lyric: string
      tlyric: string
      rlyric: string
      lxlyric: string
      collect: boolean
      volume: number
      mute: boolean
    }
  }
}
