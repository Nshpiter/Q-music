import { Linking, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import SourceLogo from '@/components/SourceLogo'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { qSurfaceShadow } from '@/theme/ui'
import { createStyle, toast } from '@/utils/tools'

const PROVIDERS = [
  { id: 'tx', url: 'https://y.qq.com/n/ryqq/profile' },
  { id: 'wy', url: 'https://music.163.com/#/login' },
  { id: 'kg', url: 'https://www.kugou.com/' },
  { id: 'spotify', url: 'https://accounts.spotify.com/login' },
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
      <View style={styles.copy}>
        <Text size={17} style={styles.title} color={theme['q-text-primary']}>{t('search_account_title')}</Text>
        <Text size={11} style={styles.subtitle} color={theme['q-text-secondary']}>{t('search_account_subtitle')}</Text>
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
            <SourceLogo source={provider.id} size={28} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const styles = createStyle({
  container: {
    minHeight: 88,
    marginBottom: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  copy: {
    flex: 1,
    paddingRight: 10,
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
    gap: 7,
  },
  provider: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
