import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import Button from './common/Button'
import Text from './common/Text'
import { useKugouVerification } from './MusicAddModal/useKugouVerification'
import { verifyKugouAccess } from '@/core/musicAccount/kugou'
import type { KugouVerificationStatus } from '@/utils/kugouVerification'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'

export default ({ disabled = false, onVerified, onBusy }: { disabled?: boolean, onVerified?: () => void, onBusy?: (busy: boolean) => void }) => {
  const t = useI18n()
  const theme = useTheme()
  const { present, dialog } = useKugouVerification()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<KugouVerificationStatus>()
  const running = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const verify = async() => {
    if (disabled || running.current) return
    running.current = true; setBusy(true); setStatus(undefined); onBusy?.(true)
    try {
      const result = await verifyKugouAccess(present)
      if (!mounted.current) return
      setStatus(result)
      if (result == 'available') onVerified?.()
    } finally {
      running.current = false
      if (mounted.current) { setBusy(false); onBusy?.(false) }
    }
  }
  return <View style={{ gap: 6, marginVertical: 8 }}>
    <Button disabled={disabled || busy} onPress={() => { void verify() }} style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, backgroundColor: theme['q-surface-tint'] }}>
      <Text size={13} color={theme['q-accent-text']}>{t(busy ? 'kugou_verify_working' : 'kugou_verify_action')}</Text>
    </Button>
    {status ? <Text size={12} style={{ lineHeight: 18 }} accessibilityLiveRegion="polite" color={theme['q-text-secondary']}>{t(`kugou_verify_${status}`)}</Text> : null}
    {dialog}
  </View>
}
