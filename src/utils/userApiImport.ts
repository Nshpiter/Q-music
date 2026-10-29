/** 在线导入只接受成功响应的脚本文本，关闭窗口后丢弃旧请求结果。 */
interface ImportResponse { statusCode: number, body: unknown }
interface ImportRequest { promise: Promise<ImportResponse>, cancelHttp?: (() => void) | null }
interface ImportOperation { cancel?: (() => void) | null }

export const createUserApiImporter = (fetchScript: (url: string) => ImportRequest) => {
  let active: ImportOperation | null = null
  return {
    cancel() {
      const previous = active
      active = null
      previous?.cancel?.()
    },
    async load(input: string): Promise<string | null> {
      if (active) return null
      const url = input.trim()
      if (!/^https?:\/\/[^\s/]+(?:[/?#]|$)/i.test(url)) throw new Error('Invalid HTTP(S) URL')
      const operation: ImportOperation = {}
      active = operation
      try {
        const request = fetchScript(url)
        operation.cancel = () => { request.cancelHttp?.() }
        const response = await request.promise
        if (active !== operation) return null
        if (response.statusCode < 200 || response.statusCode >= 300) throw new Error(`HTTP ${response.statusCode}`)
        if (typeof response.body !== 'string' || !response.body.trim()) throw new Error('Invalid script response')
        if (response.body.length > 9_000_000) throw new Error('Too large script')
        return response.body
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
