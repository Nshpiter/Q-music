/** 在线导入与更新仅接受有效 HTTP(S) 链接与成功响应的脚本文本。 */
export interface ImportResponse { statusCode: number, body: unknown }
export interface ImportRequest { promise: Promise<ImportResponse>, cancelHttp?: (() => void) | null }
interface ImportOperation { cancel?: (() => void) | null }
export type FetchUserApiScript = (url: string) => ImportRequest

export interface UserApiUpdateTarget {
  id: string
  name: string
  sourceUrl?: string
  autoUpdate?: boolean
}

export interface UserApiUpdateItemResult<TInfo = unknown> {
  id: string
  name: string
  status: 'updated' | 'unchanged' | 'failed' | 'skipped'
  apiInfo?: TInfo
  message?: string
}

export interface UserApiBatchUpdateResult<TInfo = unknown> {
  results: Array<UserApiUpdateItemResult<TInfo>>
  summary: {
    updated: number
    unchanged: number
    failed: number
    skipped: number
  }
}

export const normalizeUserApiUrl = (input: string): string => {
  const url = input.trim()
  if (!/^https?:\/\/[^\s/]+(?:[/?#]|$)/i.test(url)) throw new Error('Invalid HTTP(S) URL')
  return url
}

export const validateUserApiScriptResponse = (response: ImportResponse): string => {
  if (response.statusCode < 200 || response.statusCode >= 300) throw new Error(`HTTP ${response.statusCode}`)
  if (typeof response.body !== 'string' || !response.body.trim()) throw new Error('Invalid script response')
  if (response.body.length > 9_000_000) throw new Error('Too large script')
  return response.body
}

export const fetchUserApiScript = async(fetchScript: FetchUserApiScript, input: string): Promise<string> => {
  const url = normalizeUserApiUrl(input)
  const response = await fetchScript(url).promise
  return validateUserApiScriptResponse(response)
}

export const createUserApiImporter = (fetchScript: FetchUserApiScript) => {
  let active: ImportOperation | null = null
  return {
    cancel() {
      const previous = active
      active = null
      previous?.cancel?.()
    },
    async load(input: string): Promise<string | null> {
      if (active) return null
      const url = normalizeUserApiUrl(input)
      const operation: ImportOperation = {}
      active = operation
      try {
        const request = fetchScript(url)
        operation.cancel = () => { request.cancelHttp?.() }
        const response = await request.promise
        if (active !== operation) return null
        return validateUserApiScriptResponse(response)
      } catch (error) {
        // 网络层取消不一定及时生效；过期请求也不能提示失败或关闭新窗口。
        if (active !== operation) return null
        throw error
      } finally {
        if (active === operation) active = null
      }
    },
  }
}

export const runUserApiUpdates = async<TInfo>({
  apis,
  fetchScript,
  replaceScript,
}: {
  apis: readonly UserApiUpdateTarget[]
  fetchScript: FetchUserApiScript
  replaceScript: (id: string, script: string) => Promise<{ changed: boolean, apiInfo: TInfo }>
}): Promise<UserApiBatchUpdateResult<TInfo>> => {
  const summary = { updated: 0, unchanged: 0, failed: 0, skipped: 0 }
  const results = await Promise.all(apis.map(async(api): Promise<UserApiUpdateItemResult<TInfo>> => {
    const rawUrl = api.sourceUrl?.trim()
    if (!rawUrl) {
      summary.skipped++
      return { id: api.id, name: api.name, status: 'skipped' }
    }
    try {
      const script = await fetchUserApiScript(fetchScript, rawUrl)
      const { changed, apiInfo } = await replaceScript(api.id, script)
      if (changed) {
        summary.updated++
        return { id: api.id, name: (apiInfo as { name?: string })?.name ?? api.name, status: 'updated', apiInfo }
      }
      summary.unchanged++
      return { id: api.id, name: (apiInfo as { name?: string })?.name ?? api.name, status: 'unchanged', apiInfo }
    } catch (error) {
      summary.failed++
      return {
        id: api.id,
        name: api.name,
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
      }
    }
  }))
  return { results, summary }
}
