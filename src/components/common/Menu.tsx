import { useImperativeHandle, forwardRef, useMemo, useRef, useState, type Ref } from 'react'
import { View, Animated, StyleSheet } from 'react-native'
import { useWindowSize } from '@/utils/hooks'

import Modal, { type ModalType } from './Modal'
import Button from './Button'

import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from './Text'
import { Q_UI, qFloatingShadow } from '@/theme/ui'

const MENU_PADDING = 5
const MENU_EDGE_MARGIN = 8
const MENU_MIN_WIDTH = 120
const menuItemHeight = Q_UI.touchSize
const menuItemWidth = 100

export interface Position { w: number, h: number, x: number, y: number, menuWidth?: number, menuHeight?: number }
export interface MenuSize { width?: number, height?: number }
export type Menus = Readonly<Array<{ action: string, label: string, disabled?: boolean, icon?: React.ReactNode }>>

const styles = createStyle({
  menu: {
    position: 'absolute',
    minWidth: 1,
    maxWidth: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    overflow: 'hidden',
  },
  menuContent: {
    padding: MENU_PADDING,
    flexGrow: 1,
  },
  menuItem: {
    minHeight: Q_UI.touchSize,
    paddingLeft: 12,
    paddingRight: 12,
    borderRadius: 9,
    justifyContent: 'center',
  },
  menuItemContent: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  menuItemText: {
    flex: 1,
    minWidth: 0,
  },
  menuItemTrailing: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
})

interface Props<M extends Menus = Menus> {
  menus: Readonly<M>
  onPress?: (menu: M[number]) => void
  buttonPosition: Position
  menuSize: MenuSize
  onHide: () => void
  width?: number
  height?: number
  fontSize?: number
  center?: boolean
  activeId?: M[number]['action'] | null
}

const finiteOr = (value: number | undefined, fallback: number) => {
  return typeof value == 'number' && Number.isFinite(value) ? value : fallback
}

const clamp = (value: number, min: number, max: number) => {
  const upper = Math.max(min, max)
  return Math.min(Math.max(value, min), upper)
}

