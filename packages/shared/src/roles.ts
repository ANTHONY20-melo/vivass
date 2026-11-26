/**
 * Papéis e permissões do VIVASS.
 *
 * Regra estrutural: o papel de plataforma (SUPERADMIN) é global; todo o resto é
 * vínculo por instituição (Membership). Nenhuma permissão é inferida por e-mail,
 * domínio ou cargo informal.
 */

export const PLATFORM_ROLES = ['SUPERADMIN', 'USER'] as const
export type PlatformRole = (typeof PLATFORM_ROLES)[number]

export const MEMBER_ROLES = [
  'SCHOOL_MANAGER',
  'COORDINATOR',
  'TEACHER',
  'MULTIDISCIPLINARY',
  'FAMILY',
  'STUDENT',
] as const
export type MemberRole = (typeof MEMBER_ROLES)[number]

export const ROLE_LABELS: Record<PlatformRole | MemberRole, string> = {
  SUPERADMIN: 'Superadministrador',
  USER: 'Usuário',
  SCHOOL_MANAGER: 'Gestor escolar',
  COORDINATOR: 'Coordenador VIVASS',
  TEACHER: 'Professor / Educador',
  MULTIDISCIPLINARY: 'Equipe multidisciplinar',
  FAMILY: 'Família / Responsável',
  STUDENT: 'Estudante',
}

/** Papéis que contam como equipe profissional da escola. */
export const PROFESSIONAL_ROLES: readonly MemberRole[] = [
  'SCHOOL_MANAGER',
  'COORDINATOR',
  'TEACHER',
  'MULTIDISCIPLINARY',
]

export const PERMISSIONS = [
  'institution:read',
  'institution:manage',
  'user:read',
  'user:manage',
  'student:read',
  'student:manage',
  'project:read',
  'project:manage',
  'activity:read',
  'activity:manage',
  'plan:read',
  'plan:manage',
  'diagnostic:read',
  'diagnostic:manage',
  'communication:read',
  'communication:manage',
  'library:read',
  'library:manage',
  'request:read',
  'request:manage',
  'audit:read',
  'dashboard:read',
  'report:read',
  'portal:access',
] as const
export type Permission = (typeof PERMISSIONS)[number]

const MANAGER_PERMISSIONS: readonly Permission[] = [
  'institution:read',
  'user:read',
  'user:manage',
  'student:read',
  'student:manage',
  'project:read',
  'project:manage',
  'activity:read',
  'activity:manage',
  'plan:read',
  'plan:manage',
  'diagnostic:read',
  'diagnostic:manage',
  'communication:read',
  'communication:manage',
  'library:read',
  'library:manage',
  'request:read',
  'request:manage',
  'audit:read',
  'dashboard:read',
  'report:read',
]

const COORDINATOR_PERMISSIONS: readonly Permission[] = [
  'institution:read',
  'user:read',
  'student:read',
  'student:manage',
  'project:read',
  'project:manage',
  'activity:read',
  'activity:manage',
  'plan:read',
  'plan:manage',
  'diagnostic:read',
  'diagnostic:manage',
  'communication:read',
  'communication:manage',
  'library:read',
  'library:manage',
  'request:read',
  'dashboard:read',
  'report:read',
]

const EDUCATOR_PERMISSIONS: readonly Permission[] = [
  'institution:read',
  'student:read',
  'project:read',
  'activity:read',
  'activity:manage',
  'plan:read',
  'diagnostic:read',
  'communication:read',
  'library:read',
  'dashboard:read',
]

const PERMISSION_MATRIX: Record<PlatformRole | MemberRole, readonly Permission[]> = {
  SUPERADMIN: PERMISSIONS,
  USER: [],
  SCHOOL_MANAGER: MANAGER_PERMISSIONS,
  COORDINATOR: COORDINATOR_PERMISSIONS,
  TEACHER: EDUCATOR_PERMISSIONS,
  MULTIDISCIPLINARY: [
    ...EDUCATOR_PERMISSIONS,
    'diagnostic:manage',
    'request:read',
  ],
  FAMILY: ['institution:read', 'library:read', 'portal:access'],
  STUDENT: ['library:read', 'portal:access'],
}

export function can(role: string, permission: Permission): boolean {
  const allowed = PERMISSION_MATRIX[role as PlatformRole | MemberRole]
  return Boolean(allowed?.includes(permission))
}

export function permissionsFor(role: string): Permission[] {
  return [...(PERMISSION_MATRIX[role as PlatformRole | MemberRole] ?? [])]
}

export function isMemberRole(value: string): value is MemberRole {
  return (MEMBER_ROLES as readonly string[]).includes(value)
}

export function isPlatformRole(value: string): value is PlatformRole {
  return (PLATFORM_ROLES as readonly string[]).includes(value)
}
