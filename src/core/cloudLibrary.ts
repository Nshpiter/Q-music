import { NativeModules } from 'react-native'

export interface CloudConfig {
  provider: 's3' | 'webdav'
  endpoint: string
  region: string
  bucket: string
  prefix: string
  accessKey: string
  secretKey: string
}
export type CloudProvider = CloudConfig['provider']
export type SavedCloudConfig = Partial<CloudConfig> & { provider: CloudProvider, configured: boolean }

export interface CloudTrack {
  id: string
  name: string
  singer: string
  fileName: string
  size: number
  playlist: string
}

interface NativeCloudLibrary {
  getConfig: () => Promise<string>
  selectProvider: (provider: CloudProvider) => Promise<string>
  saveConfig: (value: string) => Promise<void>
  list: (password: string) => Promise<string[]>
  upload: (path: string, password: string, playlist: string, name: string, singer: string) => Promise<string>
  download: (ids: string[], password: string) => Promise<Array<CloudTrack & { filePath: string }>>
}

const native = NativeModules.CloudLibraryModule as NativeCloudLibrary

export const getCloudConfig = async(): Promise<SavedCloudConfig> => JSON.parse(await native.getConfig())
export const selectCloudProvider = async(provider: CloudProvider): Promise<SavedCloudConfig> => JSON.parse(await native.selectProvider(provider))
export const saveCloudConfig = async(config: CloudConfig) => native.saveConfig(JSON.stringify(config))
export const listCloudTracks = async(password: string): Promise<CloudTrack[]> => (await native.list(password)).map(value => JSON.parse(value) as CloudTrack)
export const uploadCloudTrack = async(path: string, password: string, playlist: string, name: string, singer: string): Promise<CloudTrack> => JSON.parse(await native.upload(path, password, playlist, name, singer))
export const importCloudTracks = async(ids: string[], password: string) => native.download(ids, password)
