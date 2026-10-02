import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Keyboard, View } from 'react-native'
import Input, { type InputType } from '@/components/common/Input'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { confirmDialog, createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createUserList } from '@/core/list'
import listState from '@/store/list/state'
import { Q_UI } from '@/theme/ui'

export default ({ disabled = false, onBusyChange }: {
  disabled?: boolean
  onBusyChange?: (busy: boolean) => void
}) => {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const busyRef = useRef(false)
  const mountedRef = useRef(true)
  const inputRef = useRef<InputType>(null)
  const t = useI18n()
  const theme = useTheme()

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])
  useEffect(() => {
    if (!editing) return
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => { cancelAnimationFrame(frame) }
  }, [editing])

  const cancel = () => {
    if (busyRef.current) return
    Keyboard.dismiss()
    setEditing(false)
    setText('')
    setError('')
  }
  const save = async() => {
    const name = text.trim()
    if (!name || disabled || busyRef.current) return
    busyRef.current = true
    setSaving(true)
    setError('')
    onBusyChange?.(true)
    try {
      if (listState.userList.some(list => list.name == name) && !(await confirmDialog({ message: t('list_duplicate_tip') }))) return
      if (!mountedRef.current) return
      await createUserList(listState.userList.length, [{ id: 'userlist_' + Date.now(), name, locationUpdateTime: null }])
      if (!mountedRef.current) return
      Keyboard.dismiss()
      setEditing(false)
      setText('')
    } catch {
      if (mountedRef.current) setError(t('list_create_failed'))
    } finally {
      busyRef.current = false
      if (mountedRef.current) { setSaving(false); onBusyChange?.(false) }
    }
  }

  return editing
    ? <View style={[styles.editor, { backgroundColor: theme['q-surface-tint'], borderColor: theme['q-outline'] }]}>
        <Input
          accessibilityLabel={t('list_create_input_placeholder')}
          placeholder={t('list_create_input_placeholder')}
          value={text}
          onChangeText={value => { setText(value); setError('') }}
          ref={inputRef}
          editable={!disabled && !saving}
          returnKeyType="done"
          onSubmitEditing={() => { void save() }}
          containerStyle={styles.input}
        />
        {error ? <Text accessibilityRole="alert" size={12} color={theme['q-text-secondary']}>{error}</Text> : null}
        <View style={styles.actions}>
          <Button accessibilityLabel={t('cancel')} disabled={saving} style={styles.action} onPress={cancel}>
            <Text size={14} color={theme['q-text-secondary']}>{t('cancel')}</Text>
          </Button>
          <Button
            accessibilityLabel={t('list_create')}
            accessibilityState={{ busy: saving }}
            disabled={disabled || saving || !text.trim()}
            style={[styles.action, { backgroundColor: theme['q-surface-base'] }]}
            onPress={() => { void save() }}
          >
            {saving ? <ActivityIndicator size="small" color={theme['q-accent-text']} /> : null}
            <Text size={14} color={theme['q-accent-text']}>{t(saving ? 'list_create_saving' : 'list_create')}</Text>
          </Button>
        </View>
      </View>
    : <Button
        accessibilityLabel={t('list_create')}
        disabled={disabled}
        style={[styles.create, { borderColor: theme['q-outline'] }]}
        onPress={() => { setEditing(true) }}
      >
        <Icon accessible={false} name="add_folder" rawSize={20} color={theme['q-accent-text']} />
        <Text size={14} color={theme['q-accent-text']}>{t('list_create')}</Text>
      </Button>
}

const styles = createStyle({
  create: { minHeight: 56, borderWidth: 1, borderStyle: 'dashed', borderRadius: Q_UI.radius.control, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  editor: { padding: 12, borderWidth: 1, borderRadius: Q_UI.radius.control, gap: 10 },
  input: { flexGrow: 0 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  action: { minHeight: Q_UI.touchSize, paddingHorizontal: 14, borderRadius: Q_UI.radius.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
})
