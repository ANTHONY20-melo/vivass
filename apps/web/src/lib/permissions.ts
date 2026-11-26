import type { Permission } from '@vivass/shared'
import { useAuth } from './auth'
import { useInstitution } from './institution'

/** Verifica permissões do usuário na instituição ativa. */
export function usePermissionChecker(): (permission: Permission) => boolean {
  const { user } = useAuth()
  const { current } = useInstitution()

  return (permission: Permission) => {
    if (!user) return false
    if (user.platformRole === 'SUPERADMIN') return true
    const membership = user.memberships.find(
      (item) => item.institutionId === current?.id,
    )
    return Boolean(membership?.permissions.includes(permission))
  }
}
