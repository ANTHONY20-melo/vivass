import type { FastifyInstance } from 'fastify'
import type { DataRequestSummary } from '@vivass/shared'
import { createDataRequestSchema, updateDataRequestSchema } from '@vivass/shared'
import { prisma } from '../db.js'
import { invalid, notFound } from '../lib/errors.js'
import { parseInput } from '../lib/validate.js'
import { recordAudit } from '../lib/audit.js'
import { assertInstitutionAccess, requireAuth } from '../lib/tenancy.js'

function toRequestSummary(item: {
  id: string
  requesterName: string
  requesterEmail: string
  type: string
  status: string
  details: string
  resolution: string | null
  createdAt: Date
  updatedAt: Date
}): DataRequestSummary {
  return {
    id: item.id,
    requesterName: item.requesterName,
    requesterEmail: item.requesterEmail,
    type: item.type as DataRequestSummary['type'],
    status: item.status as DataRequestSummary['status'],
    details: item.details,
    resolution: item.resolution,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}

export async function requestRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/institutions/:institutionId/requests',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'request:read')

      const requests = await prisma.dataRequest.findMany({
        where: { institutionId },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: 200,
      })

      return requests.map(toRequestSummary)
    },
  )

  app.post(
    '/institutions/:institutionId/requests',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'request:manage')

      const input = parseInput(createDataRequestSchema, request.body)

      const created = await prisma.dataRequest.create({
        data: {
          institutionId,
          requesterName: input.requesterName,
          requesterEmail: input.requesterEmail,
          type: input.type,
          details: input.details,
          createdById: auth.user.id,
        },
      })

      await recordAudit({
        actorId: auth.user.id,
        institutionId,
        action: 'DATA_REQUEST_CREATE',
        entity: 'DataRequest',
        entityId: created.id,
        metadata: { type: created.type },
        ip: request.ip,
      })

      return reply.code(201).send(toRequestSummary(created))
    },
  )

  app.patch(
    '/institutions/:institutionId/requests/:requestId',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId, requestId } = request.params as {
        institutionId: string
        requestId: string
      }
      assertInstitutionAccess(auth, institutionId, 'request:manage')

      const existing = await prisma.dataRequest.findFirst({
        where: { id: requestId, institutionId },
        select: { id: true },
      })
      if (!existing) throw notFound('Solicitação não encontrada.')

      const input = parseInput(updateDataRequestSchema, request.body)
      if (
        (input.status === 'DONE' || input.status === 'REJECTED') &&
        (!input.resolution || input.resolution.trim().length < 10)
      ) {
        throw invalid('Registre a resposta dada ao titular antes de encerrar a solicitação.')
      }

      const updated = await prisma.dataRequest.update({
        where: { id: requestId },
        data: {
          status: input.status,
          ...(input.resolution !== undefined ? { resolution: input.resolution } : {}),
        },
      })

      await recordAudit({
        actorId: auth.user.id,
        institutionId,
        action: 'DATA_REQUEST_UPDATE',
        entity: 'DataRequest',
        entityId: requestId,
        metadata: { status: input.status },
        ip: request.ip,
      })

      return toRequestSummary(updated)
    },
  )
}
