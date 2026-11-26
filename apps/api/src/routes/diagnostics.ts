import type { FastifyInstance } from 'fastify'
import type { DiagnosticResults, DiagnosticSummary } from '@vivass/shared'
import type { DiagnosticQuestion } from '@vivass/shared'
import {
  DIAGNOSTIC_QUESTIONS,
  VIVASS_AXES,
  createDiagnosticSchema,
  submitDiagnosticSchema,
} from '@vivass/shared'
import { prisma } from '../db.js'
import { invalid, notFound } from '../lib/errors.js'
import { parseInput } from '../lib/validate.js'
import { recordAudit } from '../lib/audit.js'
import { assertInstitutionAccess, requireAuth } from '../lib/tenancy.js'

const QUESTION_MAP = new Map<string, DiagnosticQuestion>(
  DIAGNOSTIC_QUESTIONS.map((question) => [question.key, question]),
)

export async function diagnosticRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/institutions/:institutionId/diagnostics',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'diagnostic:read')

      const diagnostics = await prisma.diagnostic.findMany({
        where: { institutionId },
        include: { _count: { select: { answers: true } } },
        orderBy: { createdAt: 'desc' },
      })

      const result: DiagnosticSummary[] = diagnostics.map((diagnostic) => ({
        id: diagnostic.id,
        title: diagnostic.title,
        description: diagnostic.description,
        status: diagnostic.status as DiagnosticSummary['status'],
        responses: diagnostic._count.answers,
        createdAt: diagnostic.createdAt.toISOString(),
      }))
      return result
    },
  )

  app.post(
    '/institutions/:institutionId/diagnostics',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'diagnostic:manage')

      const input = parseInput(createDiagnosticSchema, request.body)

      const diagnostic = await prisma.diagnostic.create({
        data: {
          institutionId,
          title: input.title,
          description: input.description ?? null,
          createdById: auth.user.id,
        },
        include: { _count: { select: { answers: true } } },
      })

      await recordAudit({
        actorId: auth.user.id,
        institutionId,
        action: 'DIAGNOSTIC_CREATE',
        entity: 'Diagnostic',
        entityId: diagnostic.id,
        metadata: { title: diagnostic.title },
        ip: request.ip,
      })

      const summary: DiagnosticSummary = {
        id: diagnostic.id,
        title: diagnostic.title,
        description: diagnostic.description,
        status: diagnostic.status as DiagnosticSummary['status'],
        responses: 0,
        createdAt: diagnostic.createdAt.toISOString(),
      }
      return reply.code(201).send(summary)
    },
  )

  /** Resposta anônima: não grava autor, turma nem estudante. */
  app.post(
    '/institutions/:institutionId/diagnostics/:diagnosticId/answers',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = requireAuth(request)
      const { institutionId, diagnosticId } = request.params as {
        institutionId: string
        diagnosticId: string
      }
      assertInstitutionAccess(auth, institutionId, 'diagnostic:read')

      const diagnostic = await prisma.diagnostic.findFirst({
        where: { id: diagnosticId, institutionId },
        select: { id: true, status: true },
      })
      if (!diagnostic) throw notFound('Diagnóstico não encontrado.')
      if (diagnostic.status !== 'OPEN') {
        throw invalid('Este diagnóstico está encerrado e não recebe novas respostas.')
      }

      const { answers } = parseInput(submitDiagnosticSchema, request.body)
      const seen = new Set<string>()
      const rows: Array<{
        diagnosticId: string
        institutionId: string
        axis: string
        dimension: string
        questionKey: string
        value: number
      }> = []

      for (const answer of answers) {
        const question = QUESTION_MAP.get(answer.questionKey)
        if (!question) throw invalid(`Questão desconhecida: ${answer.questionKey}.`)
        if (seen.has(answer.questionKey)) continue
        seen.add(answer.questionKey)
        rows.push({
          diagnosticId,
          institutionId,
          axis: question.axis,
          dimension: question.dimension,
          questionKey: question.key,
          value: answer.value,
        })
      }

      await prisma.diagnosticAnswer.createMany({ data: rows })

      // Sem ator e sem valores: a auditoria não pode reconstruir uma resposta individual.
      await recordAudit({
        action: 'DIAGNOSTIC_SUBMIT',
        institutionId,
        entity: 'Diagnostic',
        entityId: diagnosticId,
        metadata: { answers: rows.length },
        ip: request.ip,
      })

      return reply.code(201).send({ recorded: rows.length })
    },
  )

  app.get(
    '/institutions/:institutionId/diagnostics/:diagnosticId/results',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId, diagnosticId } = request.params as {
        institutionId: string
        diagnosticId: string
      }
      assertInstitutionAccess(auth, institutionId, 'diagnostic:read')

      const diagnostic = await prisma.diagnostic.findFirst({
        where: { id: diagnosticId, institutionId },
        include: { _count: { select: { answers: true } } },
      })
      if (!diagnostic) throw notFound('Diagnóstico não encontrado.')

      const [byAxis, byDimension, distribution] = await Promise.all([
        prisma.diagnosticAnswer.groupBy({
          by: ['axis'],
          where: { diagnosticId },
          _avg: { value: true },
          _count: { _all: true },
        }),
        prisma.diagnosticAnswer.groupBy({
          by: ['dimension'],
          where: { diagnosticId },
          _avg: { value: true },
          _count: { _all: true },
        }),
        prisma.diagnosticAnswer.groupBy({
          by: ['value'],
          where: { diagnosticId },
          _count: { _all: true },
        }),
      ])

      const axisMap = new Map(byAxis.map((row) => [row.axis, row]))
      const dimensionMap = new Map(byDimension.map((row) => [row.dimension, row]))
      const valueMap = new Map(distribution.map((row) => [row.value, row._count._all]))

      const results: DiagnosticResults = {
        diagnostic: {
          id: diagnostic.id,
          title: diagnostic.title,
          description: diagnostic.description,
          status: diagnostic.status as DiagnosticSummary['status'],
          responses: diagnostic._count.answers,
          createdAt: diagnostic.createdAt.toISOString(),
        },
        totalAnswers: diagnostic._count.answers,
        byAxis: VIVASS_AXES.map((axis) => {
          const row = axisMap.get(axis)
          return {
            axis,
            average: row?._avg.value ? Math.round(row._avg.value * 10) / 10 : 0,
            answers: row?._count._all ?? 0,
          }
        }),
        byDimension: (['BIO', 'PSICO', 'SOCIAL', 'AMBIENTAL'] as const).map((dimension) => {
          const row = dimensionMap.get(dimension)
          return {
            dimension,
            average: row?._avg.value ? Math.round(row._avg.value * 10) / 10 : 0,
            answers: row?._count._all ?? 0,
          }
        }),
        distribution: [1, 2, 3, 4, 5].map((value) => ({
          value,
          count: valueMap.get(value) ?? 0,
        })),
      }

      return results
    },
  )

  app.patch(
    '/institutions/:institutionId/diagnostics/:diagnosticId/close',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId, diagnosticId } = request.params as {
        institutionId: string
        diagnosticId: string
      }
      assertInstitutionAccess(auth, institutionId, 'diagnostic:manage')

      const diagnostic = await prisma.diagnostic.findFirst({
        where: { id: diagnosticId, institutionId },
        select: { id: true },
      })
      if (!diagnostic) throw notFound('Diagnóstico não encontrado.')

      const updated = await prisma.diagnostic.update({
        where: { id: diagnosticId },
        data: { status: 'CLOSED' },
        include: { _count: { select: { answers: true } } },
      })

      await recordAudit({
        actorId: auth.user.id,
        institutionId,
        action: 'DIAGNOSTIC_CLOSE',
        entity: 'Diagnostic',
        entityId: diagnosticId,
        ip: request.ip,
      })

      const summary: DiagnosticSummary = {
        id: updated.id,
        title: updated.title,
        description: updated.description,
        status: updated.status as DiagnosticSummary['status'],
        responses: updated._count.answers,
        createdAt: updated.createdAt.toISOString(),
      }
      return summary
    },
  )
}
