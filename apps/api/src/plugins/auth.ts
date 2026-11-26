import fp from 'fastify-plugin'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { MemberRole, PlatformRole } from '@vivass/shared'
import { prisma } from '../db.js'
import { unauthorized } from '../lib/errors.js'
import { verifyAccessToken } from '../auth/tokens.js'
import type { AuthContext } from '../auth/context.js'

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

/**
 * Autenticação por Bearer token. O usuário e os vínculos são lidos do banco a cada
 * requisição: desativar um vínculo tem efeito imediato, sem esperar o token expirar.
 */
export const authPlugin = fp(async (app) => {
  app.decorateRequest('auth', null)

  app.decorate('authenticate', async (request: FastifyRequest) => {
    const header = request.headers.authorization
    if (!header || !header.startsWith('Bearer ')) {
      throw unauthorized('Token de acesso ausente.')
    }

    const token = header.slice('Bearer '.length).trim()
    if (!token) throw unauthorized('Token de acesso ausente.')

    let userId: string
    try {
      userId = await verifyAccessToken(token)
    } catch {
      throw unauthorized()
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { active: true },
          include: { institution: { select: { id: true, name: true } } },
        },
      },
    })

    if (!user || user.status !== 'ACTIVE') {
      throw unauthorized()
    }

    request.auth = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        platformRole: user.platformRole as PlatformRole,
      },
      memberships: user.memberships.map((membership) => ({
        institutionId: membership.institutionId,
        institutionName: membership.institution.name,
        role: membership.role as MemberRole,
      })),
    }
  })
})
