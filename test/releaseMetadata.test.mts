import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

interface VersionMetadata {
  version: string
  desc: string
  history: Array<{ version: string, desc: string }>
  commit?: string
}

const readJson = async<T>(path: string): Promise<T> => JSON.parse(await readFile(path, 'utf8'))

const assertUsefulReleaseNotes = (metadata: VersionMetadata, expectedVersion: string) => {
  assert.equal(metadata.version, expectedVersion)
  assert.ok(metadata.desc.trim().length >= 80)
  assert.match(metadata.desc, new RegExp(`(?:^|\\s)${expectedVersion.replaceAll('.', '\\.')}\\b`))
  assert.doesNotMatch(metadata.desc.trim(), /^\*\*Full Changelog\*\*:/i)

  const historyVersions = metadata.history.map(item => item.version)
  assert.equal(new Set(historyVersions).size, historyVersions.length)
  assert.ok(!historyVersions.includes(expectedVersion))
}

test('桌面端与 Android 更新元数据包含当前版本的人工发布说明', async() => {
  const packageInfo = await readJson<{ version: string }>('package.json')
  const desktopMetadata = await readJson<VersionMetadata>('publish/version.json')
  const mobileMetadata = await readJson<VersionMetadata>('publish/mobile-version.json')
  const changeLog = await readFile('publish/changeLog.md', 'utf8')

  assertUsefulReleaseNotes(desktopMetadata, packageInfo.version)
  assertUsefulReleaseNotes(mobileMetadata, packageInfo.version)
  assert.match(mobileMetadata.commit ?? '', /^[a-f\d]{40}$/)
  assert.match(changeLog, new RegExp(`^Q-music ${packageInfo.version.replaceAll('.', '\\.')}$`, 'm'))
})

test('发布工作流只允许带人工说明的 Release 流程', async() => {
  const windowsWorkflow = await readFile('.github/workflows/release-windows.yml', 'utf8')
  const androidWorkflow = await readFile('.github/workflows/release-android.yml', 'utf8')
  const archWorkflow = await readFile('.github/workflows/build-arch.yml', 'utf8')

  assert.match(windowsWorkflow, /--notes-file/)
  assert.match(windowsWorkflow, /--verify-tag/)
  assert.match(windowsWorkflow, /--draft/)
  assert.match(windowsWorkflow, /q-music-managed-release/)
  assert.doesNotMatch(windowsWorkflow, /--generate-notes/)
  assert.doesNotMatch(androidWorkflow, /gh\s+release\s+create/)
  assert.doesNotMatch(archWorkflow, /gh\s+release\s+create/)
  assert.match(androidWorkflow, /release_notes_are_human/)
  assert.match(archWorkflow, /release_notes_are_human/)
})
