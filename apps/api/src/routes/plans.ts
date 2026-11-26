import type { FastifyInstance } from 'fastify'
import type { Prisma } from '@prisma/client'
import type { PlanSummary } from '@vivass/shared'
import {
  createMilestoneSchema,
  createPlanSchema,
  updateMilestoneSchema,
  updatePlanSchema,
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

type PlanRow = Prisma.ActionPlanGetPayload<{
  include: {
    project: { select: { name: true } }
    milestones: true
  }
}>

function toPlanSummary(plan: PlanRow): PlanSummary {
  return {
    id: plan.id,
    title: plan.title,
    objective: plan.objective,
    axis: plan.axis as PlanSummary['axis'],
    responsible: plan.responsible,
    projectId: plan.projectId,
    projectName: plan.project?.name ?? null,
    startDate: plan.startDate?.toISOString() ?? null,
    dueDate: plan.dueDate?.toISOString() ?? null,
    status: plan.status as PlanSummary['status'],
    progress: plan.progress,
    createdAt: plan.createdAt.toISOString(),
    milestones: plan.milestones
      .slice()
      .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))
      .map((milestone) => ({
        id: milestone.id,
        title: milestone.title,
        dueDate: milestone.dueDate?.toISOString() ?? null,
        done: milestone.done,
      })),
  }
}

async function recalcProgress(planId: string): Promise<number> {
  const milestones = await prisma.planMilestone.findMany({
    where: { planId },
    select: { done: true },
  })
  if (milestones.length === 0) return 0
  const done = milestones.filter((milestone) => milestone.done).length
  return Math.round((done / milestones.length) * 100)
}

export async function planRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/institutions/:institutionId/plans',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'plan:read')

      const plans = await prisma.actionPlan.findMany({
        where: { institutionId },
        include: { project: { select: { name: true } }, milestones: true },
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
      })

      return plans.map(toPlanSummary)
    },
  )

  app.post(
    '/institutions/:institutionId/plans',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'plan:manage')

      const input = parseInput(createPlanSchema, request.body)

      if (input.projectId) {
        const project = await prisma.project.findFirst({
          where: { id: input.projectId, institutionId },
          select: { id: true },
        })
        if (!project) throw invalid('O projeto informado não pertence a esta instituição.')
      }

      const plan = await prisma.actionPlan.create({
        data: {
          institutionId,
          projectId: input.projectId ?? null,
          title: input.title,
          objective: input.objective,
          axis: input.axis,
          responsible: input.responsible,
          startDate: toDate(input.startDate),
          dueDate: toDate(input.dueDate),
          createdById: auth.user.id,
        },
        include: { project: { select: { name: true } }, milestones: true },
      })

      await recordAudit({
        actorId: auth.user.id,
        institutionId,
        action: 'PLAN_CREATE',
        entity: 'ActionPlan',
        entityId: plan.id,
        metadata: { title: plan.title, axis: plan.axis },
        ip: request.ip,
      })

      return reply.code(201).send(toPlanSummary(plan))
    },
  )

  app.patch(
    '/institutions/:institutionId/plans/:planId',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId, planId } = request.params as {
        institutionId: string
        planId: string
      }
      assertInstitutionAccess(auth, institutionId, 'plan:manage')

      const existing = await prisma.actionPlan.findFirst({
        where: { id: planId, institutionId },
        select: { id: true },
      })
      if (!existing) throw notFound('Plano de ação não encontrado.')

      const input = parseInput(updatePlanSchema, request.body)

      if (input.projectId) {
        const project = await prisma.project.findFirst({
          where: { id: input.projectId, institutionId },
          select: { id: true },
        })
        if (!project) throw invalid('O projeto informado não pertence a esta instituição.')
      }

      const data: Prisma.ActionPlanUpdateInput = {}
      if (input.title !== undefined) data.title = input.title
      if (input.objective !== undefined) data.objective = input.objective
      if (input.axis !== undefined) data.axis = input.axis
      if (input.responsible !== undefined) data.responsible = input.responsible
      if (input.startDate !== undefined) data.startDate = toDate(input.startDate)
      if (input.dueDate !== undefined) data.dueDate = toDate(input.dueDate)
      if (input.status !== undefined) {
        data.status = input.status
        if (input.status === 'COMPLETED') data.progress = 100
      }
      if (input.progress !== undefined) data.progress = input.progress
      if (input.projectId !== undefined) {
        data.project = input.projectId
          ? { connect: { id: input.projectId } }
          : { disconnect: true }
      }

      const plan = await prisma.actionPlan.update({
        where: { id: planId },
        data,
        include: { project: { select: { name: true } }, milestones: true },
      })

      await recordAudit({
        actorId: auth.user.id,
        institutionId,
        action: 'PLAN_UPDATE',
        entity: 'ActionPlan',
        entityId: planId,
        metadata: { fields: Object.keys(input) },
        ip: request.ip,
      })

      return toPlanSummary(plan)
    },
  )

  app.post(
    '/institutions/:institutionId/plans/:planId/milestones',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = requireAuth(request)
      const { institutionId, planId } = request.params as {
        institutionId: string
        planId: string
      }
      assertInstitutionAccess(auth, institutionId, 'plan:manage')

      const plan = await prisma.actionPlan.findFirst({
        where: { id: planId, institutionId },
        select: { id: true },
      })
      if (!plan) throw notFound('Plano de ação não encontrado.')

      const input = parseInput(createMilestoneSchema, request.body)
      const milestone = await prisma.planMilestone.create({
        data: {
          planId,
          title: input.title,
          dueDate: toDate(input.dueDate),
        },
      })

      const progress = await recalcProgress(planId)
      await prisma.actionPlan.update({ where: { id: planId }, data: { progress } })

      await recordAudit({
        actorId: auth.user.id,
        institutionId,
        action: 'MILESTONE_CREATE',
        entity: 'PlanMilestone',
        entityId: milestone.id,
        metadata: { planId },
        ip: request.ip,
      })

      return reply.code(201).send({
        id: milestone.id,
        title: milestone.title,
        dueDate: milestone.dueDate?.toISOString() ?? null,
        done: milestone.done,
        progress,
      })
    },
  )

  app.patch(
    '/institutions/:institutionId/plans/:planId/milestones/:milestoneId',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId, planId, milestoneId } = request.params as {
        institutionId: string
        planId: string
        milestoneId: string
      }
      assertInstitutionAccess(auth, institutionId, 'plan:manage')

      const milestone = await prisma.planMilestone.findFirst({
        where: { id: milestoneId, planId, plan: { institutionId } },
        select: { id: true },
      })
      if (!milestone) throw notFound('Marco não encontrado.')

      const input = parseInput(updateMilestoneSchema, request.body)
      const updated = await prisma.planMilestone.update({
        where: { id: milestoneId },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.dueDate !== undefined ? { dueDate: toDate(input.dueDate) } : {}),
          ...(input.done !== undefined ? { done: input.done } : {}),
        },
      })

      const progress = await recalcProgress(planId)
      await prisma.actionPlan.update({ where: { id: planId }, data: { progress } })

      await recordAudit({
        actorId: auth.user.id,
        institutionId,
        action: 'MILESTONE_UPDATE',
        entity: 'PlanMilestone',
        entityId: milestoneId,
        metadata: { done: updated.done },
        ip: request.ip,
      })

      return {
        id: updated.id,
        title: updated.title,
        dueDate: updated.dueDate?.toISOString() ?? null,
        done: updated.done,
        progress,
      }
    },
  )
}
