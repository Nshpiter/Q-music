import { NativeModules } from 'react-native'
import { toMD5 } from '@/utils/musicSdk/utils'
import { createKugouApi, parseKugouSession, type KugouSession, type KugouCaptchaPresenter } from './kugouApi'
import { encryptKugouVerification } from './kugouVerification'
import { kugouVerificationStatus, type KugouVerificationStatus } from '@/utils/kugouVerification'
export const kugouApi = createKugouApi(fetch, toMD5, encryptKugouVerification)
const storage = () => {
  const module = NativeModules.MusicCredentialModule
  if (!module?.getKugouSession || !module?.setKugouSession) throw new Error('credential_storage')
  return module
}
export const readKugouSession = async(): Promise<KugouSession | null> => {
  const value: string | null = await storage().getKugouSession()
  if (!value) return null
  try { return parseKugouSession(JSON.parse(value)) } catch { return null }
}
export const saveKugouSession = async(session: KugouSession) => {
  if (!parseKugouSession(session)) throw new Error('login_required')
  await storage().setKugouSession(JSON.stringify(session))
}
export const clearKugouSession = async() => { await storage().clearKugouSession() }
export const requireKugouSession = async() => {
  const session = await readKugouSession()
  if (!session) throw new Error('login_required')
  return session
}
export const assertKugouSession = async(before: KugouSession) => {
  const after = await readKugouSession()
  if (!after || before.userId != after.userId || before.token != after.token) throw new Error('account_changed')
}
let verificationTask: Promise<KugouVerificationStatus> | undefined
export const verifyKugouAccess = async(present: KugouCaptchaPresenter): Promise<KugouVerificationStatus> => {
  if (verificationTask) return verificationTask
  verificationTask = (async(): Promise<KugouVerificationStatus> => {
    try {
      const session = await requireKugouSession()
      await kugouApi.verifyAccess(session, present, async() => assertKugouSession(session))
      return 'available'
    } catch (error) { return kugouVerificationStatus(error) }
  })().finally(() => { verificationTask = undefined })
  return verificationTask
}
