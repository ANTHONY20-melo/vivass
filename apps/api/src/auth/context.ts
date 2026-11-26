import type { MemberRole, PlatformRole } from '@vivass/shared'

export interface AuthUser {
  id: string
  name: string
  email: string
  platformRole: PlatformRole
}

export interface AuthMembership {
  institutionId: string
  institutionName: string
  role: MemberRole
}

/** Contexto montado a cada requisição autenticada, a partir do banco (nunca do token). */
export interface AuthContext {
  user: AuthUser
  memberships: AuthMembership[]
}
