import { memo, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import { Icon } from '@/components/common/Icon'
import SourceLogo from '@/components/SourceLogo'
import Text from '@/components/common/Text'
import { updateSetting } from '@/core/common'
import { setMusicUrl } from '@/core/player/player'
import { getPlayQualityCandidates, isCustomApiSource, TRY_QUALITYS_LIST } from '@/core/music/utils'
import { useI18n } from '@/lang'
import { usePlayMusicInfo } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import { useStatus, useUserApiList } from '@/store/userApi'
import Button from '@/components/common/Button'

const QUALITY_INFO: Partial<Record<LX.Quality, { name: 'standard' | 'high' | 'lossless' | 'hires', desc: string }>> = {
  '128k': { name: 'standard', desc: '128 kbps' },
  '320k': { name: 'high', desc: '320 kbps' },
  flac: { name: 'lossless', desc: 'FLAC' },
  flac24bit: { name: 'hires', desc: '24-bit' },
}

export default memo(() => {
  const quality = useSettingValue('player.playQuality')
  const apiSource = useSettingValue('common.apiSource')
  const qualitys = useMemo(() => [...TRY_QUALITYS_LIST, '128k'].reverse() as LX.Quality[], [])
  const playMusicInfo = usePlayMusicInfo()
  const userApiList = useUserApiList()
  const apiStatus = useStatus()
  const theme = useTheme()
  const t = useI18n()
  const currentMusic = playMusicInfo.musicInfo
  const onlineMusic = currentMusic && !('progress' in currentMusic) && currentMusic.source != 'local'
    ? currentMusic
    : null
  const customApi = isCustomApiSource(apiSource)
  const customApiName = customApi ? userApiList.find(item => item.id == apiSource)?.name : null
  const apiStatusLabel = apiStatus.status
    ? t('setting_basic_source_status_success')
    : apiStatus.message == 'initing'
      ? t('setting_basic_source_status_initing')
      : t('setting_basic_source_status_failed')

  const handleChange = (id: LX.Quality, available: boolean) => {
    if (!available || quality == id) return
    updateSetting({ 'player.playQuality': id })
    if (onlineMusic) requestAnimationFrame(() => { setMusicUrl(onlineMusic, true) })
  }

  return (
    <View style={styles.container}>
      <Text size={15} style={styles.sectionTitle} color={theme['q-text-primary']}>{t('play_detail_setting_quality')}</Text>
      <View style={{ ...styles.routeCard, backgroundColor: theme['q-surface-tint'], borderColor: theme['q-outline'] }}>
        {onlineMusic
          ? <SourceLogo source={onlineMusic.source} size={30} />
          : <Icon name="music_time" color={theme['q-accent-text']} rawSize={24} />}
        <View style={styles.routeCopy}>
          <Text size={13} style={styles.routeTitle} color={theme['q-text-primary']}>
            {customApi ? t('play_detail_quality_custom_first') : t('play_detail_quality_official_first')}
          </Text>
          <Text size={11} color={theme['q-text-secondary']} numberOfLines={2}>
            {customApi
              ? t('play_detail_quality_custom_desc', { name: customApiName ?? t('play_detail_quality_custom_source'), status: apiStatusLabel })
              : t('play_detail_quality_official_desc')}
          </Text>
        </View>
      </View>
      <View style={styles.qualityList}>
        {qualitys.map(id => {
          const info = QUALITY_INFO[id]!
          const active = quality == id
          const available = !onlineMusic || getPlayQualityCandidates(id, onlineMusic)[0] == id
          return (
            <Button
              key={id}
              accessibilityRole="radio"
              accessibilityLabel={`${t(`play_detail_quality_${info.name}`)} · ${info.desc}`}
              accessibilityState={{ checked: active, disabled: !available }}
              disabled={!available}
              style={[
                styles.qualityItem,
                {
                  backgroundColor: active ? theme['q-surface-tint'] : theme['q-surface-base'],
                  borderColor: active ? theme['q-accent'] : theme['q-outline'],
                },
              ]}
              onPress={() => { handleChange(id, available) }}
            >
              <View style={styles.qualityTop}>
                <Text size={14} style={styles.qualityName} color={active ? theme['q-accent-text'] : theme['q-text-primary']}>
                  {t(`play_detail_quality_${info.name}`)}
                </Text>
                {active ? <Icon accessible={false} name="checkbox-marked" color={theme['q-accent-text']} rawSize={17} /> : null}
              </View>
              <Text size={11} color={theme['q-text-secondary']}>{info.desc}</Text>
            </Button>
          )
        })}
      </View>
      <Text size={10} style={styles.tip} color={theme['q-text-secondary']}>{t('play_detail_quality_reload_tip')}</Text>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  sectionTitle: {
    marginBottom: 10,
    fontWeight: '700',
  },
  routeCard: {
    minHeight: 66,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeCopy: {
    flex: 1,
    marginLeft: 10,
  },
  routeTitle: {
    marginBottom: 3,
    fontWeight: '700',
  },
  qualityList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  qualityItem: {
    width: '47%',
    flexGrow: 1,
    minHeight: 62,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 14,
    justifyContent: 'center',
  },
  qualityTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  qualityName: {
    fontWeight: '700',
  },
  tip: {
    marginTop: 9,
    lineHeight: 15,
  },
})
