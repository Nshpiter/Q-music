import { userApis as defaultUserApis } from './config'
import { STORE_NAMES } from '@common/constants'
import { normalizeUserApiUrl } from '@common/utils/userApiImport'
import getStore from '@main/utils/store'
import zlib from 'node:zlib'

let userApis: LX.UserApi.UserApiInfo[] | null
let scripts = new Map<string, string>()

const saveData = () => {
  getStore(STORE_NAMES.USER_API).set('userApis', userApis!.map(api => {
    return {
      ...api,
      script: scripts.get(api.id),
    }
  }))
}

export const getUserApis = (): LX.UserApi.UserApiInfo[] => {
  if (userApis) return userApis

  const electronStore_userApi = getStore(STORE_NAMES.USER_API)
  let infoFull = electronStore_userApi.get('userApis') as LX.UserApi.UserApiInfoFull[]
  let requiredUpdate = false
  if (infoFull) {
    for (let i = 0; i < infoFull.length; i++) {
      const api = infoFull[i]
      if (api.version != null) continue
      requiredUpdate ||= true
      try {
        infoFull.splice(i, 1, {
          ...parseScriptInfo(api.script),
          ...api,
        })
      } catch (e) {
        infoFull.splice(i, 1)
        i--
      }
    }
  } else {
    infoFull = defaultUserApis
    electronStore_userApi.set('userApis', userApis)
  }
  userApis = infoFull.map(api => {
    if (api.allowShowUpdateAlert == null) api.allowShowUpdateAlert = false
    const { script, ...info } = api
    scripts.set(api.id, script)
    return info
  })
  if (requiredUpdate) saveData()
  return userApis
}

const INFO_NAMES = {
  name: 24,
  description: 36,
  author: 56,
  homepage: 1024,
  version: 36,
} as const
type INFO_NAMES_Type = typeof INFO_NAMES
const matchInfo = (scriptInfo: string) => {
  const infoArr = scriptInfo.split(/\r?\n/)
  const rxp = /^\s?\*\s?@(\w+)\s(.+)$/
  const infos: Partial<Record<keyof typeof INFO_NAMES, string>> = {}
  for (const info of infoArr) {
    const result = rxp.exec(info)
    if (!result) continue
    const key = result[1] as keyof typeof INFO_NAMES
    if (INFO_NAMES[key] == null) continue
    infos[key] = result[2].trim()
  }

  for (const [key, len] of Object.entries(INFO_NAMES) as Array<{ [K in keyof INFO_NAMES_Type]: [K, INFO_NAMES_Type[K]] }[keyof INFO_NAMES_Type]>) {
    infos[key] ||= ''
    if (infos[key] == null) infos[key] = ''
    else if (infos[key].length > len) infos[key] = infos[key].substring(0, len) + '...'
  }

  return infos as Record<keyof typeof INFO_NAMES, string>
}
const parseScriptInfo = (script: string) => {
  const result = /^\/\*[\S|\s]+?\*\//.exec(script)
  if (!result) throw new Error('无效的自定义源文件')

  let scriptInfo = matchInfo(result[0])

  scriptInfo.name ||= `user_api_${new Date().toLocaleString()}`
  return scriptInfo
}
const deflateScript = async(script: string) => new Promise<string>((resolve, reject) => {
  zlib.deflate(Buffer.from(script, 'utf8'), (err, buf) => {
    if (err) {
      reject(err)
      return
    }
    resolve('gz_' + buf.toString('base64'))
  })
})
const inflateScript = async(script: string) => new Promise<string>((resolve, reject) => {
  if (script.startsWith('gz_')) {
    zlib.inflate(Buffer.from(script.substring(3), 'base64'), (err, buf) => {
      if (err) {
        reject(err)
        return
      }
      resolve(buf.toString('utf8'))
    })
  } else resolve(script)
})
export const importApi = async(scriptRaw: string, sourceUrl?: string): Promise<LX.UserApi.UserApiInfo> => {
  let scriptInfo = parseScriptInfo(scriptRaw)
  const script = await deflateScript(scriptRaw)
  userApis ??= []
  for (const api of userApis) {
    const existingScript = scripts.get(api.id)
    if (existingScript === script) {
      throw new Error(`导入失败，脚本内容与已有的源「${api.name}」相同`)
    }
  }
  const normalizedUrl = sourceUrl?.trim() ? normalizeUserApiUrl(sourceUrl) : undefined
  const apiInfo: LX.UserApi.UserApiInfo = {
    id: `user_api_${Math.random().toString().substring(2, 5)}_${Date.now()}`,
    ...scriptInfo,
    allowShowUpdateAlert: true,
    ...(normalizedUrl ? { sourceUrl: normalizedUrl } : {}),
  }
  userApis.push(apiInfo)
  scripts.set(apiInfo.id, script)
  saveData()
  return apiInfo
}

export const replaceApiScript = async(id: string, scriptRaw: string): Promise<{ changed: boolean, apiInfo: LX.UserApi.UserApiInfo, apiList: LX.UserApi.UserApiInfo[] }> => {
  userApis ??= getUserApis()
  const targetApi = userApis.find(api => api.id == id)
  if (!targetApi) throw new Error('API not found')
  const scriptInfo = parseScriptInfo(scriptRaw)
  const script = await deflateScript(scriptRaw)
  if (scripts.get(id) === script) {
    return {
      changed: false,
      apiInfo: targetApi,
      apiList: [...userApis],
    }
  }
  for (const api of userApis) {
    if (api.id === id) continue
    if (scripts.get(api.id) === script) {
      throw new Error(`更新失败，脚本内容与已有的源「${api.name}」相同`)
    }
  }
  Object.assign(targetApi, {
    ...scriptInfo,
    name: scriptInfo.name || targetApi.name,
  })
  scripts.set(id, script)
  saveData()
  return {
    changed: true,
    apiInfo: targetApi,
    apiList: [...userApis],
  }
}

export const setSourceUrl = (id: string, sourceUrl: string): LX.UserApi.UserApiInfo[] => {
  userApis ??= getUserApis()
  const targetApi = userApis.find(api => api.id == id)
  if (!targetApi) return [...userApis]
  const trimmed = sourceUrl.trim()
  if (!trimmed) delete targetApi.sourceUrl
  else targetApi.sourceUrl = normalizeUserApiUrl(trimmed)
  saveData()
  return [...userApis]
}

export const setAutoUpdate = (id: string, enable: boolean): LX.UserApi.UserApiInfo[] => {
  userApis ??= getUserApis()
  const targetApi = userApis.find(api => api.id == id)
  if (!targetApi) return [...userApis]
  targetApi.autoUpdate = enable
  saveData()
  return [...userApis]
}

export const removeApi = (ids: string[]) => {
  if (!userApis) return
  for (let index = userApis.length - 1; index > -1; index--) {
    if (ids.includes(userApis[index].id)) {
      scripts.delete(userApis[index].id)
      userApis.splice(index, 1)
      ids.splice(index, 1)
    }
  }
  saveData()
}

export const setAllowShowUpdateAlert = (id: string, enable: boolean) => {
  const targetApi = userApis?.find(api => api.id == id)
  if (!targetApi) return
  targetApi.allowShowUpdateAlert = enable
  saveData()
}

export const getScript = async(id: string) => {
  return inflateScript(scripts.get(id) ?? '')
}
