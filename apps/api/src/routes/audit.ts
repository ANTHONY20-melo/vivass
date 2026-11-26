import type { FastifyInstance } from 'fastify'
import type { AuditEntrySummary } from '@vivass/shared'
import { paginationQuerySchema } from '@vivass/shared'
import { prisma } from '../db.js'
import { parseInput } from '../lib/validate.js'
import { assertInstitutionAccess, requireAuth } from '../lib/tenancy.js'

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/institutions/:institutionId/audit',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'audit:read')

      const query = parseInput(paginationQuerySchema, request.query)

      const where = {
        institutionId,
        ...(query.search
          ? { action: { contains: query.search } }
          : {}),
      }

      const [total, rows] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
          where,
          include: { actor: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ])

      const items: AuditEntrySummary[] = rows.map((row) => {
        let metadata: Record<string, unknown> | null = null
        if (row.metadata) {
          try {
            metadata = JSON.parse(row.metadata) as Record<string, unknown>
          } catch {
            metadata = null
          }
        }
        return {
          id: row.id,
          action: row.action,
          entity: row.entity,
          entityId: row.entityId,
          actorName: row.actor?.name ?? null,
          ip: row.ip,
          createdAt: row.createdAt.toISOString(),
          metadata,
        }
      })

      return { items, total, page: query.page, pageSize: query.pageSize }
    },
  )
}
