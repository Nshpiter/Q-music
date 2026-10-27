import { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import ChoosePath, { type ChoosePathType } from '@/components/common/ChoosePath'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import DownloadEntry from '@/components/DownloadEntry'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { toast } from '@/utils/tools'
import { DEFAULT_DOWNLOAD_DIRECTORY, getDownloadDirectory, saveDownloadDirectory } from '@/core/download/location'
import Section from '../components/Section'

export default () => {
  const theme = useTheme()
  const t = useI18n()
  const selected = useSettingValue('download.directory')
  const picker = useRef<ChoosePathType>(null)
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const save = async(path: string) => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    try {
      await saveDownloadDirectory(path)
      toast(t('download_directory_saved'))
    } catch (error) {
      toast(t(error instanceof Error && error.message == 'storage_all_files_unconfirmed' ? 'storage_all_files_unconfirmed' : 'download_directory_failed'), 'long')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return <>
    <Section title={t('download_directory')}>
      <View style={styles.content}>
        <Text selectable size={13} style={styles.path} color={theme['q-text-primary']}>{getDownloadDirectory()}</Text>
        <Text size={12} style={styles.hint} color={theme['q-text-secondary']}>{t('download_directory_hint')}</Text>
        <View style={styles.actions}>
          <Button disabled={busy} onPress={() => { picker.current?.show({ title: t('download_directory_choose'), dirOnly: true }) }} style={[styles.button, { backgroundColor: theme['q-surface-tint'] }]}><Text size={13} color={theme['q-accent-text']}>{t(busy ? 'loading' : 'download_directory_choose')}</Text></Button>
          {selected ? <Button disabled={busy} onPress={() => { void save(DEFAULT_DOWNLOAD_DIRECTORY) }} style={styles.button}><Text size={13} color={theme['q-text-secondary']}>{t('download_directory_reset')}</Text></Button> : null}
        </View>
      </View>
    </Section>
    <DownloadEntry />
    <ChoosePath ref={picker} onConfirm={path => { void save(path) }} />
  </>
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 16, gap: 14 },
  path: { lineHeight: 21 },
  hint: { lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
})
