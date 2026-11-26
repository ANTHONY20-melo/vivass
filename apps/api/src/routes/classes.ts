import type { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import type { ClassSummary } from '@vivass/shared'
import { createClassSchema, updateClassSchema } from '@vivass/shared'
import { prisma } from '../db.js'
import { conflict, notFound } from '../lib/errors.js'
import { parseInput } from '../lib/validate.js'
import { recordAudit } from '../lib/audit.js'
import { assertInstitutionAccess, requireAuth } from '../lib/tenancy.js'

export async function classRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/institutions/:institutionId/classes',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'student:read')

      const classes = await prisma.schoolClass.findMany({
        where: { institutionId },
        include: { _count: { select: { students: true } } },
        orderBy: [{ year: 'desc' }, { name: 'asc' }],
      })

      const result: ClassSummary[] = classes.map((item) => ({
        id: item.id,
        name: item.name,
        year: item.year,
        shift: item.shift as ClassSummary['shift'],
        students: item._count.students,
      }))
      return result
    },
  )

  app.post(
    '/institutions/:institutionId/classes',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'student:manage')

      const input = parseInput(createClassSchema, request.body)

      try {
        const created = await prisma.schoolClass.create({
          data: { institutionId, name: input.name, year: input.year, shift: input.shift },
          include: { _count: { select: { students: true } } },
        })

        await recordAudit({
          actorId: auth.user.id,
          institutionId,
          action: 'CLASS_CREATE',
          entity: 'SchoolClass',
          entityId: created.id,
          metadata: { name: created.name, year: created.year },
          ip: request.ip,
        })

        const summary: ClassSummary = {
          id: created.id,
          name: created.name,
          year: created.year,
          shift: created.shift as ClassSummary['shift'],
          students: created._count.students,
        }
        return reply.code(201).send(summary)
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw conflict('Já existe uma turma com este nome e ano nesta instituição.')
        }
        throw error
      }
    },
  )

  app.patch(
    '/institutions/:institutionId/classes/:classId',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId, classId } = request.params as {
        institutionId: string
        classId: string
      }
      assertInstitutionAccess(auth, institutionId, 'student:manage')

      const existing = await prisma.schoolClass.findFirst({
        where: { id: classId, institutionId },
        select: { id: true },
      })
      if (!existing) throw notFound('Turma não encontrada.')

      const input = parseInput(updateClassSchema, request.body)

      try {
        const updated = await prisma.schoolClass.update({
          where: { id: classId },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.year !== undefined ? { year: input.year } : {}),
            ...(input.shift !== undefined ? { shift: input.shift } : {}),
          },
          include: { _count: { select: { students: true } } },
        })

        await recordAudit({
          actorId: auth.user.id,
          institutionId,
          action: 'CLASS_UPDATE',
          entity: 'SchoolClass',
          entityId: classId,
          metadata: { fields: Object.keys(input) },
          ip: request.ip,
        })

        const summary: ClassSummary = {
          id: updated.id,
          name: updated.name,
          year: updated.year,
          shift: updated.shift as ClassSummary['shift'],
          students: updated._count.students,
        }
        return summary
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw conflict('Já existe uma turma com este nome e ano nesta instituição.')
        }
        throw error
      }
    },
  )
}
