import { memo } from 'react'
import { Keyboard, StyleSheet, TouchableOpacity, View } from 'react-native'
import { NAV_MENUS } from '@/config/constant'
import { setNavActiveId } from '@/core/common'
import { useI18n } from '@/lang'
import { useNavActiveId } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'

const NavItem = ({ id, icon }: typeof NAV_MENUS[number]) => {
  const activeId = useNavActiveId()
  const theme = useTheme()
  const t = useI18n()
  const active = activeId == id

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      activeOpacity={0.68}
      style={styles.touchTarget}
      onPress={() => {
        Keyboard.dismiss()
        setNavActiveId(id)
      }}
    >
      <View
        style={[
          styles.item,
          active
            ? {
                backgroundColor: theme['q-surface-tint'],
              }
            : null,
        ]}
      >
        <View
          style={[
            styles.iconFace,
            {
              backgroundColor: active ? theme['c-primary-alpha-700'] : 'transparent',
            },
          ]}
        >
          <Icon
            name={icon}
            size={17}
            color={active ? theme['q-accent-text'] : theme['q-text-secondary']}
          />
        </View>
        <Text
          style={styles.label}
          size={10}
          color={active ? theme['q-accent-text'] : theme['q-text-secondary']}
          numberOfLines={1}
        >
          {t(id)}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

export default memo(() => {
  const theme = useTheme()

  return (
    <View
      style={{
        ...styles.container,
        backgroundColor: theme['q-surface-raised'],
        borderTopColor: theme['q-outline'],
      }}
    >
      {NAV_MENUS.map(item => <NavItem key={item.id} {...item} />)}
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  touchTarget: {
    flex: 1,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  item: {
    width: '78%',
    minWidth: 62,
    maxWidth: 96,
    height: 50,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFace: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    width: 58,
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '600',
  },
})
