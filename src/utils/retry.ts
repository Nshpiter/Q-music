/**
 * 通用网络请求重试工具，移植自桌面端 store/leaderboard/action.ts 的 requestWithRetry 模式：
 * 响应结构校验 + 递增退避重试 + 在途请求去重
 */

export interface RetryOptions<T> {
  /** 请求工厂（每次重试重新调用） */
  factory: () => Promise<T>
  /** 响应结构校验，返回 false 时视为失败并重试 */
  validate: (result: T) => boolean
  /** 最大重试次数（不含首次请求） */
  retryCount?: number
  /** 基础退避时间（毫秒），实际等待 = base × (attempt + 1) */
  backoffBase?: number
}

// eslint-disable-next-line @typescript-eslint/promise-function-async
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export const requestWithRetry = async<T>({
  factory,
  validate,
  retryCount = 2,
  backoffBase = 250,
}: RetryOptions<T>): Promise<T> => {
  let lastError: unknown
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      const result = await factory()
      if (validate(result)) return result
      lastError = new Error('invalid response')
    } catch (err) {
      lastError = err
    }
    if (attempt < retryCount) await delay(backoffBase * (attempt + 1))
  }
  throw lastError
}

/**
 * 在途请求去重：相同 key 的并发调用共享同一个 Promise
 */
export class PendingRequestMap<T> {
  private readonly pending = new Map<string, Promise<T>>()

  async run(key: string, task: () => Promise<T>): Promise<T> {
    const prev = this.pending.get(key)
    if (prev) return prev

    const promise = task().finally(() => {
      this.pending.delete(key)
    })
    this.pending.set(key, promise)
    return promise
  }
}
