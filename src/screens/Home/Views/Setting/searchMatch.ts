import type { SettingScreenIds } from './Main'
import type messages from '@/lang/zh-cn.json'

export type SettingLabel = keyof typeof messages
export interface SearchableSetting {
  id: string
  title: SettingLabel
  section: SettingScreenIds
  keywords: string
}

const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().trim()

export const matchSettings = <T extends SearchableSetting>(query: string, items: readonly T[], translate: (key: SettingLabel) => string): T[] => {
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  if (!terms.length) return []
  return items.map(item => {
    const title = normalize(translate(item.title))
    const haystack = `${title} ${normalize(translate(`setting_${item.section}`))} ${normalize(item.keywords)}`
    const score = terms.every(term => haystack.includes(term)) ? terms.reduce((score, term) => score + (title.includes(term) ? 2 : 1), 0) : 0
    return { item, score }
  }).filter(result => result.score > 0).sort((a, b) => b.score - a.score).map(result => result.item)
}
