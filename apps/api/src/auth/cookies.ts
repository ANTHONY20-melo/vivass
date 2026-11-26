import type { CookieSerializeOptions } from '@fastify/cookie'
import { env } from '../env.js'

export const REFRESH_COOKIE = 'vivass_rt'

/**
 * Cookie de refresh: httpOnly, restrito ao caminho de autenticação, sem acesso por JS.
 * `secure` só é true atrás de HTTPS (produção).
 */
export function refreshCookieOptions(expiresAt?: Date): CookieSerializeOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.COOKIE_SECURE,
    path: '/api/auth',
    ...(expiresAt ? { expires: expiresAt } : {}),
  }
}
