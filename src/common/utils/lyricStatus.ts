// 空歌词不等于纯音乐；只接受明确的歌词标记或版本标签。
export const isInstrumental = ({ title = '', lyric = '' }: { title?: string | null, lyric?: string | null }) => {
  const lines = (lyric ?? '').split(/\r?\n/).map(line => line.replace(/\[[^\]]*\]/g, '').replace(/<\d+,\d+>/g, '').trim()).filter(Boolean)
  const marker = /^(?:(?:(?:此|本)(?:歌曲?|曲|音乐|音樂)(?:为|為|是))?(?:(?:没有填词的|沒有填詞的|无歌词的|無歌詞的))?(?:纯音乐|純音樂)(?:[，,、\s]*(?:请|請)(?:您)?(?:欣赏|欣賞))?|(?:纯音乐|純音樂)[，,\s]*(?:敬请欣赏|敬請欣賞)|instrumental(?:\s+music)?)[。.!！~～\s]*$/i
  const credits = /^(?:作词|作詞|作曲|编曲|編曲|制作人|製作人|词曲|詞曲|词|詞|曲|歌手|歌曲|歌名|专辑|專輯|演唱|演奏|混音|录音|錄音|监制|監製|出品|发行|發行|策划|策劃|Lyrics?\s+by|Composed?\s+by|Arranged?\s+by|Written\s+by|Artist|Title|Album)\s*[:：]/i
  const content = lines.filter(line => !credits.test(line))
  if (content.some(line => marker.test(line))) return content.every(line => marker.test(line))
  const unavailable = /^(?:暂无歌词|暫無歌詞|没有歌词|沒有歌詞|无歌词|無歌詞|歌词暂无|歌詞暫無|no lyrics(?: available)?)[。.!！\s]*$/i
  if (content.some(line => !unavailable.test(line))) return false
  return /(?:^|[（(【[】｜|]|\s[-–—]\s)\s*(?:纯音乐|純音樂|instrumental)(?:版|\s+version)?\s*(?:$|[）)】\]｜|])/i.test(title ?? '')
}
