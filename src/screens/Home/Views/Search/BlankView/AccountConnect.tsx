import { Linking, StyleSheet, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import SourceLogo from '@/components/SourceLogo'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { qSurfaceShadow } from '@/theme/ui'
import { createStyle, toast } from '@/utils/tools'

const PROVIDERS = [
  { id: 'tx', nameKey: 'source_real_tx', url: 'https://y.qq.com/n/ryqq/profile' },
  { id: 'wy', nameKey: 'source_real_wy', url: 'https://music.163.com/#/login' },
  { id: 'kg', nameKey: 'source_real_kg', url: 'https://www.kugou.com/' },
  { id: 'spotify', nameKey: 'source_real_spotify', url: 'https://accounts.spotify.com/login' },
] as const

export default () => {
  const theme = useTheme()
  const t = useI18n()

  const openProvider = async(url: string) => {
    try {
      await Linking.openURL(url)
    } catch {
      toast(t('search_account_open_failed'))
    }
  }

  return (
    <View
      style={{
        ...styles.container,
        ...qSurfaceShadow,
        backgroundColor: theme['q-surface-raised'],
        borderColor: theme['q-outline'],
      }}
    >
      <View style={styles.header}>
        <View style={styles.copy}>
          <Text size={17} style={styles.title} color={theme['q-text-primary']}>{t('search_account_title')}</Text>
          <Text size={11} style={styles.subtitle} color={theme['q-text-secondary']}>{t('search_account_subtitle')}</Text>
        </View>
      </View>
      <View style={styles.providers}>
        {PROVIDERS.map(provider => (
          <TouchableOpacity
            key={provider.id}
            accessibilityRole="button"
            activeOpacity={0.65}
            style={{ ...styles.provider, backgroundColor: theme['q-surface-base'], borderColor: theme['q-outline'] }}
            onPress={() => { void openProvider(provider.url) }}
          >
            <SourceLogo source={provider.id} size={32} />
            <View style={styles.providerCopy}>
              <Text size={13} style={styles.providerName} color={theme['q-text-primary']} numberOfLines={1}>{t(provider.nameKey)}</Text>
              <Text size={10} color={theme['q-text-secondary']}>{t('search_account_open_official')}</Text>
            </View>
            <Text size={18} color={theme['q-text-secondary']}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const styles = createStyle({
  container: {
    minHeight: 176,
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
  providers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  provider: {
    width: '47%',
    flexGrow: 1,
    minHeight: 58,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 15,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 9,
  },
  providerName: {
    marginBottom: 2,
    fontWeight: '600',
  },
})
