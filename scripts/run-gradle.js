const { spawnSync } = require('node:child_process')
const path = require('node:path')

const isWindows = process.platform === 'win32'
const executable = isWindows ? 'gradlew.bat' : './gradlew'
const result = spawnSync(executable, process.argv.slice(2), {
  cwd: path.join(__dirname, '..', 'android'),
  shell: isWindows,
  stdio: 'inherit',
})

if (result.error) throw result.error
process.exitCode = result.status ?? 1
