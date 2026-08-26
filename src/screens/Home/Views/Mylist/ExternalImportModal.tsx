import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import Input from '@/components/common/Input'
import Text from '@/components/common/Text'
import { LIST_IDS } from '@/config/constant'
import { useI18n } from '@/lang'
import type { Message } from '@/lang'
import listState from '@/store/list/state'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import SourceLogo from '@/components/SourceLogo'
import {
  ExternalImportError,
  getDefaultImportListName,
  importExternalPlaylist,
  type ExternalImportProgress,
  type ExternalImportSource,
  type ExternalImportTarget,
} from './importPlaylist'

export interface ExternalImportModalType {
  show: (currentListId: string) => void
}

const SOURCE_OPTIONS: Array<{ id: ExternalImportSource, name: string }> = [
  { id: 'tx', name: 'QQ音乐' },
  { id: 'wy', name: '网易云' },
  { id: 'kg', name: '酷狗' },
  { id: 'spotify', name: 'Spotify' },
]

const ERROR_MESSAGE_KEYS: Partial<Record<ExternalImportError['code'], keyof Message>> = {
  missing_token: 'playlist_import_modal__error_missing_token',
  invalid_link: 'playlist_import_modal__error_invalid_link',
  no_match: 'playlist_import_modal__error_no_match',
}

const PROGRESS_STAGE_KEYS: Record<ExternalImportProgress['stage'], keyof Message> = {
  fetch: 'playlist_import_modal__stage_fetch',
  match: 'playlist_import_modal__stage_match',
  save: 'playlist_import_modal__stage_save',
}

