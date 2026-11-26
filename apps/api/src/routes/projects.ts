import type { FastifyInstance } from 'fastify'
import type { Prisma } from '@prisma/client'
import type { Paginated, ProjectSummary } from '@vivass/shared'
import {
  createProjectSchema,
  projectQuerySchema,
  updateProjectSchema,
} from '@vivass/shared'
import { prisma } from '../db.js'
import { notFound } from '../lib/errors.js'
import { parseInput } from '../lib/validate.js'
import { recordAudit } from '../lib/audit.js'
import { assertInstitutionAccess, requireAuth } from '../lib/tenancy.js'

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

type ProjectRow = Prisma.ProjectGetPayload<{
  include: { activities: { select: { status: true } } }
}>

function toProjectSummary(project: ProjectRow): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    objective: project.objective,
    axis: project.axis as ProjectSummary['axis'],
    dimension: project.dimension as ProjectSummary['dimension'],
    status: project.status as ProjectSummary['status'],
    startDate: project.startDate?.toISOString() ?? null,
    endDate: project.endDate?.toISOString() ?? null,
    activityCount: project.activities.length,
    completedCount: project.activities.filter((activity) => activity.status === 'COMPLETED')
      .length,
  }
}

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/institutions/:institutionId/projects',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'project:read')

      const query = parseInput(projectQuerySchema, request.query)
      const where: Prisma.ProjectWhereInput = { institutionId }
      if (query.axis) where.axis = query.axis
      if (query.status) where.status = query.status
      if (query.search) {
        where.OR = [
          { name: { contains: query.search } },
          { description: { contains: query.search } },
        ]
      }

      const [total, rows] = await Promise.all([
        prisma.project.count({ where }),
        prisma.project.findMany({
          where,
          include: { activities: { select: { status: true } } },
          orderBy: [{ status: 'asc' }, { name: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ])

      const result: Paginated<ProjectSummary> = {
        items: rows.map(toProjectSummary),
        total,
        page: query.page,
        pageSize: query.pageSize,
      }
      return result
    },
  )

  app.post(
    '/institutions/:institutionId/projects',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'project:manage')

      const input = parseInput(createProjectSchema, request.body)

      const project = await prisma.project.create({
        data: {
          institutionId,
          name: input.name,
          description: input.description ?? null,
          objective: input.objective ?? null,
          axis: input.axis,
          dimension: input.dimension,
          status: input.status ?? 'PLANNED',
          startDate: toDate(input.startDate),
          endDate: toDate(input.endDate),
          createdById: auth.user.id,
        },
        include: { activities: { select: { status: true } } },
      })

      await recordAudit({
        actorId: auth.user.id,
        institutionId,
        action: 'PROJECT_CREATE',
        entity: 'Project',
        entityId: project.id,
        metadata: { name: project.name, axis: project.axis },
        ip: request.ip,
      })

      return reply.code(201).send(toProjectSummary(project))
    },
  )

  app.patch(
    '/institutions/:institutionId/projects/:projectId',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId, projectId } = request.params as {
        institutionId: string
        projectId: string
      }
      assertInstitutionAccess(auth, institutionId, 'project:manage')

      const existing = await prisma.project.findFirst({
        where: { id: projectId, institutionId },
        select: { id: true },
      })
      if (!existing) throw notFound('Projeto não encontrado.')

      const input = parseInput(updateProjectSchema, request.body)

      const data: Prisma.ProjectUpdateInput = {}
      if (input.name !== undefined) data.name = input.name
      if (input.description !== undefined) data.description = input.description
      if (input.objective !== undefined) data.objective = input.objective
      if (input.axis !== undefined) data.axis = input.axis
      if (input.dimension !== undefined) data.dimension = input.dimension
      if (input.status !== undefined) data.status = input.status
      if (input.startDate !== undefined) data.startDate = toDate(input.startDate)
      if (input.endDate !== undefined) data.endDate = toDate(input.endDate)

      const project = await prisma.project.update({
        where: { id: projectId },
        data,
        include: { activities: { select: { status: true } } },
      })

      await recordAudit({
        actorId: auth.user.id,
        institutionId,
        action: 'PROJECT_UPDATE',
        entity: 'Project',
        entityId: projectId,
        metadata: { fields: Object.keys(input) },
        ip: request.ip,
      })

      return toProjectSummary(project)
    },
  )
}
