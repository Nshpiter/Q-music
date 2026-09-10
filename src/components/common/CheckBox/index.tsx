import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, TouchableOpacity } from 'react-native'
import CheckBox from './Checkbox'

import { createStyle, tipDialog } from '@/utils/tools'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { useTheme } from '@/store/theme/hook'
import Text from '../Text'
import { Icon } from '../Icon'

export interface CheckBoxProps {
  check: boolean
  label?: string
  children?: React.ReactNode
  onChange: (check: boolean) => void
  disabled?: boolean
  need?: boolean
  size?: number
  marginRight?: number
  marginBottom?: number

  helpTitle?: string
  helpDesc?: string
}

export default ({ check, label, children, onChange, helpTitle, helpDesc, disabled = false, need = false, marginRight = 0, marginBottom = 0, size = 1 }: CheckBoxProps) => {
  const theme = useTheme()
  const [isDisabled, setDisabled] = useState(false)
  const tintColors = {
    true: theme['q-accent'],
    false: theme['q-outline'],
  }
  const disabledTintColors = {
    true: theme['c-primary-alpha-600'],
    false: theme['q-outline'],
  }

  useEffect(() => {
    if (need) {
      if (check) {
        if (!isDisabled) setDisabled(true)
      } else {
        if (isDisabled) setDisabled(false)
      }
    } else {
      isDisabled && setDisabled(false)
    }
  }, [check, need, isDisabled])

  const handleLabelPress = useCallback(() => {
    if (isDisabled) return
    onChange?.(!check)
  }, [isDisabled, onChange, check])

  const helpComponent = useMemo(() => {
    const handleShowHelp = () => {
      void tipDialog({
        title: helpTitle ?? '',
        message: helpDesc,
        btnText: global.i18n.t('understand'),
      })
    }
    return (helpTitle ?? helpDesc) ? (
      <TouchableOpacity
        style={{ ...styles.helpBtn, backgroundColor: theme['q-surface-base'] }}
        onPress={handleShowHelp}
      >
        <Icon size={14 * size} color={theme['q-text-secondary']} name="help" />
      </TouchableOpacity>
    ) : null
  }, [helpTitle, helpDesc, size, theme])


  const contentStyle = { ...styles.content, marginBottom: scaleSizeH(marginBottom) }
  const labelStyle = { ...styles.label, marginRight: scaleSizeW(marginRight) }

  return (
    disabled
      ? (
          <View style={contentStyle}>
            <CheckBox status={check ? 'checked' : 'unchecked'} variant={need ? 'radio' : 'checkbox'} disabled={true} tintColors={disabledTintColors} size={size} />
            <View style={labelStyle}>{label ? <Text style={styles.name} color={theme['q-text-secondary']} size={14 * size}>{label}</Text> : children}</View>
            {helpComponent}
          </View>
        )
      : (
          <View style={contentStyle}>
            <CheckBox status={check ? 'checked' : 'unchecked'} variant={need ? 'radio' : 'checkbox'} disabled={isDisabled} onPress={handleLabelPress} tintColors={tintColors} size={size} />
            <TouchableOpacity style={labelStyle} activeOpacity={0.3} onPress={handleLabelPress}>
              {label ? <Text style={styles.name} color={theme['q-text-primary']} size={14 * size}>{label}</Text> : children}
            </TouchableOpacity>
            {helpComponent}
          </View>
        )
  )
}

const styles = createStyle({
  content: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 40,
    marginRight: 12,
    alignItems: 'center',
    flexDirection: 'row',
  },
  label: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 40,
    marginLeft: 3,
    paddingRight: 3,
    justifyContent: 'center',
  },
  name: {
    lineHeight: 20,
  },
  helpBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

