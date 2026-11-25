const fs = require('node:fs')
const path = require('node:path')
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')

const realModules = fs.realpathSync(path.join(__dirname, 'node_modules'))

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  watchFolders: realModules.startsWith(__dirname) ? [] : [realModules],
  resolver: {
    unstable_enableSymlinks: true,
    extraNodeModules: {
      // crypto: require.resolve('react-native-quick-crypto'),
      // stream: require.resolve('stream-browserify'),
      buffer: require.resolve('@craftzdog/react-native-buffer'),
    },
  },
}

module.exports = mergeConfig(getDefaultConfig(__dirname), config)
