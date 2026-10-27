// 使用已经解析好的显示行，保留当前开启的译文/音译，不复制时间戳和逐字标签。
export const lyricCopyText = (lines: ReadonlyArray<{ text: string, extendedLyrics: readonly string[] }>) => lines
  .map(line => [line.text, ...line.extendedLyrics].map(text => text.trim()).filter(Boolean).join('\n'))
  .filter(Boolean)
  .join('\n\n')
