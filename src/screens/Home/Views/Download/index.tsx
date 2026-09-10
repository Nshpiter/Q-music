import { useEffect, useMemo, useState } from 'react'
import { FlatList, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import SourceLogo from '@/components/SourceLogo'
import { Icon } from '@/components/common/Icon'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { subscribeDownloadTasks } from '@/core/download/store'
import { deleteDownloadTask, retryDownload } from '@/core/download/worker'
import type { DownloadTaskInfo } from '@/core/download/types'
import { QUALITY_BADGE } from '@/config/constant'
import { Q_UI } from '@/theme/ui'

const TaskItem = ({ task, onDelete, onRetry }: {
  task: DownloadTaskInfo
  onDelete: (id: string) => void
  onRetry: (id: string) => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  const statusText = useMemo(() => {
    switch (task.status) {
      case 'waiting':
        return t('download_status_waiting')
      case 'run':
        return task.speed ? `${task.progress}% · ${task.speed}` : `${task.progress}%`
      case 'error':
        return task.statusText || t('download_status_error')
      case 'completed':
        return t('download_status_completed')
      default:
        return ''
    }
  }, [task.status, task.progress, task.speed, task.statusText, t])

  return (
    <View style={{ ...styles.item, backgroundColor: theme['q-surface-raised'], borderRadius: Q_UI.radius.control }}>
      <View style={styles.itemIcon}>
        <SourceLogo source={task.musicInfo.source} size={18} />
      </View>
      <View style={styles.itemInfo}>
        <Text numberOfLines={1} size={14} color={theme['c-font']}>{task.musicInfo.name}</Text>
        <View style={styles.itemSub}>
          <Text numberOfLines={1} size={11} color={theme['q-text-secondary']}>{task.musicInfo.singer}</Text>
          <Text size={10} color={theme['q-text-secondary']} style={styles.qualityTag}>{QUALITY_BADGE[task.quality]}</Text>
        </View>
        {
          task.status == 'run' || task.status == 'error' || task.status == 'completed'
            ? (
              <View style={{ ...styles.progressTrack, backgroundColor: theme['q-outline'] }}>
                <View style={{ ...styles.progressFill, width: `${task.progress}%`, backgroundColor: theme['q-accent'] }} />
              </View>
              )
            : null
        }
        <Text size={11} color={theme['q-text-secondary']}>{statusText}</Text>
      </View>
      <View style={styles.itemActions}>
        {
          task.status == 'error'
            ? (
              <TouchableOpacity style={styles.actionBtn} activeOpacity={0.6} onPress={() => { onRetry(task.id) }}>
                <Icon name="available_updates" size={18} color={theme['q-text-secondary']} />
              </TouchableOpacity>
              )
            : null
        }
        {
          task.status != 'run'
            ? (
              <TouchableOpacity style={styles.actionBtn} activeOpacity={0.6} onPress={() => { onDelete(task.id) }}>
                <Icon name="close" size={18} color={theme['q-text-secondary']} />
              </TouchableOpacity>
              )
            : null
        }
      </View>
    </View>
  )
}

export default () => {
  const theme = useTheme()
  const t = useI18n()
  const [tasks, setTasks] = useState<DownloadTaskInfo[]>([])

  useEffect(() => {
    const unsubscribe = subscribeDownloadTasks(setTasks)
    return unsubscribe
  }, [])

  return (
    <View style={{ ...styles.container, backgroundColor: theme['c-main-background'] }}>
      {
        tasks.length
          ? (
            <FlatList
              style={styles.list}
              data={tasks}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TaskItem task={item} onDelete={id => { void deleteDownloadTask(id) }} onRetry={retryDownload} />
              )}
            />
            )
          : (
            <View style={styles.empty}>
              <Icon name="download-2" size={40} color={theme['q-outline']} />
              <Text size={13} color={theme['q-text-secondary']} style={styles.emptyText}>{t('no_item')}</Text>
            </View>
            )
      }
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  itemIcon: {
    width: 26,
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    flexShrink: 1,
    paddingHorizontal: 8,
  },
  itemSub: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  qualityTag: {
    marginLeft: 6,
    fontWeight: '600',
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    marginTop: 6,
    marginBottom: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 10,
  },
})
