const path = require('path')
const ESLintPlugin = require('eslint-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')

const isDev = process.env.NODE_ENV === 'development'

module.exports = {
  target: 'electron-main',
  node: { __dirname: false },
  output: {
    filename: '[name].js',
    library: {
      type: 'commonjs2',
    },
    path: path.join(__dirname, '../../dist'),
  },
  externals: {
    'steam-user': 'steam-user',
    'steam-session': 'steam-session',
    'font-list': 'font-list',
    'better-sqlite3': 'better-sqlite3',
    'electron-font-manager': 'electron-font-manager',
    bufferutil: 'bufferutil',
    'utf-8-validate': 'utf-8-validate',
    'qrc_decode.node': isDev ? path.join(__dirname, '../../build/Release/qrc_decode.node') : path.join('../build/Release/qrc_decode.node'),
  },
  resolve: {
    alias: {
      '@main': path.join(__dirname, '../../src/main'),
      '@renderer': path.join(__dirname, '../../src/renderer'),
      '@lyric': path.join(__dirname, '../../src/renderer-lyric'),
      '@common': path.join(__dirname, '../../src/common'),
    },
    extensions: ['.tsx', '.ts', '.js', '.mjs', '.json', '.node'],
  },
  module: {
    rules: [
      {
        test: /\.node$/,
        use: 'node-loader',
      },
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new ESLintPlugin(),
    new CopyWebpackPlugin({
      patterns: [
        ...['react', 'react-dom'].flatMap(name => {
          const root = path.dirname(require.resolve(name + '/package.json'))
          return [
            { from: path.join(root, 'umd', name + '.production.min.js'), to: 'betterPlugins/' + name + '.js', info: { minimized: true } },
            { from: path.join(root, 'LICENSE'), to: 'betterPlugins/licenses/' + name + '.txt' },
          ]
        }),
        { from: path.resolve(__dirname, '../../src/main/modules/betterPlugins/view'), to: 'betterPlugins', info: { minimized: true } },
        { from: path.resolve(__dirname, '../../src/main/modules/miniPlayer/view'), to: 'miniPlayer' },
        { from: path.resolve(__dirname, '../../src/main/modules/taskbarLyricsView/timedLine.js'), to: 'miniPlayer/timedLine.js' },
        { from: path.resolve(__dirname, '../../src/main/modules/taskbarLyricsView'), to: 'taskbarLyrics' },
      ],
    }),
  ],
}
