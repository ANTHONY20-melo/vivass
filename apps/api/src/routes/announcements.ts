import type { FastifyInstance } from 'fastify'
import type { AnnouncementSummary } from '@vivass/shared'
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
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

type AnnouncementRow = {
  id: string
  title: string
  body: string
  audience: string
  classId: string | null
  publishedAt: Date
  expiresAt: Date | null
  class: { name: string } | null
}

function toAnnouncementSummary(item: AnnouncementRow): AnnouncementSummary {
  return {
    id: item.id,
    title: item.title,
    body: item.body,
    audience: item.audience as AnnouncementSummary['audience'],
    classId: item.classId,
    className: item.class?.name ?? null,
    publishedAt: item.publishedAt.toISOString(),
    expiresAt: item.expiresAt?.toISOString() ?? null,
  }
}

export async function announcementRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/institutions/:institutionId/announcements',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'communication:read')

      const announcements = await prisma.announcement.findMany({
        where: { institutionId },
        include: { class: { select: { name: true } } },
        orderBy: { publishedAt: 'desc' },
        take: 100,
      })

      return announcements.map(toAnnouncementSummary)
    },
  )

  app.post(
    '/institutions/:institutionId/announcements',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'communication:manage')

      const input = parseInput(createAnnouncementSchema, request.body)

      if (input.classId) {
        const schoolClass = await prisma.schoolClass.findFirst({
          where: { id: input.classId, institutionId },
          select: { id: true },
        })
        if (!schoolClass) throw invalid('A turma informada não pertence a esta instituição.')
      }

      const announcement = await prisma.announcement.create({
        data: {
          institutionId,
          title: input.title,
          body: input.body,
          audience: input.audience,
          classId: input.classId ?? null,
          expiresAt: toDate(input.expiresAt),
          createdById: auth.user.id,
        },
        include: { class: { select: { name: true } } },
      })

      await recordAudit({
        actorId: auth.user.id,
        institutionId,
        action: 'ANNOUNCEMENT_CREATE',
        entity: 'Announcement',
        entityId: announcement.id,
        metadata: { audience: announcement.audience },
        ip: request.ip,
      })

      return reply.code(201).send(toAnnouncementSummary(announcement))
    },
  )

  app.patch(
    '/institutions/:institutionId/announcements/:announcementId',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId, announcementId } = request.params as {
        institutionId: string
        announcementId: string
      }
      assertInstitutionAccess(auth, institutionId, 'communication:manage')

      const existing = await prisma.announcement.findFirst({
        where: { id: announcementId, institutionId },
        select: { id: true },
      })
      if (!existing) throw notFound('Comunicado não encontrado.')

      const input = parseInput(updateAnnouncementSchema, request.body)

      const announcement = await prisma.announcement.update({
        where: { id: announcementId },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.body !== undefined ? { body: input.body } : {}),
          ...(input.audience !== undefined ? { audience: input.audience } : {}),
          ...(input.classId !== undefined ? { classId: input.classId ?? null } : {}),
          ...(input.expiresAt !== undefined ? { expiresAt: toDate(input.expiresAt) } : {}),
        },
        include: { class: { select: { name: true } } },
      })

      await recordAudit({
        actorId: auth.user.id,
        institutionId,
        action: 'ANNOUNCEMENT_UPDATE',
        entity: 'Announcement',
        entityId: announcementId,
        metadata: { fields: Object.keys(input) },
        ip: request.ip,
      })

      return toAnnouncementSummary(announcement)
    },
  )
}
