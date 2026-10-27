import { memo } from 'react'
import { Image, ScrollView, StyleSheet, View } from 'react-native'
import { useNavActiveId, useStatusbarHeight } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { Icon } from '@/components/common/Icon'
import { createStyle, exitApp as backHome } from '@/utils/tools'
import { NAV_MENUS } from '@/config/constant'
import type { InitState } from '@/store/common/state'
import { setNavActiveId } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import useAdaptiveLayout from '@/utils/hooks/useAdaptiveLayout'

const NAV_WIDTH = 64

const Header = () => {
  const statusBarHeight = useStatusbarHeight()
  return (
    <View style={{ paddingTop: statusBarHeight }}>
      <View style={styles.header}>
        <Image source={require('../../../resources/images/q-music.png')} style={styles.logo} />
      </View>
    </View>
  )
}

type IdType = InitState['navActiveId'] | 'back_home'

const MenuItem = ({ id, icon, onPress }: {
  id: IdType
  icon: string
  onPress: (id: IdType) => void
}) => {
  const activeId = useNavActiveId()
  const theme = useTheme()
  const t = useI18n()
  const active = activeId == id
  const { isCar } = useAdaptiveLayout()
  const iconContent = (
    <View style={styles.iconContent}>
      <Icon
        accessible={false}
        name={icon}
        size={isCar ? 25 : 22}
        color={active ? theme['q-accent-text'] : theme['q-text-secondary']}
      />
    </View>
  )

  return (
    <Button
      accessibilityLabel={t(id)}
      accessibilityState={{ selected: active }}
      style={[styles.menuItem, { height: isCar ? 76 : 72 }]}
      onPress={() => { onPress(id) }}
    >
      <View
        style={[
          styles.activeItem,
          { width: isCar ? 84 : 72, height: isCar ? 66 : 62 },
          active
            ? {
                backgroundColor: theme['q-surface-tint'],
                borderColor: theme['q-outline'],
              }
            : { borderColor: 'transparent' },
        ]}
      >
        {iconContent}
        <Text style={{ fontWeight: active ? '600' : '400' }} size={isCar ? 14 : 12} numberOfLines={1} color={active ? theme['q-accent-text'] : theme['q-text-secondary']}>{t(id)}</Text>
      </View>
    </Button>
  )
}

export default memo(() => {
  const theme = useTheme()
  const showBackBtn = useSettingValue('common.showBackBtn')
  const { railWidth, isCar, navigationPosition } = useAdaptiveLayout()
  const statusBarHeight = useStatusbarHeight()

  const handlePress = (id: IdType) => {
    switch (id) {
      case 'back_home':
        backHome()
        return
    }

    global.app_event.changeMenuVisible(false)
    setNavActiveId(id)
  }

  return (
    <View
      style={{
        ...styles.container,
        width: railWidth,
        paddingTop: isCar ? statusBarHeight : 0,
        backgroundColor: theme['q-surface-base'],
        borderColor: theme['q-outline'],
        borderRightWidth: navigationPosition == 'left' ? StyleSheet.hairlineWidth : 0,
        borderLeftWidth: navigationPosition == 'right' ? StyleSheet.hairlineWidth : 0,
      }}
    >
      {!isCar ? <Header /> : null}
      <ScrollView style={styles.menus} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {NAV_MENUS.map(menu => (
          <MenuItem key={menu.id} id={menu.id} icon={menu.icon} onPress={handlePress} />
        ))}
      </ScrollView>
      <View style={styles.footer}>
        {showBackBtn ? <MenuItem id="back_home" icon="home" onPress={handlePress} /> : null}
      </View>
    </View>
  )
})

const styles = createStyle({
  container: {
    flexGrow: 0,
    width: NAV_WIDTH,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  header: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 30,
    height: 30,
  },
  menus: {
    flex: 1,
  },
  list: {
    paddingTop: 2,
    paddingBottom: 8,
  },
  menuItem: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContent: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeItem: {
    width: 52,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  footer: {
    paddingBottom: 8,
  },
})
