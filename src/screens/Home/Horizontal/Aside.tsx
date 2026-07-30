import { memo } from 'react'
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import { useNavActiveId, useStatusbarHeight } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { Icon } from '@/components/common/Icon'
import { confirmDialog, createStyle, exitApp as backHome } from '@/utils/tools'
import { NAV_MENUS } from '@/config/constant'
import type { InitState } from '@/store/common/state'
import { exitApp, setNavActiveId } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import { Q_UI } from '@/theme/ui'

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

type IdType = InitState['navActiveId'] | 'nav_exit' | 'back_home'

const MenuItem = ({ id, icon, onPress }: {
  id: IdType
  icon: string
  onPress: (id: IdType) => void
}) => {
  const activeId = useNavActiveId()
  const theme = useTheme()
  const active = activeId == id
  const iconContent = (
    <View
      style={{
        ...styles.iconContent,
        backgroundColor: active ? theme['c-primary-dark-100'] : 'transparent',
      }}
    >
      <Icon
        name={icon}
        size={18}
        color={active ? '#fff' : theme['q-text-secondary']}
      />
    </View>
  )

  return active
    ? (
        <View style={styles.menuItem}>
          <View
            style={{
              ...styles.activeItem,
              backgroundColor: theme['q-surface-tint'],
              borderColor: theme['c-primary-alpha-700'],
            }}
          >
            {iconContent}
          </View>
        </View>
      )
    : (
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.menuItem}
          onPress={() => { onPress(id) }}
        >
          {iconContent}
        </TouchableOpacity>
      )
}

export default memo(() => {
  const theme = useTheme()
  const showBackBtn = useSettingValue('common.showBackBtn')
  const showExitBtn = useSettingValue('common.showExitBtn')

  const handlePress = (id: IdType) => {
    switch (id) {
      case 'nav_exit':
        void confirmDialog({
          message: global.i18n.t('exit_app_tip'),
          confirmButtonText: global.i18n.t('list_remove_tip_button'),
        }).then(isExit => {
          if (!isExit) return
          exitApp('Exit Btn')
        })
        return
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
        backgroundColor: theme['q-surface-base'],
        borderRightColor: theme['q-outline'],
      }}
    >
      <Header />
      <ScrollView style={styles.menus} contentContainerStyle={styles.list}>
        {NAV_MENUS.map(menu => (
          <MenuItem key={menu.id} id={menu.id} icon={menu.icon} onPress={handlePress} />
        ))}
      </ScrollView>
      <View style={styles.footer}>
        {showBackBtn ? <MenuItem id="back_home" icon="home" onPress={handlePress} /> : null}
        {showExitBtn ? <MenuItem id="nav_exit" icon="exit2" onPress={handlePress} /> : null}
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
    borderRadius: Q_UI.radius.item,
  },
  activeItem: {
    width: 52,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Q_UI.radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  footer: {
    paddingBottom: 8,
  },
})
