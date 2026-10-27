import { useState } from 'react'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import { hideDesktopLyric } from '@/core/desktopLyric'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { toast } from '@/utils/tools'

// 仅给曾开启悬浮歌词的旧用户保留关闭路径；手机不再显示桌面歌词设置。
export default () => {
  const enabled = useSettingValue('desktopLyric.enable')
  const t = useI18n()
  const [busy, setBusy] = useState(false)
  if (!enabled) return null
  return <Button disabled={busy} style={{ minHeight: 48, padding: 16 }} onPress={() => {
    setBusy(true)
    void hideDesktopLyric().then(() => { updateSetting({ 'desktopLyric.enable': false }) }).catch(() => { toast(t('legacy_overlay_close_failed')) }).finally(() => { setBusy(false) })
  }}><Text size={13}>{t('legacy_overlay_close')}</Text></Button>
}
