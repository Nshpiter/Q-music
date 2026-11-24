import { pathToFileURL } from 'node:url'
import { trackFiles } from './trackFiles'

const files = trackFiles('q-music.cover-overrides')
export const coverOverride = (track: LX.Music.MusicInfo) => {
  const path = files.get(track)
  return path ? pathToFileURL(path).href : ''
}
export const setCoverOverride = files.set
