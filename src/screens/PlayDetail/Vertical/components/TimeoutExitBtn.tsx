import { memo, useRef } from 'react'
import { StyleSheet } from 'react-native'
import TimeoutExitEditModal, { type TimeoutExitEditModalType, useTimeInfo } from '@/components/TimeoutExitEditModal'
import { useTimeoutExitTimeInfo } from '@/core/player/timeoutExit'
import { useTheme } from '@/store/theme/hook'
import Button from '@/components/common/Button'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import Btn from './Btn'

const formatCompactCountdown = (seconds: number) => {
  const s = Math.max(0, Math.trunc(seconds))
  const h = Math.trunc(s / 3600)
  const m = Math.trunc((s % 3600) / 60).toString().padStart(2, '0')
  const sec = Math.trunc(s % 60).toString().padStart(2, '0')
  return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`
}

export default memo(() => {
  const theme = useTheme()
  const modalRef = useRef<TimeoutExitEditModalType>(null)

  const timeInfo = useTimeInfo()
  const countdown = useTimeoutExitTimeInfo()

  const handleShow = () => {
    modalRef.current?.show()
  }

  return (
    <>
      {timeInfo.active || timeInfo.isPlayedStop ? (
        <Button
          accessibilityRole="button"
          accessibilityLabel={timeInfo.isPlayedStop ? global.i18n.t('timeout_exit_btn_wait_tip') : global.i18n.t('timeout_exit_tip_on', { time: formatCompactCountdown(countdown.time) })}
          pressScale={0.94}
          onPress={handleShow}
          style={[
            styles.activePill,
            {
              backgroundColor: theme['q-surface-tint'],
              borderColor: theme['c-primary-alpha-700'],
            },
          ]}
        >
          <Icon accessible={false} name="music_time" rawSize={15} color={theme['q-accent-text']} />
          <Text size={11} style={styles.countdownText} color={theme['q-accent-text']}>
            {timeInfo.isPlayedStop ? '♪' : formatCompactCountdown(countdown.time)}
          </Text>
        </Button>
      ) : (
        <Btn
          icon="music_time"
          accessibilityLabel={global.i18n.t('timeout_exit_tip_off')}
          color={theme['c-font']}
          onPress={handleShow}
        />
      )}
      <TimeoutExitEditModal ref={modalRef} timeInfo={timeInfo} />
    </>
  )
})

const styles = StyleSheet.create({
  activePill: {
    alignSelf: 'center',
    minHeight: 32,
    paddingHorizontal: 10,
    marginRight: 4,
    borderRadius: 999,
    borderWidth: 0.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  countdownText: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
})
