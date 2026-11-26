import type { FastifyInstance } from 'fastify'
import type { Prisma } from '@prisma/client'
import type {
  ConsentSummary,
  ImportStudentsResult,
  Paginated,
  StudentSummary,
} from '@vivass/shared'
import {
  CONSENT_TYPES,
  createConsentSchema,
  createStudentSchema,
  importStudentsSchema,
  studentQuerySchema,
  updateStudentSchema,
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

function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

function toConsentSummary(consent: {
  id: string
  type: string
  grantedBy: string
  grantedAt: Date
  expiresAt: Date | null
  revokedAt: Date | null
  documentVersion: string
}): ConsentSummary {
  return {
    id: consent.id,
    type: consent.type as ConsentSummary['type'],
    grantedBy: consent.grantedBy,
    grantedAt: consent.grantedAt.toISOString(),
    expiresAt: consent.expiresAt?.toISOString() ?? null,
    revokedAt: consent.revokedAt?.toISOString() ?? null,
    documentVersion: consent.documentVersion,
  }
}

type StudentRow = Prisma.StudentGetPayload<{
  include: {
    class: { select: { name: true } }
    consents: true
  }
}>

function toStudentSummary(student: StudentRow): StudentSummary {
  return {
    id: student.id,
    name: student.name,
    birthDate: student.birthDate?.toISOString() ?? null,
    guardianName: student.guardianName,
    guardianPhone: student.guardianPhone,
    guardianEmail: student.guardianEmail,
    notes: student.notes,
    status: student.status as StudentSummary['status'],
    classId: student.classId,
    className: student.class?.name ?? null,
    createdAt: student.createdAt.toISOString(),
    consents: student.consents
      .slice()
      .sort((a, b) => b.grantedAt.getTime() - a.grantedAt.getTime())
      .map(toConsentSummary),
  }
}

async function assertClass(institutionId: string, classId: string): Promise<void> {
  const found = await prisma.schoolClass.findFirst({
    where: { id: classId, institutionId },
    select: { id: true },
  })
  if (!found) throw invalid('A turma informada não pertence a esta instituição.')
}

export async function studentRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/institutions/:institutionId/students',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'student:read')

      const query = parseInput(studentQuerySchema, request.query)
      const where: Prisma.StudentWhereInput = { institutionId }

      if (query.status) where.status = query.status
      if (query.classId) where.classId = query.classId
      if (query.search) {
        where.OR = [
          { name: { contains: query.search } },
          { guardianName: { contains: query.search } },
        ]
      }

      const [total, rows] = await Promise.all([
        prisma.student.count({ where }),
        prisma.student.findMany({
          where,
          include: { class: { select: { name: true } }, consents: true },
          orderBy: { name: 'asc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ])

      const result: Paginated<StudentSummary> = {
        items: rows.map(toStudentSummary),
        total,
        page: query.page,
        pageSize: query.pageSize,
      }
      return result
    },
  )

  app.get(
    '/institutions/:institutionId/students/:studentId',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId, studentId } = request.params as {
        institutionId: string
        studentId: string
      }
      assertInstitutionAccess(auth, institutionId, 'student:read')

      const student = await prisma.student.findFirst({
        where: { id: studentId, institutionId },
        include: { class: { select: { name: true } }, consents: true },
      })
      if (!student) throw notFound('Estudante não encontrado.')
      return toStudentSummary(student)
    },
  )

  app.post(
    '/institutions/:institutionId/students',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'student:manage')

      const input = parseInput(createStudentSchema, request.body)
      if (input.classId) await assertClass(institutionId, input.classId)

      const student = await prisma.student.create({
        data: {
          institutionId,
          name: input.name,
          birthDate: toDate(input.birthDate),
          guardianName: emptyToNull(input.guardianName),
          guardianPhone: emptyToNull(input.guardianPhone),
          guardianEmail: emptyToNull(input.guardianEmail),
          notes: emptyToNull(input.notes),
          classId: input.classId ?? null,
        },
        include: { class: { select: { name: true } }, consents: true },
      })

      await recordAudit({
        actorId: auth.user.id,
        institutionId,
        action: 'STUDENT_CREATE',
        entity: 'Student',
        entityId: student.id,
        metadata: { name: student.name, classId: student.classId },
        ip: request.ip,
      })

      return reply.code(201).send(toStudentSummary(student))
    },
  )

  app.patch(
    '/institutions/:institutionId/students/:studentId',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId, studentId } = request.params as {
        institutionId: string
        studentId: string
      }
      assertInstitutionAccess(auth, institutionId, 'student:manage')

      const existing = await prisma.student.findFirst({
        where: { id: studentId, institutionId },
        select: { id: true },
      })
      if (!existing) throw notFound('Estudante não encontrado.')

      const input = parseInput(updateStudentSchema, request.body)
      if (input.classId) await assertClass(institutionId, input.classId)

      const data: Prisma.StudentUpdateInput = {}
      if (input.name !== undefined) data.name = input.name
      if (input.birthDate !== undefined) data.birthDate = toDate(input.birthDate)
      if (input.guardianName !== undefined) data.guardianName = emptyToNull(input.guardianName)
      if (input.guardianPhone !== undefined) data.guardianPhone = emptyToNull(input.guardianPhone)
      if (input.guardianEmail !== undefined) data.guardianEmail = emptyToNull(input.guardianEmail)
      if (input.notes !== undefined) data.notes = emptyToNull(input.notes)
      if (input.status !== undefined) data.status = input.status
      if (input.classId !== undefined) {
        data.class = input.classId ? { connect: { id: input.classId } } : { disconnect: true }
      }

      const student = await prisma.student.update({
        where: { id: studentId },
        data,
        include: { class: { select: { name: true } }, consents: true },
      })

      await recordAudit({
        actorId: auth.user.id,
        institutionId,
        action: 'STUDENT_UPDATE',
        entity: 'Student',
        entityId: student.id,
        metadata: { fields: Object.keys(input) },
        ip: request.ip,
      })

      return toStudentSummary(student)
    },
  )

  /** Exclusão lógica: o histórico pedagógico não pode desaparecer sem rastro. */
  app.delete(
    '/institutions/:institutionId/students/:studentId',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId, studentId } = request.params as {
        institutionId: string
        studentId: string
      }
      assertInstitutionAccess(auth, institutionId, 'student:manage')

      const existing = await prisma.student.findFirst({
        where: { id: studentId, institutionId },
        select: { id: true },
      })
      if (!existing) throw notFound('Estudante não encontrado.')

      const student = await prisma.student.update({
        where: { id: studentId },
        data: { status: 'INACTIVE' },
        include: { class: { select: { name: true } }, consents: true },
      })

      await recordAudit({
        actorId: auth.user.id,
        institutionId,
        action: 'STUDENT_DEACTIVATE',
        entity: 'Student',
        entityId: student.id,
        ip: request.ip,
      })

      return toStudentSummary(student)
    },
  )

  app.post(
    '/institutions/:institutionId/students/import',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'student:manage')

      const { csv } = parseInput(importStudentsSchema, request.body)
      const lines = csv
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)

      const result: ImportStudentsResult = { created: 0, skipped: 0, errors: [] }
      if (lines.length === 0) throw invalid('O arquivo CSV está vazio.')

      const classes = await prisma.schoolClass.findMany({
        where: { institutionId },
        select: { id: true, name: true },
      })

      const startIndex =
        lines[0] && /^nome\b/i.test(lines[0]) ? 1 : 0

      for (let index = startIndex; index < lines.length; index += 1) {
        const line = lines[index]!
        const lineNumber = index + 1
        if (line.length > 400) {
          result.skipped += 1
          result.errors.push({ line: lineNumber, message: 'Linha longa demais.' })
          continue
        }

        const [name, birth, guardian, phone, className] = line
          .split(';')
          .map((part) => part.trim())

        const parsed = createStudentSchema.safeParse({
          name,
          birthDate: birth || null,
          guardianName: guardian || null,
          guardianPhone: phone || null,
          classId: null,
        })

        if (!parsed.success) {
          result.skipped += 1
          result.errors.push({
            line: lineNumber,
            message: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
          })
          continue
        }

        const matchedClass = className
          ? classes.find(
              (item) => item.name.toLowerCase() === className.toLowerCase(),
            )
          : undefined

        await prisma.student.create({
          data: {
            institutionId,
            name: parsed.data.name,
            birthDate: toDate(parsed.data.birthDate),
            guardianName: emptyToNull(parsed.data.guardianName),
            guardianPhone: emptyToNull(parsed.data.guardianPhone),
            classId: matchedClass?.id ?? null,
          },
        })
        result.created += 1
      }

      await recordAudit({
        actorId: auth.user.id,
        institutionId,
        action: 'STUDENT_IMPORT',
        entity: 'Student',
        metadata: { created: result.created, skipped: result.skipped },
        ip: request.ip,
      })

      return result
    },
  )

  app.post(
    '/institutions/:institutionId/students/:studentId/consents',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = requireAuth(request)
      const { institutionId, studentId } = request.params as {
        institutionId: string
        studentId: string
      }
      assertInstitutionAccess(auth, institutionId, 'student:manage')

      const student = await prisma.student.findFirst({
        where: { id: studentId, institutionId },
        select: { id: true },
      })
      if (!student) throw notFound('Estudante não encontrado.')

      const input = parseInput(createConsentSchema, request.body)
      if (!CONSENT_TYPES.includes(input.type)) throw invalid('Tipo de consentimento inválido.')

      const consent = await prisma.consent.create({
        data: {
          institutionId,
          studentId,
          type: input.type,
          grantedBy: input.grantedBy,
          expiresAt: toDate(input.expiresAt),
          documentVersion: input.documentVersion ?? '1.0',
        },
      })

      await recordAudit({
        actorId: auth.user.id,
        institutionId,
        action: 'CONSENT_CREATE',
        entity: 'Consent',
        entityId: consent.id,
        metadata: { studentId, type: input.type },
        ip: request.ip,
      })

      return reply.code(201).send(toConsentSummary(consent))
    },
  )

  app.post(
    '/institutions/:institutionId/students/:studentId/consents/:consentId/revoke',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId, studentId, consentId } = request.params as {
        institutionId: string
        studentId: string
        consentId: string
      }
      assertInstitutionAccess(auth, institutionId, 'student:manage')

      const consent = await prisma.consent.findFirst({
        where: { id: consentId, studentId, institutionId },
      })
      if (!consent) throw notFound('Consentimento não encontrado.')

      const revoked = await prisma.consent.update({
        where: { id: consentId },
        data: { revokedAt: new Date() },
      })

      await recordAudit({
        actorId: auth.user.id,
        institutionId,
        action: 'CONSENT_REVOKE',
        entity: 'Consent',
        entityId: consentId,
        metadata: { studentId, type: consent.type },
        ip: request.ip,
      })

      return toConsentSummary(revoked)
    },
  )
}
