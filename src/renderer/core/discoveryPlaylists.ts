import musicSdk from '@renderer/utils/musicSdk'
import { createDiscoveryLoader } from '@common/utils/discoveryPlaylists'

export { discoveryChoices } from '@common/utils/discoveryPlaylists'
export const getDiscoveryPlaylists = createDiscoveryLoader(async(source, sort, tag, page) => musicSdk[source].songList.getList(sort, tag, page))
