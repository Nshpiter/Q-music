export interface ProxyInfo {
  host: string
  port: number
}

const proxyProtocolRxp = /^https?:$/
const getFirstValue = (...values: Array<string | undefined>) => values.find(value => value?.trim())

export const parseProxy = (value?: string | null): ProxyInfo | null => {
  if (!value?.trim()) return null

  try {
    const url = new URL(/^\w+:\/\//.test(value) ? value : `http://${value}`)
    if (!proxyProtocolRxp.test(url.protocol) || !url.hostname || url.username || url.password) return null

    return {
      host: url.hostname,
      port: Number(url.port || (url.protocol == 'https:' ? 443 : 80)),
    }
  } catch {
    return null
  }
}

const isBypassed = (targetUrl: string, noProxy: string) => {
  let target: URL
  try {
    target = new URL(targetUrl)
  } catch {
    return false
  }

  const hostname = target.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  const port = target.port || (target.protocol == 'https:' ? '443' : '80')
  return noProxy.split(',').some(rule => {
    rule = rule.trim().toLowerCase()
    if (!rule) return false
    if (rule == '*') return true

    let ruleHost = rule
    let rulePort = ''
    if (rule.startsWith('[')) {
      const bracketIndex = rule.indexOf(']')
      if (bracketIndex < 0) return false
      ruleHost = rule.slice(1, bracketIndex)
      if (rule[bracketIndex + 1] == ':') rulePort = rule.slice(bracketIndex + 2)
    } else {
      const firstColonIndex = rule.indexOf(':')
      const lastColonIndex = rule.lastIndexOf(':')
      if (firstColonIndex > 0 && firstColonIndex == lastColonIndex) {
        ruleHost = rule.slice(0, firstColonIndex)
        rulePort = rule.slice(firstColonIndex + 1)
      }
    }
    ruleHost = ruleHost.replace(/^\*?\./, '')
    if (!ruleHost) return false
    if (rulePort && rulePort != port) return false
    return hostname == ruleHost || hostname.endsWith(`.${ruleHost}`)
  })
}

export const getEnvProxy = (targetUrl?: string, env: NodeJS.ProcessEnv = globalThis.process.env): ProxyInfo | null => {
  const noProxy = getFirstValue(env.NO_PROXY, env.no_proxy)
  if (targetUrl && noProxy && isBypassed(targetUrl, noProxy)) return null

  const isHttps = targetUrl?.startsWith('https:') ?? true
  const candidates = isHttps
    ? [env.HTTPS_PROXY, env.https_proxy, env.HTTP_PROXY, env.http_proxy, env.ALL_PROXY, env.all_proxy]
    : [env.HTTP_PROXY, env.http_proxy, env.ALL_PROXY, env.all_proxy]

  for (const candidate of candidates) {
    const proxy = parseProxy(candidate)
    if (proxy) return proxy
  }
  return null
}
