import { memo, useCallback } from 'react'

import { StyleSheet, View } from 'react-native'
import type { InputProps } from '@/components/common/Input'
import Input from '@/components/common/Input'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import Button from '@/components/common/Button'


export interface TextAreaItemProps extends InputProps {
  value: string
  label: string
  onOnlineMatch?: () => void
  onChanged?: (text: string) => void
}

export default memo(({ value, label, onOnlineMatch, onChanged, style, ...props }: TextAreaItemProps) => {
  const theme = useTheme()
  const handleRemove = useCallback(() => {
    onChanged?.('')
  }, [onChanged])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label} size={14}>{label}</Text>
        {
          onChanged ? (
            <View style={styles.btns}>
              <Button accessibilityLabel={global.i18n.t('metadata_edit_modal_form_remove_lyric')} style={styles.actionBtn} onPress={handleRemove}>
                <Text size={13} color={theme['c-button-font']}>{global.i18n.t('metadata_edit_modal_form_remove_lyric')}</Text>
              </Button>
              <Button accessibilityLabel={global.i18n.t('metadata_edit_modal_form_match_lyric')} style={styles.actionBtn} onPress={onOnlineMatch}>
                <Text size={13} color={theme['c-button-font']}>{global.i18n.t('metadata_edit_modal_form_match_lyric')}</Text>
              </Button>
            </View>
          ) : null
        }
      </View>
      <Input
        value={value}
        onChangeText={onChanged}
        scrollEnabled={false}
        textAlignVertical='top'
        multiline
        style={StyleSheet.compose({ ...styles.textarea, backgroundColor: theme['c-primary-input-background'] }, style)}
        {...props}
       />
    </View>
  )
})

const styles = createStyle({
  container: {
    // paddingLeft: 25,
    marginBottom: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 30,
  },
  label: {
    marginBottom: 2,
  },
  btns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 6,
  },
  actionBtn: {
    minHeight: 40,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textarea: {
    flexGrow: 1,
    flexShrink: 1,
    paddingTop: 3,
    paddingBottom: 3,
    height: 'auto',
    // height: 300,
    // maxWidth: 300,
  },
})
