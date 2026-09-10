import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { WebView } from 'react-native-webview'

import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { pop } from '@/navigation'
import { isMusicAccountConnected, logoutMusicAccount } from '@/core/musicAccount'
import type { MusicAccountProvider } from '@/core/musicAccount'

const LOGIN_URLS = {
  tx: 'https://y.qq.com/n/ryqq/profile',
  wy: 'https://music.163.com/#/login',
} as const

const PROVIDERS: MusicAccountProvider[] = ['tx', 'wy']

export default ({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const t = useI18n()
  const [provider, setProvider] = useState<MusicAccountProvider>('tx')
  const [connected, setConnected] = useState<Record<MusicAccountProvider, boolean | null>>({ tx: null, wy: null })
  const [reloadKey, setReloadKey] = useState(0)

  const checkConnections = useCallback(() => {
    void Promise.all(PROVIDERS.map(async(p) => {
      try {
        return [p, await isMusicAccountConnected(p)] as const
      } catch {
        return [p, false] as const
      }
    })).then((results) => {
      setConnected(Object.fromEntries(results) as Record<MusicAccountProvider, boolean>)
    })
  }, [])

  useEffect(() => {
    checkConnections()
  }, [checkConnections, reloadKey])

  const handleBack = () => {
    void pop(componentId)
  }

  const handleLogout = async() => {
    await logoutMusicAccount(provider)
    setReloadKey(key => key + 1)
  }

  return (
    <View style={{ ...styles.container, backgroundColor: theme['c-main-background'] }}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.7} onPress={handleBack}>
          <Text size={16} color={theme['c-font']}>{'‹'}</Text>
        </TouchableOpacity>
        <Text size={16} color={theme['c-font']}>{t('setting_music_account_title')}</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.providerBar}>
        {
          PROVIDERS.map(p => {
            const active = p == provider
            const state = connected[p]
            return (
              <TouchableOpacity
                key={p}
                style={{ ...styles.providerBtn, borderColor: active ? theme['q-accent'] : theme['q-outline'] }}
                activeOpacity={0.7}
                onPress={() => { setProvider(p) }}
              >
                <Text size={13} color={active ? theme['q-accent-text'] : theme['c-font-label']}>
                  {t(p == 'tx' ? 'setting_music_account_qq' : 'setting_music_account_netease')}
                </Text>
                <Text size={10} color={state == null ? theme['q-text-secondary'] : state ? theme['q-accent'] : theme['q-text-secondary']}>
                  {state == null ? '' : state ? t('setting_music_account_connected') : t('setting_music_account_disconnected')}
                </Text>
              </TouchableOpacity>
            )
          })
        }
        {
          connected[provider]
            ? (
              <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.7} onPress={() => { void handleLogout() }}>
                <Text size={12} color={theme['q-accent-text']}>{t('setting_music_account_logout')}</Text>
              </TouchableOpacity>
              )
            : null
        }
      </View>

      <View style={styles.webWrap}>
        <WebView
          key={reloadKey}
          source={{ uri: LOGIN_URLS[provider] }}
          style={styles.webview}
          userAgent="Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
          onNavigationStateChange={() => {
            // 登录跳转完成后延迟刷新连接状态
            setTimeout(checkConnections, 1500)
          }}
          incognito={false}
          thirdPartyCookiesEnabled
          domStorageEnabled
        />
      </View>

      <Text size={11} color={theme['q-text-secondary']} style={styles.tip}>{t('setting_music_account_tip')}</Text>
    </View>
  )
}

// 状态栏区域由 RNN topBar 关闭后 statusBar.drawBehind 处理，头部自行预留高度
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  providerBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
  logoutBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  webWrap: {
    flex: 1,
    overflow: 'hidden',
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
  },
  webview: {
    flex: 1,
  },
  tip: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
})
