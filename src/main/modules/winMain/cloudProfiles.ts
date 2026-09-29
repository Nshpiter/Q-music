import type { CloudConfig, CloudProvider } from './cloudStorage'

export interface CloudProfiles {
  activeProvider: CloudProvider
  profiles: Partial<Record<CloudProvider, CloudConfig>>
}

export const emptyProfiles = (): CloudProfiles => ({ activeProvider: 's3', profiles: {} })

export const normalizeProfiles = (saved: CloudConfig | CloudProfiles): CloudProfiles => {
  if ('profiles' in saved) {
    const profiles = { s3: saved.profiles.s3, webdav: saved.profiles.webdav }
    const activeProvider = saved.activeProvider === 'webdav' ? 'webdav' : saved.activeProvider === 's3' ? 's3' : profiles.s3 ? 's3' : profiles.webdav ? 'webdav' : 's3'
    return { activeProvider, profiles }
  }
  if (!['s3', 'webdav'].includes(saved.provider)) return emptyProfiles()
  return { activeProvider: saved.provider, profiles: { [saved.provider]: saved } }
}

export const withProfile = (store: CloudProfiles, input: CloudConfig): CloudProfiles => {
  const previous = store.profiles[input.provider]
  const config = { ...input }
  if (previous && !config.secretKey) config.secretKey = previous.secretKey
  return { activeProvider: config.provider, profiles: { ...store.profiles, [config.provider]: config } }
}
