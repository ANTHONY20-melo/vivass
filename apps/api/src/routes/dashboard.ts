import type { FastifyInstance } from 'fastify'
import type { DashboardData } from '@vivass/shared'
import { PROFESSIONAL_ROLES, VIVASS_AXES, dashboardQuerySchema } from '@vivass/shared'
import { prisma } from '../db.js'
import { notFound } from '../lib/errors.js'
import { parseInput } from '../lib/validate.js'
import { assertInstitutionAccess, requireAuth } from '../lib/tenancy.js'

const DAY_MS = 24 * 60 * 60 * 1000
const MONTH_LABELS = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/institutions/:institutionId/dashboard',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'dashboard:read')

      const { days } = parseInput(dashboardQuerySchema, request.query)

      const institution = await prisma.institution.findUnique({
        where: { id: institutionId },
        select: { id: true, name: true, kind: true, city: true, state: true, isDemo: true },
      })
      if (!institution) throw notFound('Instituição não encontrada.')

      const from = new Date(Date.now() - days * DAY_MS)

      const [students, memberships, projects, activities] = await Promise.all([
        prisma.student.count({ where: { institutionId, status: 'ACTIVE' } }),
        prisma.membership.findMany({
          where: { institutionId, active: true },
          select: { role: true },
        }),
        prisma.project.findMany({
          where: { institutionId },
          select: { id: true, name: true, axis: true, status: true },
          orderBy: { name: 'asc' },
        }),
        prisma.activity.findMany({
          where: { institutionId, scheduledAt: { gte: from } },
          select: {
            id: true,
            title: true,
            axis: true,
            status: true,
            scheduledAt: true,
            participants: true,
            projectId: true,
          },
        }),
      ])

      const professionals = memberships.filter((membership) =>
        (PROFESSIONAL_ROLES as readonly string[]).includes(membership.role),
      ).length
      const families = memberships.filter((membership) => membership.role === 'FAMILY').length

      const completed = activities.filter((activity) => activity.status === 'COMPLETED')
      const pending = activities.filter(
        (activity) => activity.status === 'PLANNED' || activity.status === 'IN_PROGRESS',
      )
      const participants = activities.reduce((total, activity) => total + activity.participants, 0)
      const completionRate =
        activities.length === 0 ? 0 : Math.round((completed.length / activities.length) * 100)

      const byAxis = VIVASS_AXES.map((axis) => {
        const axisActivities = activities.filter((activity) => activity.axis === axis)
        return {
          axis,
          total: axisActivities.length,
          completed: axisActivities.filter((activity) => activity.status === 'COMPLETED').length,
        }
      })

      const now = new Date()
      const monthly: DashboardData['monthly'] = []
      const buckets = new Map<string, { total: number; completed: number }>()

      for (let index = 5; index >= 0; index -= 1) {
        const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1))
        const key = monthKey(date)
        buckets.set(key, { total: 0, completed: 0 })
        monthly.push({
          month: key,
          label: MONTH_LABELS[date.getUTCMonth()] ?? key,
          total: 0,
          completed: 0,
        })
      }

      for (const activity of activities) {
        if (!activity.scheduledAt) continue
        const bucket = buckets.get(monthKey(activity.scheduledAt))
        if (!bucket) continue
        bucket.total += 1
        if (activity.status === 'COMPLETED') bucket.completed += 1
      }

      for (const entry of monthly) {
        const bucket = buckets.get(entry.month)
        if (bucket) {
          entry.total = bucket.total
          entry.completed = bucket.completed
        }
      }

      const projectSummary = projects
        .map((project) => {
          const projectActivities = activities.filter(
            (activity) => activity.projectId === project.id,
          )
          const done = projectActivities.filter(
            (activity) => activity.status === 'COMPLETED',
          ).length
          return {
            id: project.id,
            name: project.name,
            axis: project.axis as DashboardData['projects'][number]['axis'],
            status: project.status as DashboardData['projects'][number]['status'],
            activities: projectActivities.length,
            completion:
              projectActivities.length === 0
                ? 0
                : Math.round((done / projectActivities.length) * 100),
          }
        })
        .sort((a, b) => b.activities - a.activities)

      const recentActivities = [...activities]
        .filter((activity) => activity.scheduledAt !== null)
        .sort(
          (a, b) =>
            (b.scheduledAt?.getTime() ?? 0) - (a.scheduledAt?.getTime() ?? 0),
        )
        .slice(0, 6)
        .map((activity) => ({
          id: activity.id,
          title: activity.title,
          axis: activity.axis as DashboardData['recentActivities'][number]['axis'],
          status: activity.status as DashboardData['recentActivities'][number]['status'],
          scheduledAt: activity.scheduledAt?.toISOString() ?? null,
          participants: activity.participants,
        }))

      const data: DashboardData = {
        institution: {
          id: institution.id,
          name: institution.name,
          kind: institution.kind as DashboardData['institution']['kind'],
          city: institution.city,
          state: institution.state,
          isDemo: institution.isDemo,
        },
        period: { days, from: from.toISOString() },
        totals: {
          students,
          professionals,
          families,
          projectsActive: projects.filter((project) => project.status === 'ACTIVE').length,
          activitiesTotal: activities.length,
          activitiesCompleted: completed.length,
          activitiesPending: pending.length,
          participants,
          completionRate,
        },
        byAxis,
        monthly,
        projects: projectSummary,
        recentActivities,
      }

      return data
    },
  )
}
