import type { FastifyInstance } from 'fastify'
import type { PortalData } from '@vivass/shared'
import { prisma } from '../db.js'
import { notFound } from '../lib/errors.js'
import { assertInstitutionAccess, requireAuth } from '../lib/tenancy.js'

function audiencesFor(role: string): string[] {
  if (role === 'FAMILY') return ['ALL', 'FAMILIES']
  if (role === 'STUDENT') return ['ALL', 'STUDENTS']
  return ['ALL', 'PROFESSIONALS', 'FAMILIES', 'STUDENTS']
}

export async function portalRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/institutions/:institutionId/portal',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      const { role } = assertInstitutionAccess(auth, institutionId, 'portal:access')

      const institution = await prisma.institution.findUnique({
        where: { id: institutionId },
        select: { id: true, name: true, isDemo: true },
      })
      if (!institution) throw notFound('Instituição não encontrada.')

      const audiences = audiencesFor(role)
      const now = new Date()

      const [announcements, upcoming, library] = await Promise.all([
        prisma.announcement.findMany({
          where: {
            institutionId,
            audience: { in: audiences },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          include: { class: { select: { name: true } } },
          orderBy: { publishedAt: 'desc' },
          take: 20,
        }),
        prisma.activity.findMany({
          where: {
            institutionId,
            scheduledAt: { gte: now },
            status: { in: ['PLANNED', 'IN_PROGRESS'] },
          },
          include: { project: { select: { name: true } } },
          orderBy: { scheduledAt: 'asc' },
          take: 8,
        }),
        prisma.libraryItem.findMany({
          where: { institutionId, audience: { in: audiences } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      ])

      const data: PortalData = {
        institution,
        announcements: announcements.map((item) => ({
          id: item.id,
          title: item.title,
          body: item.body,
          audience: item.audience as PortalData['announcements'][number]['audience'],
          classId: item.classId,
          className: item.class?.name ?? null,
          publishedAt: item.publishedAt.toISOString(),
          expiresAt: item.expiresAt?.toISOString() ?? null,
        })),
        upcomingActivities: upcoming.map((activity) => ({
          id: activity.id,
          title: activity.title,
          axis: activity.axis as PortalData['upcomingActivities'][number]['axis'],
          scheduledAt: activity.scheduledAt?.toISOString() ?? null,
          projectName: activity.project?.name ?? null,
        })),
        library: library.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          category: item.category as PortalData['library'][number]['category'],
          kind: item.kind as PortalData['library'][number]['kind'],
          url: item.url,
          content: item.content,
          audience: item.audience as PortalData['library'][number]['audience'],
          createdAt: item.createdAt.toISOString(),
        })),
      }

      return data
    },
  )
}
