import { useRef, useState } from 'react'
import { StyleSheet, type PressableProps, type PressableStateCallbackType } from 'react-native'

import Menu, { type MenuType, type MenuProps, type Menus } from './Menu'
import Button, { type BtnType, type BtnProps } from './Button'
import { Q_UI } from '@/theme/ui'

export interface DorpDownMenuProps<T extends Menus> extends Omit<MenuProps<T>, 'width'> {
  children: React.ReactNode
  btnStyle?: BtnProps['style']
  menuWidth?: number
  accessibilityLabel?: string
  accessibilityHint?: string
  accessibilityState?: PressableProps['accessibilityState']
  disabled?: boolean
}

export default <T extends Menus>({
  menus,
  onPress,
  onHide,
  height,
  fontSize,
  center,
  children,
  activeId,
  btnStyle,
  menuWidth,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  disabled = false,
}: DorpDownMenuProps<T>) => {
  const buttonRef = useRef<BtnType>(null)
  const menuRef = useRef<MenuType>(null)
  const [expanded, setExpanded] = useState(false)
  const triggerStyle = typeof btnStyle === 'function'
    ? (state: PressableStateCallbackType) => [styles.trigger, btnStyle(state)]
    : [styles.trigger, btnStyle]

  const hideMenu = () => {
    setExpanded(false)
    onHide?.()
  }

  const showMenu = () => {
    if (disabled) return
    buttonRef.current?.measure((fx, fy, width, measuredHeight, px, py) => {
      const triggerWidth = Math.max(Q_UI.touchSize, Math.ceil(width))
      const triggerHeight = Math.max(Q_UI.touchSize, Math.ceil(measuredHeight))
      setExpanded(true)
      menuRef.current?.show({ x: Math.ceil(px), y: Math.ceil(py), w: triggerWidth, h: triggerHeight }, {
        width: menuWidth ?? triggerWidth,
        height: triggerHeight,
      })
    })
  }

  return (
    <>
      <Button
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ ...accessibilityState, expanded, disabled }}
        disabled={disabled}
        style={triggerStyle}
        ref={buttonRef}
        onPress={showMenu}
      >
        {children}
      </Button>
      {/* Keep the native Modal outside the Pressable. Android otherwise treats
          the popup as part of the trigger's hit region on some ROMs. */}
      <Menu
        ref={menuRef}
        menus={menus}
        center={center}
        onPress={onPress}
        onHide={hideMenu}
        width={menuWidth}
        fontSize={fontSize}
        height={height}
        activeId={activeId}
      />
    </>
  )
}

const styles = StyleSheet.create({
  trigger: {
    minWidth: Q_UI.touchSize,
    minHeight: Q_UI.touchSize,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
  },
})
