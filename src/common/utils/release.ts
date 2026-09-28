export const isDesktopRelease = (release: { assets?: Array<{ name?: string }> }) => {
  return release.assets?.some(asset => /(?:^latest(?:-mac|-linux)?\.yml$|\.(?:exe|dmg|appimage|deb|rpm|pacman)$)/i.test(asset.name ?? '')) ?? false
}
