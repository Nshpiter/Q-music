import musicSdk from '@/utils/musicSdk'
import { createDiscoveryLoader } from '@/utils/discoveryPlaylists'

export { discoveryChoices } from '@/utils/discoveryPlaylists'
export const getDiscoveryPlaylists = createDiscoveryLoader(async(source, sort, tag, page) => musicSdk[source].songList.getList(sort, tag, page))
