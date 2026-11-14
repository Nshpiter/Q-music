export type AccountFailureKind = 'network' | 'restricted'

// 网易云风控/频率限制：-460 异常访问、-462 需要验证、405 操作频繁、-447 服务繁忙。
export const neteaseRestrictedCodes = new Set([-460, -462, 405, -447])

const networkPattern = /net::ERR_(?:INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|NAME_RESOLUTION_FAILED|CONNECTION_\w+|TIMED_OUT|NETWORK_\w+|PROXY_\w+|ADDRESS_UNREACHABLE|TUNNEL_CONNECTION_FAILED)|ECONNRESET|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|socket hang up|fetch failed|Failed to fetch/i

// 区分连接失败与平台限制，其余错误交给调用方按「暂不可用」处理。
export const accountFailureKind = (error: unknown): AccountFailureKind | null => {
  if (!(error instanceof Error)) return null
  if (error.message == 'network' || error.message == 'restricted') return error.message
  if (error.name == 'TimeoutError' || error.name == 'AbortError') return 'network'
  const cause = (error as { cause?: unknown }).cause
  if (networkPattern.test(error.message) || (cause instanceof Error && networkPattern.test(`${cause.message} ${(cause as { code?: string }).code ?? ''}`))) return 'network'
  return null
}
