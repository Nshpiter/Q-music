import { ActivityIndicator, StyleSheet, View } from 'react-native'

import Button from '@/components/common/Button'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { qSurfaceShadow } from '@/theme/ui'

export type ContentStatus = 'loading' | 'error' | 'empty'

export default ({ status, onRetry }: {
  status: ContentStatus
  onRetry?: () => void
}) => {
  const theme = useTheme()
  const t = useI18n()

  const title = status == 'loading'
    ? t('list_loading')
    : status == 'error'
      ? t('load_failed')
      : t('no_item')

  return (
    <View style={styles.container}>
      <View
        style={{
          ...styles.iconFace,
          backgroundColor: theme['q-surface-tint'],
          borderColor: theme['q-outline'],
        }}
      >
        {status == 'loading'
          ? <ActivityIndicator color={theme['q-accent']} />
          : <Icon accessible={false} name={status == 'error' ? 'close' : 'album'} color={theme['q-accent-text']} rawSize={23} />}
      </View>
      <Text style={styles.title} size={15} color={theme['q-text-primary']}>{title}</Text>
      {status == 'error' && onRetry
        ? (
            <Button
              accessibilityRole="button"
              accessibilityLabel={t('list_retry')}
              style={{
                ...styles.retryButton,
                ...qSurfaceShadow,
                backgroundColor: theme['q-accent'],
              }}
              onPress={onRetry}
            >
              <Icon name="available_updates" color={theme['q-on-accent']} rawSize={15} />
              <Text size={13} color={theme['q-on-accent']}>{t('list_retry')}</Text>
            </Button>
          )
        : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    minHeight: 280,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFace: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  retryButton: {
    minWidth: 112,
    minHeight: 48,
    marginTop: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    overflow: 'hidden',
  },
})