export default forwardRef<ExternalImportModalType>((props, ref) => {
  const dialogRef = useRef<DialogType>(null)
  const cancelRequestedRef = useRef(false)
  const theme = useTheme()
  const t = useI18n()
  const [source, setSource] = useState<ExternalImportSource>('tx')
  const [text, setText] = useState('')
  const [listName, setListName] = useState('')
  const [target, setTarget] = useState<ExternalImportTarget>('new')
  const [currentListId, setCurrentListId] = useState<string>(LIST_IDS.DEFAULT)
  const [neteaseToken, setNeteaseToken] = useState('')
  const [spotifyAccessToken, setSpotifyAccessToken] = useState('')
  const [spotifySavedTracks, setSpotifySavedTracks] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [isError, setIsError] = useState(false)

  const reset = useCallback(() => {
    setSource('tx')
    setText('')
    setListName('')
    setTarget('new')
    setNeteaseToken('')
    setSpotifyAccessToken('')
    setSpotifySavedTracks(false)
    setStatusText('')
    setIsError(false)
    setIsLoading(false)
    cancelRequestedRef.current = false
  }, [])

  useImperativeHandle(ref, () => ({
    show(listId) {
      reset()
      setCurrentListId(listId)
      requestAnimationFrame(() => {
        dialogRef.current?.setVisible(true)
      })
    },
  }), [reset])

  const currentListName = useMemo(() => {
    switch (currentListId) {
      case LIST_IDS.DEFAULT:
        return t('list_name_default')
      case LIST_IDS.LOVE:
        return t('list_name_love')
      case LIST_IDS.TEMP:
        return t('list_name_temp')
      default:
        return listState.allList.find(list => list.id == currentListId)?.name ?? t('list_name_default')
    }
  }, [currentListId, t])

  const targetOptions = useMemo<Array<{ id: ExternalImportTarget, name: string }>>(() => [
    {
      id: 'new',
      name: t('playlist_import_modal__target_new'),
    },
    {
      id: 'current',
      name: t('playlist_import_modal__target_current', { name: currentListName }),
    },
    {
      id: 'love',
      name: t('list_name_love'),
    },
  ], [currentListName, t])

  const defaultListName = getDefaultImportListName(source, spotifySavedTracks)
  const isSpotify = source == 'spotify'
  const canSubmit = !isLoading && (
    isSpotify
      ? !!spotifyAccessToken.trim() && (spotifySavedTracks || !!text.trim())
      : !!text.trim()
  )

  const setProgress = useCallback((value: ExternalImportProgress) => {
    const stageText = t(PROGRESS_STAGE_KEYS[value.stage])
    setIsError(false)
    setStatusText(value.total
      ? `${stageText} ${value.current}/${value.total}`
      : stageText)
  }, [t])

  const handleSourceChange = (value: ExternalImportSource) => {
    if (value == source || isLoading) return
    setSource(value)
    setText('')
    setListName('')
    setSpotifySavedTracks(false)
    setStatusText('')
    setIsError(false)
  }

  const handleCancel = () => {
    if (isLoading) {
      cancelRequestedRef.current = true
      setIsError(false)
      setStatusText(t('playlist_import_modal__cancelling'))
      return
    }
    dialogRef.current?.setVisible(false)
  }

  const getErrorMessage = (error: unknown) => {
    if (error instanceof ExternalImportError) {
      const key = ERROR_MESSAGE_KEYS[error.code]
      if (key) return t(key)
    }
    return error instanceof Error ? error.message : String(error)
  }

  const handleSubmit = async() => {
    if (!canSubmit) return
    setIsLoading(true)
    setIsError(false)
    cancelRequestedRef.current = false
    setProgress({ stage: 'fetch', current: 0, total: 0 })

    try {
      const result = await importExternalPlaylist({
        source,
        text: text.trim(),
        listName: listName.trim(),
        target,
        currentListId,
        neteaseToken,
        spotifyAccessToken,
        spotifySavedTracks,
      }, setProgress, () => cancelRequestedRef.current)

      let message = t('playlist_import_modal__success', {
        total: result.total,
        imported: result.imported,
        unmatched: result.unmatched,
      })
      if (result.sourceTotal > result.total) {
        message += ` ${t('playlist_import_modal__success_partial', {
          sourceTotal: result.sourceTotal,
          total: result.total,
        })}`
      }
      toast(message)
      dialogRef.current?.setVisible(false)
    } catch (error) {
      if (error instanceof ExternalImportError && error.code == 'cancelled') {
        dialogRef.current?.setVisible(false)
      } else {
        setIsError(true)
        setStatusText(t('playlist_import_modal__failed', { message: getErrorMessage(error) }))
      }
    } finally {
      setIsLoading(false)
      cancelRequestedRef.current = false
    }
  }

  const fieldBorderColor = theme.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.78)'

  return (
    <Dialog
      ref={dialogRef}
      title={t('playlist_import_modal__title')}
      height="78%"
      closeBtn={false}
      bgHide={false}
      keyHide={false}
      onHide={reset}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.label} size={12} color={theme['q-text-secondary']}>
          {t('playlist_import_modal__source')}
        </Text>
        <View style={styles.sourceRow}>
          {SOURCE_OPTIONS.map(item => {
            const active = source == item.id
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.7}
                disabled={isLoading}
                onPress={() => { handleSourceChange(item.id) }}
                style={[
                  styles.sourceButton,
                  {
                    backgroundColor: active ? theme['q-surface-tint'] : theme['q-surface-base'],
                    borderColor: active ? theme['c-primary-alpha-700'] : theme['q-outline'],
                  },
                ]}
              >
                <SourceLogo source={item.id} size={25} />
                <Text
                  size={12}
                  color={active ? theme['q-accent-text'] : theme['q-text-secondary']}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <Text style={styles.fieldLabel} size={12} color={theme['q-text-secondary']}>
          {isSpotify && spotifySavedTracks
            ? t('playlist_import_modal__spotify_liked')
            : t('playlist_import_modal__link')}
        </Text>
        <Input
          value={text}
          editable={!isLoading && !(isSpotify && spotifySavedTracks)}
          clearBtn
          onChangeText={setText}
          placeholder={isSpotify
            ? t('playlist_import_modal__spotify_link_placeholder')
            : t('playlist_import_modal__link_placeholder')}
        />

        {source == 'wy'
          ? <>
              <Text style={styles.fieldLabel} size={12} color={theme['q-text-secondary']}>
                {t('playlist_import_modal__netease_token')}
              </Text>
              <Input
                value={neteaseToken}
                editable={!isLoading}
                secureTextEntry
                clearBtn
                onChangeText={setNeteaseToken}
                placeholder={t('playlist_import_modal__netease_token_placeholder')}
              />
            </>
          : null}

        {isSpotify
          ? <>
              <Text style={styles.fieldLabel} size={12} color={theme['q-text-secondary']}>
                {t('playlist_import_modal__spotify_token')}
              </Text>
              <Input
                value={spotifyAccessToken}
                editable={!isLoading}
                secureTextEntry
                clearBtn
                onChangeText={setSpotifyAccessToken}
                placeholder={t('playlist_import_modal__spotify_token_placeholder')}
              />
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={isLoading}
                onPress={() => { setSpotifySavedTracks(value => !value); setText('') }}
                style={[
                  styles.optionRow,
                  {
                    backgroundColor: spotifySavedTracks ? theme['q-surface-tint'] : theme['q-surface-base'],
                    borderColor: spotifySavedTracks ? theme['c-primary-alpha-700'] : fieldBorderColor,
                  },
                ]}
              >
                <View
                  style={[
                    styles.selectionMark,
                    {
                      borderColor: spotifySavedTracks ? theme['q-accent'] : theme['q-text-secondary'],
                      backgroundColor: spotifySavedTracks ? theme['q-accent'] : 'transparent',
                    },
                  ]}
                >
                  {spotifySavedTracks
                    ? <Text size={11} color={theme['q-surface-raised']}>✓</Text>
                    : null}
                </View>
                <Text size={13} color={theme['q-text-primary']}>
                  {t('playlist_import_modal__spotify_liked')}
                </Text>
              </TouchableOpacity>
            </>
          : null}

        <Text style={styles.fieldLabel} size={12} color={theme['q-text-secondary']}>
          {t('playlist_import_modal__target')}
        </Text>
        <View style={styles.targetList}>
          {targetOptions.map(item => {
            const active = target == item.id
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.7}
                disabled={isLoading}
                onPress={() => { setTarget(item.id) }}
                style={[
                  styles.optionRow,
                  {
                    backgroundColor: active ? theme['q-surface-tint'] : theme['q-surface-base'],
                    borderColor: active ? theme['c-primary-alpha-700'] : fieldBorderColor,
                  },
                ]}
              >
                <View
                  style={[
                    styles.radioOuter,
                    { borderColor: active ? theme['q-accent'] : theme['q-text-secondary'] },
                  ]}
                >
                  {active
                    ? <View style={{ ...styles.radioInner, backgroundColor: theme['q-accent'] }} />
                    : null}
                </View>
                <Text size={13} color={theme['q-text-primary']} numberOfLines={1}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {target == 'new'
          ? <>
              <Text style={styles.fieldLabel} size={12} color={theme['q-text-secondary']}>
                {t('playlist_import_modal__list_name')}
              </Text>
              <Input
                value={listName}
                editable={!isLoading}
                clearBtn
                onChangeText={setListName}
                placeholder={defaultListName}
              />
            </>
          : null}

        {statusText
          ? <Text
              style={styles.status}
              size={12}
              color={isError ? '#c65b5b' : theme['q-text-secondary']}
            >
              {statusText}
            </Text>
          : null}
      </ScrollView>

      <View
        style={{
          ...styles.footer,
          borderTopColor: theme['q-outline'],
          backgroundColor: theme['q-surface-raised'],
        }}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleCancel}
          style={[
            styles.footerButton,
            {
              backgroundColor: theme['q-surface-base'],
              borderColor: theme['q-outline'],
            },
          ]}
        >
          <Text size={13} color={theme['q-text-secondary']}>
            {t('cancel')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.72}
          disabled={!canSubmit}
          onPress={() => { void handleSubmit() }}
          style={[
            styles.footerButton,
            styles.submitButton,
            {
              opacity: canSubmit ? 1 : 0.42,
              backgroundColor: theme['c-primary-alpha-700'],
              borderColor: theme['c-primary-alpha-700'],
            },
          ]}
        >
          <Text size={13} color={theme['q-accent-text']}>
            {isLoading
              ? t('playlist_import_modal__importing')
              : t('playlist_import_modal__submit')}
          </Text>
        </TouchableOpacity>
      </View>
    </Dialog>
  )
})

const styles = createStyle({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
  },
  label: {
    marginBottom: 8,
    fontWeight: '600',
  },
  fieldLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  sourceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  sourceButton: {
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48%',
    flexGrow: 1,
    height: 46,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
  },
  targetList: {
    gap: 8,
  },
  optionRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  selectionMark: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  status: {
    marginTop: 14,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerButton: {
    minWidth: 84,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButton: {
    minWidth: 112,
  },
})
