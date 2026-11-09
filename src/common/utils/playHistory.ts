export interface HistoryTrack { id: string, source: string, name: string, singer: string, meta: object }
export interface HistoryEntry<T> { track: T, playedAt: number }
export interface HistorySnapshot<T> { entries: Array<HistoryEntry<T>>, limit: number }

// 与用于“上一首”的会话栈分开存储；默认不自动删除，只有用户设置上限时裁剪。
export class PlayHistory<T extends HistoryTrack> {
  private state: HistorySnapshot<T> = { entries: [], limit: 0 }
  private ready?: Promise<void>
  private pending = Promise.resolve()
  private readonly listeners = new Set<() => void>()
  constructor(private readonly read: () => Promise<unknown>, private readonly write: (snapshot: HistorySnapshot<T>) => Promise<void>) {}
  snapshot() { return this.state }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private changed() { for (const listener of this.listeners) listener() }
  async load() {
    return this.ready ??= this.read().then(value => {
      const stored = value as Partial<HistorySnapshot<T>> | null
      const limit = Number.isSafeInteger(stored?.limit) && stored!.limit! >= 0 ? stored!.limit! : 0
      const seen = new Set<string>()
      const entries = (Array.isArray(stored?.entries) ? stored.entries : []).filter(entry => {
        const track = entry?.track
        if (!track || typeof track.id != 'string' || typeof track.source != 'string' || typeof track.name != 'string' || typeof track.singer != 'string' || !track.meta || typeof track.meta != 'object' || !Number.isFinite(entry.playedAt)) return false
        return true
      }).sort((a, b) => b.playedAt - a.playedAt).filter(entry => {
        const track = entry.track
        const key = `${track.source}:${track.id}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      this.state = { entries: limit ? entries.slice(0, limit) : entries, limit }
      this.changed()
    }).catch(error => { this.ready = undefined; throw error })
  }

  private async mutate(change: (state: HistorySnapshot<T>) => HistorySnapshot<T>) {
    const task = this.pending.catch(() => {}).then(async() => {
      await this.load()
      const state = change(this.state)
      await this.write(state)
      this.state = state
      this.changed()
    })
    this.pending = task
    return task
  }

  async record(track: T, playedAt = Date.now()) {
    // 拷贝元数据，避免后续封面/取址更新修改已经落盘的记录。
    const snapshot = JSON.parse(JSON.stringify(track)) as T
    return this.mutate(state => {
      const entries = [{ track: snapshot, playedAt }, ...state.entries.filter(item => item.track.source != track.source || item.track.id != track.id)]
      return { ...state, entries: state.limit ? entries.slice(0, state.limit) : entries }
    })
  }

  async remove(track: T) { return this.mutate(state => ({ ...state, entries: state.entries.filter(item => item.track.source != track.source || item.track.id != track.id) })) }
  async clear() { return this.mutate(state => ({ ...state, entries: [] })) }
  async setLimit(limit: number) {
    if (!Number.isSafeInteger(limit) || limit < 0 || limit > 100000) return Promise.reject(new Error('history_limit_invalid'))
    return this.mutate(state => ({ limit, entries: limit ? state.entries.slice(0, limit) : state.entries }))
  }
}
