import { View } from 'react-native'

import Button from '@/components/common/Button'
import { type TagInfoItem } from '@/store/songlist/state'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { Q_UI } from '@/theme/ui'

export interface TagGroupProps {
  name: string
  list: TagInfoItem[]
  onTagChange: (name: string, id: string) => void
  activeId: string
}

export default ({ name, list, onTagChange, activeId }: TagGroupProps) => {
  const theme = useTheme()
  return (
    <View>
      {
        name
          ? <Text style={styles.tagTypeTitle} color={theme['c-font-label']}>{name}</Text>
          : null
      }
      <View style={styles.tagTypeList}>
        {list.map(item => {
          const active = activeId == item.id
          return (
            <Button
              accessibilityRole="tab"
              accessibilityLabel={item.name}
              accessibilityState={{ selected: active }}
              style={{
                ...styles.tagButton,
                backgroundColor: active ? theme['c-button-background-selected'] : theme['c-button-background'],
                borderColor: active ? theme['c-primary-alpha-700'] : theme['c-border-background'],
              }}
              key={item.id}
              onPress={() => { if (!active) onTagChange(item.name, item.id) }}
            >
              <Text style={styles.tagButtonText} color={active ? theme['c-primary-font-active'] : theme['c-font']} >{item.name}</Text>
            </Button>
          )
        })}
      </View>
    </View>
  )
}

const styles = createStyle({
  tagTypeTitle: {
    marginTop: 15,
    marginBottom: 10,
  },
  tagTypeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagButton: {
    minHeight: Q_UI.touchSize,
    borderWidth: 1,
    borderRadius: 12,
    marginRight: 10,
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagButtonText: {
    fontSize: 13,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 9,
    paddingBottom: 9,
  },
})
