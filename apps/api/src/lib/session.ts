import type { User } from '@prisma/client'
import type { MemberRole, PlatformRole, SessionUser } from '@vivass/shared'
import { permissionsFor } from '@vivass/shared'
import type { AuthContext } from '../auth/context.js'

export type UserWithMemberships = User & {
  memberships: Array<{
    institutionId: string
    role: string
    institution: { id: string; name: string }
  }>
}

export function toSessionUser(user: UserWithMemberships): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    platformRole: user.platformRole as PlatformRole,
    memberships: user.memberships.map((membership) => ({
      institutionId: membership.institutionId,
      institutionName: membership.institution.name,
      role: membership.role as MemberRole,
      permissions: permissionsFor(membership.role),
    })),
  }
}

export function toSessionUserFromAuth(auth: AuthContext): SessionUser {
  return {
    id: auth.user.id,
    name: auth.user.name,
    email: auth.user.email,
    platformRole: auth.user.platformRole,
    memberships: auth.memberships.map((membership) => ({
      institutionId: membership.institutionId,
      institutionName: membership.institutionName,
      role: membership.role,
      permissions: permissionsFor(membership.role),
    })),
  }
}
