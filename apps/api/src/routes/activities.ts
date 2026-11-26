import type { FastifyInstance } from 'fastify'
import type { Prisma } from '@prisma/client'
import type { ActivitySummary, Paginated } from '@vivass/shared'
import {
  activityQuerySchema,
  createActivitySchema,
  updateActivitySchema,
} from '@vivass/shared'
import { prisma } from '../db.js'
import { invalid, notFound } from '../lib/errors.js'
import { parseInput } from '../lib/validate.js'
import { recordAudit } from '../lib/audit.js'
import { assertInstitutionAccess, requireAuth } from '../lib/tenancy.js'

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

type ActivityRow = Prisma.ActivityGetPayload<{
  include: { project: { select: { name: true } } }
}>

function toActivitySummary(activity: ActivityRow): ActivitySummary {
  return {
    id: activity.id,
    title: activity.title,
    description: activity.description,
    projectId: activity.projectId,
    projectName: activity.project?.name ?? null,
    axis: activity.axis as ActivitySummary['axis'],
    dimension: activity.dimension as ActivitySummary['dimension'],
    status: activity.status as ActivitySummary['status'],
    scheduledAt: activity.scheduledAt?.toISOString() ?? null,
    completedAt: activity.completedAt?.toISOString() ?? null,
    participants: activity.participants,
  }
}

async function assertProject(institutionId: string, projectId: string): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, institutionId },
    select: { id: true },
  })
  if (!project) throw invalid('O projeto informado não pertence a esta instituição.')
}

export async function activityRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/institutions/:institutionId/activities',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'activity:read')

      const query = parseInput(activityQuerySchema, request.query)
      const where: Prisma.ActivityWhereInput = { institutionId }
      if (query.axis) where.axis = query.axis
      if (query.status) where.status = query.status
      if (query.projectId) where.projectId = query.projectId
      if (query.search) where.title = { contains: query.search }

      if (query.from || query.to) {
        where.scheduledAt = {
          ...(query.from ? { gte: new Date(query.from) } : {}),
          ...(query.to ? { lte: new Date(query.to) } : {}),
        }
      }

      const [total, rows] = await Promise.all([
        prisma.activity.count({ where }),
        prisma.activity.findMany({
          where,
          include: { project: { select: { name: true } } },
          orderBy: [{ scheduledAt: 'desc' }, { title: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ])

      const result: Paginated<ActivitySummary> = {
        items: rows.map(toActivitySummary),
        total,
        page: query.page,
        pageSize: query.pageSize,
      }
      return result
    },
  )

  app.post(
    '/institutions/:institutionId/activities',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'activity:manage')

      const input = parseInput(createActivitySchema, request.body)
      if (input.projectId) await assertProject(institutionId, input.projectId)

      const status = input.status ?? 'PLANNED'
      const activity = await prisma.activity.create({
        data: {
          institutionId,
          projectId: input.projectId ?? null,
          title: input.title,
          description: input.description ?? null,
          axis: input.axis,
          dimension: input.dimension,
          status,
          scheduledAt: toDate(input.scheduledAt),
          completedAt:
            status === 'COMPLETED'
              ? (toDate(input.completedAt) ?? new Date())
              : toDate(input.completedAt),
          participants: input.participants ?? 0,
          createdById: auth.user.id,
        },
        include: { project: { select: { name: true } } },
      })

      await recordAudit({
        actorId: auth.user.id,
        institutionId,
        action: 'ACTIVITY_CREATE',
        entity: 'Activity',
        entityId: activity.id,
        metadata: { title: activity.title, axis: activity.axis },
        ip: request.ip,
      })

      return reply.code(201).send(toActivitySummary(activity))
    },
  )

  app.patch(
    '/institutions/:institutionId/activities/:activityId',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId, activityId } = request.params as {
        institutionId: string
        activityId: string
      }
      assertInstitutionAccess(auth, institutionId, 'activity:manage')

      const existing = await prisma.activity.findFirst({
        where: { id: activityId, institutionId },
        select: { id: true, status: true },
      })
      if (!existing) throw notFound('Atividade não encontrada.')

      const input = parseInput(updateActivitySchema, request.body)
      if (input.projectId) await assertProject(institutionId, input.projectId)

      const data: Prisma.ActivityUpdateInput = {}
      if (input.title !== undefined) data.title = input.title
      if (input.description !== undefined) data.description = input.description
      if (input.axis !== undefined) data.axis = input.axis
      if (input.dimension !== undefined) data.dimension = input.dimension
      if (input.scheduledAt !== undefined) data.scheduledAt = toDate(input.scheduledAt)
      if (input.participants !== undefined) data.participants = input.participants
      if (input.projectId !== undefined) {
        data.project = input.projectId
          ? { connect: { id: input.projectId } }
          : { disconnect: true }
      }
      if (input.status !== undefined) {
        data.status = input.status
        if (input.status === 'COMPLETED' && existing.status !== 'COMPLETED') {
          data.completedAt = toDate(input.completedAt) ?? new Date()
        }
        if (input.status !== 'COMPLETED') data.completedAt = null
      } else if (input.completedAt !== undefined) {
        data.completedAt = toDate(input.completedAt)
      }

      const activity = await prisma.activity.update({
        where: { id: activityId },
        data,
        include: { project: { select: { name: true } } },
      })

      await recordAudit({
        actorId: auth.user.id,
        institutionId,
        action: 'ACTIVITY_UPDATE',
        entity: 'Activity',
        entityId: activityId,
        metadata: { fields: Object.keys(input) },
        ip: request.ip,
      })

      return toActivitySummary(activity)
    },
  )
}
