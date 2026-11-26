import type { FastifyInstance } from 'fastify'
import { changePasswordSchema, loginSchema } from '@vivass/shared'
import { prisma } from '../db.js'
import { hashPassword, verifyPassword } from '../auth/password.js'
import {
  hashRefreshToken,
  newRefreshToken,
  refreshExpiry,
  signAccessToken,
} from '../auth/tokens.js'
import { REFRESH_COOKIE, refreshCookieOptions } from '../auth/cookies.js'
import { unauthorized } from '../lib/errors.js'
import { parseInput } from '../lib/validate.js'
import { recordAudit } from '../lib/audit.js'
import { toSessionUser, toSessionUserFromAuth } from '../lib/session.js'
import { requireAuth } from '../lib/tenancy.js'

/** Hash descartável para igualar o tempo de resposta quando o e-mail não existe. */
let timingGuard: Promise<string> | null = null
function getTimingGuard(): Promise<string> {
  timingGuard ??= hashPassword('vivass-timing-guard-not-a-real-password')
  return timingGuard
}

function clientMeta(request: { ip: string; headers: Record<string, unknown> }) {
  const agent = request.headers['user-agent']
  return {
    ip: request.ip,
    userAgent: typeof agent === 'string' ? agent.slice(0, 200) : null,
  }
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/auth/login',
    { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { email, password } = parseInput(loginSchema, request.body)

      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          memberships: {
            where: { active: true },
            include: { institution: { select: { id: true, name: true } } },
          },
        },
      })

      const passwordOk = user
        ? await verifyPassword(password, user.passwordHash)
        : await verifyPassword(password, await getTimingGuard())

      if (!user || !passwordOk || user.status !== 'ACTIVE') {
        await recordAudit({
          action: 'AUTH_LOGIN_FAILED',
          entity: 'User',
          metadata: { reason: 'invalid_credentials' },
          ip: request.ip,
        })
        throw unauthorized('E-mail ou senha inválidos.')
      }

      const rawRefresh = newRefreshToken()
      const expiresAt = refreshExpiry()
      const meta = clientMeta(request)

      await prisma.$transaction([
        prisma.refreshToken.create({
          data: {
            userId: user.id,
            tokenHash: hashRefreshToken(rawRefresh),
            expiresAt,
            userAgent: meta.userAgent,
            ip: meta.ip,
          },
        }),
        prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        }),
      ])

      reply.setCookie(REFRESH_COOKIE, rawRefresh, refreshCookieOptions(expiresAt))

      await recordAudit({
        actorId: user.id,
        action: 'AUTH_LOGIN',
        entity: 'User',
        entityId: user.id,
        ip: request.ip,
      })

      return {
        accessToken: await signAccessToken(user.id),
        user: toSessionUser(user),
      }
    },
  )

  app.post(
    '/auth/refresh',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const raw = request.cookies[REFRESH_COOKIE]
      if (!raw) throw unauthorized('Sessão não encontrada.')

      const record = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashRefreshToken(raw) },
        include: {
          user: {
            include: {
              memberships: {
                where: { active: true },
                include: { institution: { select: { id: true, name: true } } },
              },
            },
          },
        },
      })

      if (!record) {
        reply.clearCookie(REFRESH_COOKIE, refreshCookieOptions())
        throw unauthorized('Sessão inválida.')
      }

      // Reuso de token revogado = possível roubo de sessão: revoga todas as sessões do usuário.
      if (record.revokedAt) {
        await prisma.refreshToken.updateMany({
          where: { userId: record.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        })
        reply.clearCookie(REFRESH_COOKIE, refreshCookieOptions())
        throw unauthorized('Sessão encerrada por segurança. Entre novamente.')
      }

      if (record.expiresAt.getTime() <= Date.now() || record.user.status !== 'ACTIVE') {
        reply.clearCookie(REFRESH_COOKIE, refreshCookieOptions())
        throw unauthorized('Sessão expirada. Entre novamente.')
      }

      const nextRaw = newRefreshToken()
      const expiresAt = refreshExpiry()
      const meta = clientMeta(request)

      await prisma.$transaction([
        prisma.refreshToken.update({
          where: { id: record.id },
          data: { revokedAt: new Date() },
        }),
        prisma.refreshToken.create({
          data: {
            userId: record.userId,
            tokenHash: hashRefreshToken(nextRaw),
            expiresAt,
            userAgent: meta.userAgent,
            ip: meta.ip,
          },
        }),
      ])

      reply.setCookie(REFRESH_COOKIE, nextRaw, refreshCookieOptions(expiresAt))

      return {
        accessToken: await signAccessToken(record.userId),
        user: toSessionUser(record.user),
      }
    },
  )

  app.post('/auth/logout', async (request, reply) => {
    const raw = request.cookies[REFRESH_COOKIE]

    if (raw) {
      const record = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashRefreshToken(raw) },
      })
      if (record) {
        await prisma.refreshToken.update({
          where: { id: record.id },
          data: { revokedAt: new Date() },
        })
        await recordAudit({
          actorId: record.userId,
          action: 'AUTH_LOGOUT',
          entity: 'RefreshToken',
          entityId: record.id,
          ip: request.ip,
        })
      }
    }

    reply.clearCookie(REFRESH_COOKIE, refreshCookieOptions())
    return reply.code(204).send()
  })

  app.get('/auth/me', { preHandler: app.authenticate }, async (request) => {
    return toSessionUserFromAuth(requireAuth(request))
  })

  /**
   * Troca de senha: exige a senha atual, invalida as demais sessões e emite
   * uma nova sessão para quem trocou, sem encerrar o acesso imediatamente.
   */
  app.post('/auth/change-password', { preHandler: app.authenticate }, async (request, reply) => {
    const auth = requireAuth(request)
    const { currentPassword, newPassword } = parseInput(
      changePasswordSchema,
      request.body,
    )

    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { id: true, passwordHash: true },
    })
    if (!user) throw unauthorized('Sessão inválida.')

    const valid = await verifyPassword(currentPassword, user.passwordHash)
    if (!valid) throw unauthorized('A senha atual não confere.')

    const newHash = await hashPassword(newPassword)
    const rawRefresh = newRefreshToken()
    const expiresAt = refreshExpiry()
    const meta = clientMeta(request)

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } }),
      prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: hashRefreshToken(rawRefresh),
          expiresAt,
          userAgent: meta.userAgent,
          ip: meta.ip,
        },
      }),
    ])

    reply.setCookie(REFRESH_COOKIE, rawRefresh, refreshCookieOptions(expiresAt))

    await recordAudit({
      actorId: user.id,
      action: 'AUTH_PASSWORD_CHANGED',
      entity: 'User',
      entityId: user.id,
      ip: request.ip,
    })

    return reply.code(200).send({ changed: true })
  })
}
