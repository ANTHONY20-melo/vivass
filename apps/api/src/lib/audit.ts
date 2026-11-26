import { prisma } from '../db.js'

interface AuditEntry {
  actorId?: string | null
  institutionId?: string | null
  action: string
  entity: string
  entityId?: string | null
  metadata?: Record<string, unknown>
  ip?: string
}

/**
 * Auditoria é obrigatória para operações de escrita, mas nunca derruba a ação do
 * usuário: a falha é registrada no log do servidor.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        institutionId: entry.institutionId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        ip: entry.ip ?? null,
      },
    })
  } catch (error) {
    console.error('[audit] falha ao registrar evento', entry.action, error)
  }
}
