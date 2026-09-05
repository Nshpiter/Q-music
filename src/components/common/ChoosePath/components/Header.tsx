import { memo, useCallback, useEffect, useRef } from 'react'
import { View } from 'react-native'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { getExternalStoragePaths, stat } from '@/utils/fs'
import { useTheme } from '@/store/theme/hook'
import { scaleSizeH } from '@/utils/pixelRatio'
import { useStatusbarHeight } from '@/store/common/hook'
import NewFolderModal, { type NewFolderType } from './NewFolderModal'
import OpenStorageModal, { type OpenDirModalType } from './OpenStorageModal'
import type { PathItem } from './ListItem'
import IconButton from '@/components/common/IconButton'


export default memo(({
  title,
  path,
  onRefreshDir,
  onOpenDir,
}: {
  title: string
  path: string
  onRefreshDir: (dir: string) => Promise<PathItem[]>
  onOpenDir: (dir: string) => Promise<PathItem[]>
}) => {
  const theme = useTheme()
  const newFolderTypeRef = useRef<NewFolderType>(null)
  const openDirModalTypeRef = useRef<OpenDirModalType>(null)
  const storagePathsRef = useRef<string[]>([])
  const statusBarHeight = useStatusbarHeight()

  const checkExternalStoragePath = useCallback(() => {
    storagePathsRef.current = []
    void getExternalStoragePaths().then(async(storagePaths) => {
      for (const path of storagePaths) {
        try {
          if (!(await stat(path)).canRead) continue
        } catch { continue }
        storagePathsRef.current.push(path)
      }
    })
  }, [])
  useEffect(() => {
    checkExternalStoragePath()
  }, [checkExternalStoragePath])

  const refresh = () => {
    void onRefreshDir(path)
    checkExternalStoragePath()
  }

  const openStorage = () => {
    openDirModalTypeRef.current?.show(storagePathsRef.current)
  }

  const handleShowNewFolderModal = () => {
    newFolderTypeRef.current?.show(path)
  }

  return (
    <>
      <View style={{
        ...styles.header,
        height: scaleSizeH(50) + statusBarHeight,
        paddingTop: statusBarHeight,
        backgroundColor: theme['c-content-background'],
      }}>
        <View style={styles.titleContent}>
          <Text color={theme['c-primary-font']} numberOfLines={1}>{title}</Text>
          <Text style={styles.subTitle} color={theme['c-primary-font']} size={13} numberOfLines={1}>{path}</Text>
        </View>
        <View style={styles.actions}>
          <IconButton
            name="sd-card"
            iconSize={22}
            iconColor={theme['c-primary-font']}
            accessibilityLabel={global.i18n.t('open_storage_select_path')}
            style={styles.actionBtn}
            onPress={openStorage}
          />
          <IconButton
            name="add_folder"
            iconSize={22}
            iconColor={theme['c-primary-font']}
            accessibilityLabel={global.i18n.t('create_new_folder')}
            style={styles.actionBtn}
            onPress={handleShowNewFolderModal}
          />
          <IconButton
            name="available_updates"
            iconSize={22}
            iconColor={theme['c-primary-font']}
            accessibilityLabel={global.i18n.t('search_hot_search_refresh')}
            style={styles.actionBtn}
            onPress={refresh}
          />
        </View>
      </View>
      <OpenStorageModal ref={openDirModalTypeRef} onOpenDir={onOpenDir} />
      <NewFolderModal ref={newFolderTypeRef} onRefreshDir={onRefreshDir} />
    </>
  )
})

const styles = createStyle({
  header: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    paddingLeft: 15,
    paddingRight: 15,
    alignItems: 'center',
    elevation: 2,
    zIndex: 2,
    // borderBottomWidth: BorderWidths.normal,
  },
  titleContent: {
    flexGrow: 1,
    flexShrink: 1,
    // height: 57,
    // paddingRight: 5,
    // paddingBottom: 10,
  },
  // title: {
  //   paddingTop: 10,
  // },
  subTitle: {
    paddingTop: 1,
  },
  actions: {
    flexDirection: 'row',
    // backgroundColor: 'rgba(0,0,0,0.2)',
  },
  actionBtn: {
    width: 48,
    minWidth: 48,
    height: 48,
    minHeight: 48,
    marginLeft: 4,
    borderRadius: 12,
  },
  newFolderContent: {
    flexShrink: 1,
    flexDirection: 'column',
  },
  newFolderTitle: {
    marginBottom: 5,
  },
  input: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 240,
    borderRadius: 4,
    paddingTop: 2,
    paddingBottom: 2,
  },
})

