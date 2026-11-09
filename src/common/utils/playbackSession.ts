// 播放会话独立于持久化歌单；历史用于回听插播曲目，排序仅改变当前队列。
export class PlaybackSession<T> {
  history: T[] = []
  cursor = -1
  continuous = false
  private ordered: { id: string, items: unknown[] } | null = null
  private readonly listeners = new Set<() => void>()
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  changed() { for (const listener of this.listeners) listener() }
  reset() { this.continuous = false; this.history = []; this.cursor = -1; this.ordered = null; this.changed() }
  record(item: T) {
    this.history.splice(this.cursor + 1)
    this.history.push(item)
    if (this.history.length > 500) this.history.shift()
    this.cursor = this.history.length - 1
    this.changed()
  }

  select(index: number): T | null {
    if (!Number.isInteger(index) || index < 0 || index >= this.history.length) return null
    this.cursor = index
    this.changed()
    return this.history[index]
  }

  back() { return this.select(this.cursor - 1) }
  forward() { return this.select(this.cursor + 1) }
  list<M>(id: string | null, fallback: M[]): M[] { return this.ordered && this.ordered.id == id ? this.ordered.items as M[] : fallback }
  replace<M>(id: string, items: M[]) {
    this.ordered = { id, items: [...items] }
    this.changed()
  }

  forget(matches: (item: T) => boolean) {
    const previous = this.history.slice(0, this.cursor + 1).filter(item => !matches(item))
    this.history = [...previous, ...this.history.slice(this.cursor + 1).filter(item => !matches(item))]
    this.cursor = previous.length - 1
    this.changed()
  }

  remove<M>(id: string, list: M[], index: number) {
    if (!Number.isInteger(index) || index < 0 || index >= list.length) return false
    this.replace(id, list.filter((_, at) => at != index))
    return true
  }

  reorder<M>(id: string, list: M[], from: number, to: number) {
    if (![from, to].every(index => Number.isInteger(index) && index >= 0 && index < list.length) || from == to) return false
    const items = [...list]
    items.splice(to, 0, items.splice(from, 1)[0])
    this.ordered = { id, items }
    this.changed()
    return true
  }
}
