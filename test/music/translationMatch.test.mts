import assert from 'node:assert/strict'
import test from 'node:test'
import { closeDuration, matchTranslation, sameTitle } from '../../src/renderer/core/music/translationMatch.ts'

const lines = (text: string, shift = 0) => Array.from({ length: 5 }, (_, index) =>
  `[00:${String(index * 5 + shift).padStart(2, '0')}.00]${text}`,
).join('\n')

test('跨平台译文只接受标题、时长和原文吻合的同一首歌', () => {
  assert.equal(sameTitle('SAKURA (樱花)', 'SAKURA'), true)
  assert.equal(sameTitle('SAKURA', 'Different Song'), false)
  assert.equal(closeDuration('5:54', '5:56'), true)
  assert.equal(closeDuration('5:54', '6:20'), false)
  assert.equal(matchTranslation(lines('さくらひらひら'), lines('さくらひらひら', 3), lines('中文译文', 3)), lines('中文译文'))
  assert.equal(matchTranslation(lines('さくらひらひら'), lines('另一首歌', 3), lines('错误译文', 3)), '')
  assert.equal(matchTranslation(lines('さくらひらひら'), lines('さくらひらひらと全く別の長い歌詞', 3), lines('错误译文', 3)), '')
})

test('合并歌词行时不会重复展示同一条译文', () => {
  const original = '[00:01.70]さくら ひらひら\n[00:05.00]舞い降りて落ちて\n[00:08.12]揺れる 想いのたけを 抱きしめた\n[00:14.42]君と 春に 願いし あの夢は\n[00:21.15]今も見えているよ'
  const other = '[00:01.70]さくら ひらひら 舞い降りて落ちて\n[00:08.12]揺れる 想いのたけを 抱きしめた\n[00:14.42]君と 春に 願いし あの夢は\n[00:21.15]今も見えているよ'
  const translated = '[00:01.70]樱花，一片一片飞舞落下\n[00:08.12]摇动拥抱我的思绪\n[00:14.42]和你在春天相遇的那个梦\n[00:21.15]现在仍清晰可见'
  const result = matchTranslation(original, other, translated)
  assert.equal(result.split('\n').length, 4)
  assert.doesNotMatch(result, /\[00:05\.00\]/)
})
