import { createHash, randomBytes } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import { env } from '../env.js'

const secret = new TextEncoder().encode(env.JWT_SECRET)
const ISSUER = 'vivass'
const AUDIENCE = 'vivass-web'

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
export const REFRESH_TOKEN_TTL_DAYS = 30

export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({ scope: 'session' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret)
}

export async function verifyAccessToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, secret, {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ['HS256'],
  })
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('token sem subject')
  }
  return payload.sub
}

/** Token opaco de refresh: aleatório, nunca derivado do usuário. */
export function newRefreshToken(): string {
  return randomBytes(48).toString('base64url')
}

/** No banco guardamos apenas o hash — vazamento do banco não entrega sessão. */
export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export function refreshExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
}