const Menu = ({
  buttonPosition,
  menuSize,
  menus,
  width,
  height,
  onPress = () => {},
  onHide,
  activeId,
  fontSize = 13,
  center = false,
}: Props) => {
  const theme = useTheme()
  const windowSize = useWindowSize()

  const menuItemStyle = useMemo(() => {
    const requestedWidth = finiteOr(width ?? menuSize.width, menuItemWidth)
    const windowWidth = finiteOr(windowSize.width, requestedWidth + MENU_EDGE_MARGIN * 2)
    const availableWidth = Math.max(1, windowWidth - MENU_EDGE_MARGIN * 2)
    const minMenuWidth = Math.min(MENU_MIN_WIDTH, availableWidth)
    const menuWidth = Math.min(Math.max(requestedWidth, minMenuWidth), availableWidth)
    const itemHeight = Math.max(Q_UI.touchSize, finiteOr(height ?? menuSize.height, menuItemHeight))

    return {
      width: Math.max(1, menuWidth - MENU_PADDING * 2),
      height: itemHeight,
      menuWidth,
    }
  }, [menuSize, width, height, windowSize.width])

  const menuStyle = useMemo(() => {
    const contentHeight = menus.length * menuItemStyle.height + MENU_PADDING * 2
    const windowHeight = finiteOr(windowSize.height, contentHeight + MENU_EDGE_MARGIN * 2)
    const availableHeight = Math.max(1, windowHeight - MENU_EDGE_MARGIN * 2)
    const menuHeight = Math.min(Math.max(contentHeight, 1), availableHeight)
    const windowWidth = finiteOr(windowSize.width, menuItemStyle.menuWidth + MENU_EDGE_MARGIN * 2)
    const menuWidth = Math.min(menuItemStyle.menuWidth, Math.max(1, windowWidth - MENU_EDGE_MARGIN * 2))

    const bottomSpace = windowHeight - buttonPosition.y - buttonPosition.h - MENU_EDGE_MARGIN
    const topSpace = buttonPosition.y - MENU_EDGE_MARGIN
    const showInBottom = bottomSpace >= menuHeight || topSpace < menuHeight
    const preferredTop = showInBottom
      ? buttonPosition.y + buttonPosition.h
      : buttonPosition.y - menuHeight
    const top = clamp(preferredTop, MENU_EDGE_MARGIN, windowHeight - menuHeight - MENU_EDGE_MARGIN)

    const preferredLeft = buttonPosition.x + menuWidth <= windowWidth - MENU_EDGE_MARGIN
      ? buttonPosition.x
      : buttonPosition.x + buttonPosition.w - menuWidth
    const left = clamp(preferredLeft, MENU_EDGE_MARGIN, windowWidth - menuWidth - MENU_EDGE_MARGIN)

    return {
      height: menuHeight,
      top,
      width: menuWidth,
      left,
    }
  }, [menus.length, menuItemStyle, buttonPosition, windowSize])

  const menuPress = (menu: Menus[number]) => {
    if (menu.disabled) return
    onPress(menu)
    onHide()
  }

  return (
    <View
      style={{
        ...styles.menu,
        ...qFloatingShadow,
        ...menuStyle,
        backgroundColor: theme['q-surface-raised'],
        borderColor: theme['q-outline'],
      }}
    >
      <Animated.ScrollView
        contentContainerStyle={styles.menuContent}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {menus.map(menu => (
          menu.disabled
            ? (
                <View
                  key={menu.action}
                  accessible
                  accessibilityRole="menuitem"
                  accessibilityLabel={menu.label}
                  accessibilityState={{ disabled: true }}
                  style={{ ...styles.menuItem, minHeight: Q_UI.touchSize, width: menuItemStyle.width, height: menuItemStyle.height, opacity: 0.42 }}
                >
                  <View style={styles.menuItemContent}>
                    {menu.icon ? <View style={styles.menuItemIcon}>{menu.icon}</View> : null}
                    <Text style={{ ...styles.menuItemText, textAlign: center && !menu.icon ? 'center' : 'left' }} color={theme['q-text-secondary']} size={fontSize} numberOfLines={1} ellipsizeMode="tail">{menu.label}</Text>
                  </View>
                </View>
              )
            : (
                <Button
                  key={menu.action}
                  style={{
                    ...styles.menuItem,
                    minHeight: Q_UI.touchSize,
                    width: menuItemStyle.width,
                    height: menuItemStyle.height,
                    ...(menu.action == activeId ? { backgroundColor: theme['q-surface-tint'] } : null),
                  }}
                  accessibilityRole="menuitem"
                  accessibilityLabel={menu.label}
                  accessibilityState={{ selected: menu.action == activeId }}
                  onPress={() => { menuPress(menu) }}
                >
                  <View style={styles.menuItemContent}>
                    {menu.icon ? <View style={styles.menuItemIcon}>{menu.icon}</View> : null}
                    <Text
                      style={{ ...styles.menuItemText, textAlign: center && !menu.icon ? 'center' : 'left' }}
                      color={menu.action == activeId ? theme['q-accent-text'] : theme['q-text-primary']}
                      size={fontSize}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {menu.label}
                    </Text>
                    {menu.action == activeId
                      ? <View style={styles.menuItemTrailing}><Text accessible={false} size={17} color={theme['q-accent-text']}>✓</Text></View>
                      : null}
                  </View>
                </Button>
              )
        ))}
      </Animated.ScrollView>
    </View>
  )
}

export interface MenuProps<M extends Menus = Menus> {
  menus: M
  onPress: (menu: M[number]) => void
  onHide?: () => void
  width?: number
  height?: number
  fontSize?: number
  center?: boolean
  activeId?: M[number]['action'] | null
}

export interface MenuType {
  show: (position: Position, menuSize?: MenuSize) => void
  hide: () => void
}

const Component = <M extends Menus>({ menus, width, height, activeId, onHide, onPress, fontSize, center }: MenuProps<M>, ref: Ref<MenuType>) => {
  const modalRef = useRef<ModalType>(null)
  const [position, setPosition] = useState<Position>({ w: 0, h: 0, x: 0, y: 0 })
  const [menuSize, setMenuSize] = useState<MenuSize>({})
  const hide = () => {
    modalRef.current?.setVisible(false)
  }
  useImperativeHandle(ref, () => ({
    show(newPosition, newMenuSize) {
      setPosition(newPosition)
      if (newMenuSize) setMenuSize(newMenuSize)
      modalRef.current?.setVisible(true)
    },
    hide() {
      hide()
    },
  }))

  // Menu coordinates come from measure(pageX/pageY). The modal already
  // renders edge-to-edge, so do not add a second status-bar inset.
  return (
    <Modal statusBarPadding={false} onHide={onHide} ref={modalRef}>
      <Menu menus={menus} width={width} height={height} activeId={activeId} buttonPosition={position} menuSize={menuSize} onPress={onPress} onHide={hide} fontSize={fontSize} center={center} />
    </Modal>
  )
}

export default forwardRef(Component) as <M extends Menus>(p: MenuProps<M> & { ref?: Ref<MenuType> }) => JSX.Element | null
