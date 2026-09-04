import { useImperativeHandle, forwardRef, useMemo, useRef, useState, type Ref } from 'react'
import { View, Animated, TouchableHighlight, StyleSheet } from 'react-native'
import { useWindowSize } from '@/utils/hooks'

import Modal, { type ModalType } from './Modal'

import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from './Text'
import { Icon } from './Icon'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { qFloatingShadow } from '@/theme/ui'

const menuItemHeight = scaleSizeH(44)
const menuItemWidth = scaleSizeW(100)
const MENU_PADDING = 5
const MENU_ITEM_HIT_SLOP = { left: 4, right: 4 } as const

export interface Position { w: number, h: number, x: number, y: number, menuWidth?: number, menuHeight?: number }
export interface MenuSize { width?: number, height?: number }
export type Menus = Readonly<Array<{ action: string, label: string, disabled?: boolean, icon?: React.ReactNode }>>

const styles = createStyle({
  menu: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuContent: {
    padding: MENU_PADDING,
  },
  menuItem: {
    minHeight: 44,
    paddingLeft: 12,
    paddingRight: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  menuItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemIcon: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  menuItemText: {
    flex: 1,
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
  // const fadeAnim = useRef(new Animated.Value(0)).current
  // console.log(buttonPosition)

  const menuItemStyle = useMemo(() => {
    const menuWidth = width ?? menuSize.width ?? menuItemWidth
    return {
      width: Math.max(menuWidth - MENU_PADDING * 2, 1),
      height: Math.max(height ?? menuSize.height ?? menuItemHeight, menuItemHeight),
      menuWidth,
    }
  }, [menuSize, width, height])

  const menuStyle = useMemo(() => {
    let menuHeight = menus.length * menuItemStyle.height + MENU_PADDING * 2
    const topHeight = buttonPosition.y - 20
    const bottomHeight = windowSize.height - buttonPosition.y - buttonPosition.h - 20
    if (menuHeight > topHeight && menuHeight > bottomHeight) menuHeight = Math.max(topHeight, bottomHeight)

    const menuWidth = menuItemStyle.menuWidth
    const bottomSpace = windowSize.height - buttonPosition.y - buttonPosition.h - 20
    const rightSpace = windowSize.width - buttonPosition.x - menuWidth
    const showInBottom = bottomSpace >= menuHeight
    const showInRight = rightSpace >= 20
    const frameStyle: {
      height: number
      width: number
      top: number
      left?: number
      right?: number
    } = {
      height: menuHeight,
      top: showInBottom ? buttonPosition.y + buttonPosition.h : buttonPosition.y - menuHeight,
      width: menuWidth,
    }
    if (showInRight) {
      frameStyle.left = buttonPosition.x
    } else {
      frameStyle.right = windowSize.width - buttonPosition.x - buttonPosition.w
    }
    return frameStyle
  }, [menus.length, menuItemStyle, buttonPosition, windowSize])

  const menuPress = (menu: Menus[number]) => {
    // if (menu.disabled) return
    onPress(menu)
    onHide()
  }

  // console.log('render menu')
  // console.log(activeId)
  // console.log(menuStyle)
  // console.log(menuItemStyle)
  return (
    <View
      style={{
        ...styles.menu,
        ...qFloatingShadow,
        ...menuStyle,
        backgroundColor: theme['q-surface-raised'],
        borderColor: theme['q-outline'],
      }}
      onStartShouldSetResponder={() => true}
    >
      <Animated.ScrollView contentContainerStyle={styles.menuContent} keyboardShouldPersistTaps={'always'}>
        {
          menus.map((menu, index) => (
            menu.disabled
              ? (
                  <View
                    key={menu.action}
                    style={{ ...styles.menuItem, width: menuItemStyle.width, height: menuItemStyle.height, opacity: 0.4 }}
                  >
                    <View style={styles.menuItemContent}>
                      {menu.icon ? <View style={styles.menuItemIcon}>{menu.icon}</View> : null}
                      <Text style={{ ...styles.menuItemText, textAlign: center && !menu.icon ? 'center' : 'left' }} color={theme['q-text-secondary']} size={fontSize} numberOfLines={1}>{menu.label}</Text>
                    </View>
                  </View>
                )
              : menu.action == activeId
                ? (
                    <TouchableHighlight
                      key={menu.action}
                      style={{
                        ...styles.menuItem,
                        width: menuItemStyle.width,
                        height: menuItemStyle.height,
                        backgroundColor: theme['q-surface-tint'],
                      }}
                      accessibilityRole="menuitem"
                      underlayColor={theme['q-surface-tint']}
                      hitSlop={MENU_ITEM_HIT_SLOP}
                      onPress={() => { menuPress(menu) }}
                    >
                      <View style={styles.menuItemContent}>
                        {menu.icon ? <View style={styles.menuItemIcon}>{menu.icon}</View> : null}
                        <Text style={{ ...styles.menuItemText, textAlign: center && !menu.icon ? 'center' : 'left' }} color={theme['q-accent-text']} size={fontSize} numberOfLines={1}>{menu.label}</Text>
                        <Icon name="checkbox-marked" color={theme['q-accent-text']} rawSize={16} />
                      </View>
                    </TouchableHighlight>
                  )
                : (
                    <TouchableHighlight
                      key={menu.action}
                      style={{ ...styles.menuItem, width: menuItemStyle.width, height: menuItemStyle.height }}
                      underlayColor={theme['q-surface-tint']}
                      hitSlop={MENU_ITEM_HIT_SLOP}
                      accessibilityRole="menuitem"
                      onPress={() => { menuPress(menu) }}
                    >
                      <View style={styles.menuItemContent}>
                        {menu.icon ? <View style={styles.menuItemIcon}>{menu.icon}</View> : null}
                        <Text style={{ ...styles.menuItemText, textAlign: center && !menu.icon ? 'center' : 'left' }} color={theme['q-text-primary']} size={fontSize} numberOfLines={1}>{menu.label}</Text>
                      </View>
                    </TouchableHighlight>
                  )

          ))
        }
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
  // console.log(visible)
  const modalRef = useRef<ModalType>(null)
  const [position, setPosition] = useState<Position>({ w: 0, h: 0, x: 0, y: 0 })
  const [menuSize, setMenuSize] = useState<MenuSize>({ })
  const hide = () => {
    modalRef.current?.setVisible(false)
  }
  useImperativeHandle(ref, () => ({
    show(newPosition, menuSize) {
      setPosition(newPosition)
      if (menuSize) setMenuSize(menuSize)
      modalRef.current?.setVisible(true)
    },
    hide() {
      hide()
    },
  }))

  return (
    <Modal onHide={onHide} ref={modalRef}>
      <Menu menus={menus} width={width} height={height} activeId={activeId} buttonPosition={position} menuSize={menuSize} onPress={onPress} onHide={hide} fontSize={fontSize} center={center} />
    </Modal>
  )
}

// export default forwardRef(Component) as ForwardRefFn<MenuType>
export default forwardRef(Component) as <M extends Menus>(p: MenuProps<M> & { ref?: Ref<MenuType> }) => JSX.Element | null
