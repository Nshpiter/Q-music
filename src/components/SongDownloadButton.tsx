import { memo, useState } from 'react'
import { ActivityIndicator } from 'react-native'
import Button from '@/components/common/Button'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import useAdaptiveLayout from '@/utils/hooks/useAdaptiveLayout'
import { downloadSelection } from '@/core/download/selection'
import { useI18n } from '@/lang'

export default memo(({ music }: { music: LX.Music.MusicInfo }) => {
  const theme = useTheme()
  const { isCar } = useAdaptiveLayout()
  const t = useI18n()
  const [busy, setBusy] = useState(false)
  if (music.source == 'local') return null
  return <Button accessibilityLabel={`${t('download')} · ${music.name}`} disabled={busy} accessibilityState={{ busy, disabled: busy }}
    style={{ width: isCar ? 56 : 44, minHeight: 44, alignSelf: 'stretch', flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}
    onPress={() => {
      setBusy(true)
      void downloadSelection([music]).finally(() => { setBusy(false) })
    }}>
    {busy ? <ActivityIndicator size="small" color={theme['q-accent-text']} /> : <Icon accessible={false} name="download-2" size={18} color={theme['q-text-secondary']} />}
  </Button>
})
