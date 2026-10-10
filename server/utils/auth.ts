import { createHash } from 'node:crypto'

/**
 * 将用户的 sign（签名/口令）哈希后存储，明文不落库。
 */
export function hashSign(sign: string): string {
  const secret = (useRuntimeConfig().appSecret as string) || 'gamehub-default-secret'
  return createHash('sha256').update(`${sign}:${secret}`).digest('hex')
}

export function verifySign(sign: string, expectedHash: string): boolean {
  if (!sign || !expectedHash) return false
  return hashSign(sign) === expectedHash
}
