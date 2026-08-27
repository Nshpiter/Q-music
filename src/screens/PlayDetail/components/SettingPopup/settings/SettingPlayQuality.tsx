import { memo, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import CheckBox from '@/components/common/CheckBox'
import { updateSetting } from '@/core/common'
import { TRY_QUALITYS_LIST } from '@/core/music/utils'
import { useSettingValue } from '@/store/setting/hook'

const QUALITY_NAMES: Partial<Record<LX.Quality, string>> = {
  '128k': '标准',
  '320k': 'HQ',
  flac: '无损',
  flac24bit: 'Hi-Res',
}

export default memo(() => {
  const quality = useSettingValue('player.playQuality')
  const qualitys = useMemo(() => [...TRY_QUALITYS_LIST, '128k'].reverse() as LX.Quality[], [])

  return (
    <View style={styles.container}>
      {qualitys.map(id => (
        <CheckBox
          key={id}
          marginRight={8}
          check={quality == id}
          label={QUALITY_NAMES[id] ?? id}
          onChange={() => { updateSetting({ 'player.playQuality': id }) }}
          need
        />
      ))}
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
})
