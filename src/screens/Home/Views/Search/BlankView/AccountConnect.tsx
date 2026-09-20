import { View } from 'react-native'
import Text from '@/components/common/Text'
import SourceLogo from '@/components/SourceLogo'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import Button from '@/components/common/Button'
import { Icon } from '@/components/common/Icon'
import { pushMusicAccountScreen } from '@/navigation/navigation'
import commonState from '@/store/common/state'

export default () => {
  const theme = useTheme()
  const t = useI18n()

  return (
    <View
      style={{
        ...styles.container,
        backgroundColor: theme['q-surface-raised'],
        borderColor: theme['q-outline'],
      }}
    >
      <View style={styles.header}>
        <View style={styles.copy}>
          <Text size={17} style={styles.title} color={theme['q-text-primary']}>{t('search_account_title')}</Text>
          <Text size={12} style={styles.subtitle} color={theme['q-text-secondary']}>{t('mobile_account_hint')}</Text>
        </View>
      </View>
      <Button
        accessibilityLabel={t('setting_music_account_title')}
        style={{ ...styles.accountAction, backgroundColor: theme['q-surface-tint'] }}
        onPress={() => {
          if (commonState.componentIds.home) pushMusicAccountScreen(commonState.componentIds.home)
        }}
      >
        <View style={styles.accountLogos}>
          <SourceLogo source="tx" size={24} />
          <SourceLogo source="wy" size={24} />
        </View>
        <Text size={13} style={styles.copy} color={theme['q-accent-text']}>{t('setting_music_account_title')}</Text>
        <Icon accessible={false} name="chevron-right" rawSize={18} color={theme['q-accent-text']} />
      </Button>
    </View>
  )
}

const styles = createStyle({
  accountAction: { minHeight: 56, paddingHorizontal: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountLogos: { flexDirection: 'row', gap: 4 },
  container: {
    marginBottom: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  copy: {
    flex: 1,
  },
  title: {
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
    lineHeight: 16,
  },
})
