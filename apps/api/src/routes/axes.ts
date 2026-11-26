import type { FastifyInstance } from 'fastify'
import type { AxisSummary } from '@vivass/shared'
import { BIOPSYCHOSOCIAL_DIMENSIONS, VIVASS_AXES } from '@vivass/shared'
import { prisma } from '../db.js'
import { assertInstitutionAccess, requireAuth } from '../lib/tenancy.js'

export async function axisRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/institutions/:institutionId/axes',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'dashboard:read')

      const [projects, activities] = await Promise.all([
        prisma.project.findMany({
          where: { institutionId },
          select: { axis: true },
        }),
        prisma.activity.findMany({
          where: { institutionId },
          select: {
            axis: true,
            dimension: true,
            status: true,
            participants: true,
            scheduledAt: true,
          },
        }),
      ])

      const now = Date.now()

      const result: AxisSummary[] = VIVASS_AXES.map((axis) => {
        const axisActivities = activities.filter((activity) => activity.axis === axis)
        return {
          axis,
          projects: projects.filter((project) => project.axis === axis).length,
          activities: axisActivities.length,
          completed: axisActivities.filter((activity) => activity.status === 'COMPLETED')
            .length,
          participants: axisActivities.reduce(
            (total, activity) => total + activity.participants,
            0,
          ),
          upcoming: axisActivities.filter(
            (activity) =>
              activity.scheduledAt !== null &&
              activity.scheduledAt.getTime() >= now &&
              (activity.status === 'PLANNED' || activity.status === 'IN_PROGRESS'),
          ).length,
          byDimension: BIOPSYCHOSOCIAL_DIMENSIONS.map((dimension) => ({
            dimension,
            activities: axisActivities.filter(
              (activity) => activity.dimension === dimension,
            ).length,
          })),
        }
      })

      return result
    },
  )
}
