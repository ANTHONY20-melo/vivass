import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import type { ScryptOptions } from 'node:crypto'

/**
 * Hash de senha com scrypt nativo do Node — sem dependência binária nativa, sem
 * `latest`, e com parâmetros explícitos gravados junto ao hash (permite migrar depois).
 */
const PARAMS = { N: 16384, r: 8, p: 1 } satisfies ScryptOptions
const KEY_LENGTH = 64
const SALT_LENGTH = 16

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, options, (error, key) => {
      if (error) reject(error)
      else resolve(key)
    })
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const key = await derive(password, salt, PARAMS)
  return [
    'scrypt',
    String(PARAMS.N),
    String(PARAMS.r),
    String(PARAMS.p),
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 6) return false

  const [algorithm, n, r, p, saltB64, keyB64] = parts
  if (algorithm !== 'scrypt' || !n || !r || !p || !saltB64 || !keyB64) return false

  const salt = Buffer.from(saltB64, 'base64')
  const expected = Buffer.from(keyB64, 'base64')
  if (salt.length === 0 || expected.length === 0) return false

  const actual = await derive(password, salt, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  })

  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
