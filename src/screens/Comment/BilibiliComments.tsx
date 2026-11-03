import { useEffect, useState } from 'react'
import { Linking, ScrollView, StyleSheet, View } from 'react-native'
import { bilibiliClient } from '@/utils/musicSdk/bi'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import ContentState from '@/components/common/ContentState'
import { toast } from '@/utils/tools'
import CommentFloor from './components/CommentFloor'
import type { Comment } from './utils'

export default ({ musicInfo }: { musicInfo: LX.Music.MusicInfoOnline }) => {
  const t = useI18n()
  const theme = useTheme()
  const [state, setState] = useState<'loading' | 'error' | 'done'>('loading')
  const [comments, setComments] = useState<Comment[]>([])
  const [retry, setRetry] = useState(0)
  const id = String(musicInfo.meta.songId)
  useEffect(() => {
    const request = new AbortController()
    setState('loading'); setComments([])
    void bilibiliClient.comments(id, request.signal).then(result => {
      if (request.signal.aborted) return
      setComments(result.comments); setState('done')
    }).catch(() => { if (!request.signal.aborted) setState('error') })
    return () => { request.abort() }
  }, [id, retry])
  return <ScrollView contentContainerStyle={styles.content}>
    <View style={[styles.notice, { backgroundColor: theme['q-surface-tint'] }]}>
      <Text size={16} style={styles.title}>{t('bili_comments_title')}</Text>
      <Text size={12} color={theme['q-text-secondary']} style={styles.hint}>{t('bili_comments_preview')}</Text>
      <Button style={styles.link} onPress={() => {
        const bvid = id.split(':')[0]
        if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) return
        void Linking.openURL(`https://www.bilibili.com/video/${bvid}/#reply`).catch(() => { toast(t('load_failed')) })
      }}><Text color={theme['q-accent-text']}>{t('bili_comments_open')}</Text></Button>
    </View>
    {state != 'done' ? <ContentState status={state} onRetry={() => { setRetry(value => value + 1) }} /> : comments.length
      ? <View style={styles.comments}>{comments.map((comment, index) => <View key={comment.id}><CommentFloor comment={comment} isLast={index == comments.length - 1} /></View>)}</View>
      : <Text style={styles.empty} color={theme['q-text-secondary']}>{t('bili_comments_empty')}</Text>}
  </ScrollView>
}

const styles = StyleSheet.create({
  content: { paddingVertical: 16, flexGrow: 1 },
  comments: { paddingHorizontal: 16 },
  notice: { marginHorizontal: 16, marginBottom: 16, borderRadius: 20, padding: 16 },
  title: { fontWeight: '600' },
  hint: { marginTop: 8, lineHeight: 20 },
  link: { marginTop: 8, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  empty: { textAlign: 'center', padding: 24, lineHeight: 22 },
})
