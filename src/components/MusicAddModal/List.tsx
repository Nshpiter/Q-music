import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { ScrollView, View } from 'react-native'
import { useMyList } from '@/store/list/hook'
import ListItem from './ListItem'
import CreateUserList from './CreateUserList'
import { createStyle } from '@/utils/tools'

export const styles = createStyle({
  list: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
})

export default ({ musicInfo, onPress, disabled = false, onCreating, children, isMove = false }: {
  musicInfo: LX.Music.MusicInfo
  onPress: (listInfo: LX.List.MyListInfo) => void
  disabled?: boolean
  onCreating?: (busy: boolean) => void
  children?: React.ReactNode
  isMove?: boolean
}) => {
  const allList = useMyList()
  const theme = useTheme()
  const t = useI18n()
  return (
    <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
      {children}
      <View style={styles.list}>
        <View style={{ gap: 5, marginBottom: 2 }}>
          <Text size={11} color={theme['q-text-secondary']} style={{ fontWeight: '600' }}>{t('favorite_local_section')}</Text>
          <Text size={11} color={theme['q-text-secondary']} style={{ lineHeight: 17 }}>{t(isMove ? 'favorite_move_hint' : 'favorite_local_hint')}</Text>
        </View>
        {allList.map(info => <ListItem key={info.id} listInfo={info} musicInfo={musicInfo} onPress={onPress} disabled={disabled} />)}
        <CreateUserList disabled={disabled} onBusyChange={onCreating} />
      </View>
    </ScrollView>
  )
}
