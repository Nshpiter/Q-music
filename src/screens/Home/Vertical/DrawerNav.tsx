import { memo } from 'react'
import { Image, ScrollView, StyleSheet, View } from 'react-native'
import { useI18n } from '@/lang'
import { useNavActiveId, useStatusbarHeight } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { Icon } from '@/components/common/Icon'
import { confirmDialog, createStyle, exitApp as backHome } from '@/utils/tools'
import { NAV_MENUS } from '@/config/constant'
import type { InitState } from '@/store/common/state'
import { exitApp, setNavActiveId } from '@/core/common'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import { Q_UI } from '@/theme/ui'
import Button from '@/components/common/Button'

const Header = () => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()

  return (
    <View
      style={{
        ...styles.headerSurface,
        paddingTop: statusBarHeight,
      }}
    >
      <View style={styles.header}>
        <Image source={require('../../../resources/images/q-music.png')} style={styles.logo} />
        <Text style={styles.headerText} size={17} color={theme['q-text-primary']}>Q-music</Text>
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
  const t = useI18n()
  const activeId = useNavActiveId()
  const theme = useTheme()
  const active = activeId == id
  const content = (
    <>
      <View
        style={{
          ...styles.iconContent,
          backgroundColor: active ? theme['c-primary-dark-100'] : theme['q-surface-base'],
          borderColor: active ? theme['c-primary-dark-100'] : theme['q-outline'],
        }}
      >
        <Icon
          accessible={false}
          name={icon}
          size={18}
          color={active ? '#fff' : theme['q-text-secondary']}
        />
      </View>
      <Text
        style={styles.text}
        size={13}
        color={active ? theme['q-accent-text'] : theme['q-text-primary']}
        numberOfLines={1}
      >
        {t(id)}
      </Text>
    </>
  )

  return (
    <Button
      accessibilityLabel={t(id)}
      accessibilityState={{ selected: active }}
      style={[
        styles.menuItem,
        active
          ? {
              backgroundColor: theme['q-surface-tint'],
              borderColor: theme['c-primary-alpha-700'],
              borderWidth: StyleSheet.hairlineWidth,
            }
          : null,
      ]}
      onPress={() => { onPress(id) }}
    >
      {content}
    </Button>
  )
}

export default memo(() => {
  const theme = useTheme()
  const showBackBtn = useSettingValue('common.showBackBtn')
  const showExitBtn = useSettingValue('common.showExitBtn')
  const drawerPosition = useSettingValue('common.drawerLayoutPosition')

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
        borderColor: theme['q-outline'],
        borderLeftWidth: drawerPosition == 'right' ? StyleSheet.hairlineWidth : 0,
        borderRightWidth: drawerPosition == 'left' ? StyleSheet.hairlineWidth : 0,
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
    flex: 1,
  },
  headerSurface: {
    flexGrow: 0,
  },
  header: {
    height: 64,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 18,
  },
  headerText: {
    marginLeft: 11,
    fontWeight: '600',
  },
  logo: {
    width: 36,
    height: 36,
  },
  menus: {
    flex: 1,
  },
  list: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  menuItem: {
    height: 48,
    flexDirection: 'row',
    marginLeft: 12,
    marginRight: 12,
    marginTop: 3,
    marginBottom: 3,
    paddingLeft: 12,
    paddingRight: 12,
    alignItems: 'center',
    borderRadius: Q_UI.radius.control,
  },
  iconContent: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    flex: 1,
    paddingLeft: 12,
    fontWeight: '600',
  },
  footer: {
    paddingBottom: 8,
  },
})
