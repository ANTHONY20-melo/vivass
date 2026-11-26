import type { FastifyRequest } from 'fastify'
import type { Permission } from '@vivass/shared'
import { can } from '@vivass/shared'
import type { AuthContext } from '../auth/context.js'
import { forbidden, unauthorized } from './errors.js'

export function requireAuth(request: FastifyRequest): AuthContext {
  if (!request.auth) throw unauthorized()
  return request.auth
}

export function assertSuperadmin(auth: AuthContext): void {
  if (auth.user.platformRole !== 'SUPERADMIN') {
    throw forbidden('Ação exclusiva do superadministrador da plataforma.')
  }
}

/**
 * Única porta de entrada para dados de uma instituição. Sem vínculo ativo, nega.
 * Superadmin passa por ser administrador da plataforma — toda ação dele fica auditada.
 */
export function assertInstitutionAccess(
  auth: AuthContext,
  institutionId: string,
  permission?: Permission,
): { role: string; institutionId: string } {
  if (auth.user.platformRole === 'SUPERADMIN') {
    return { role: 'SUPERADMIN', institutionId }
  }

  const membership = auth.memberships.find(
    (item) => item.institutionId === institutionId,
  )

  if (!membership) {
    throw forbidden('Seu usuário não possui vínculo ativo com esta instituição.')
  }

  if (permission && !can(membership.role, permission)) {
    throw forbidden('Seu perfil não permite esta operação nesta instituição.')
  }

  return { role: membership.role, institutionId }
}
