import { Buffer } from 'buffer'
import { NativeModules } from 'react-native'
import { toMD5 } from '@/utils/musicSdk/utils'
import { aesEncrypt, rsaEncrypt, AES_MODE, RSA_PADDING } from '@/utils/nativeModules/crypto'
import { KUGOU_VERIFY_PUBLIC_KEY } from '@/utils/kugouVerification'

export const encryptKugouVerification = async() => {
  const random: string = await NativeModules.CryptoModule.verificationNonce()
  const key = Buffer.from(random, 'base64').toString('hex').slice(0, 16)
  const aesKey = toMD5(key)
  const padded = Buffer.alloc(128)
  padded.write(JSON.stringify({ key }), 'utf8')
  const pk = Buffer.from(await rsaEncrypt(padded.toString('base64'), KUGOU_VERIFY_PUBLIC_KEY, RSA_PADDING.NoPadding), 'base64').toString('hex')
  const params = Buffer.from(await aesEncrypt(Buffer.from('{}').toString('base64'), Buffer.from(aesKey).toString('base64'), Buffer.from(aesKey.slice(-16)).toString('base64'), AES_MODE.CBC_128_PKCS7Padding), 'base64').toString('hex')
  if (key.length != 16 || pk.length != 256 || !params) throw new Error('verification_failed')
  return { pk, params }
}
