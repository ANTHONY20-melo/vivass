import type { FastifyInstance } from 'fastify'
import type { InstitutionSummary, MemberSummary, MemberRole } from '@vivass/shared'
import {
  createInstitutionSchema,
  createMemberSchema,
  institutionKindSchema,
} from '@vivass/shared'
import { prisma } from '../db.js'
import { conflict, notFound } from '../lib/errors.js'
import { parseInput } from '../lib/validate.js'
import { recordAudit } from '../lib/audit.js'
import {
  assertInstitutionAccess,
  assertSuperadmin,
  requireAuth,
} from '../lib/tenancy.js'

function slugify(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return base || 'instituicao'
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name)
  let candidate = base
  let suffix = 2

  while (await prisma.institution.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }

  return candidate
}

function toMemberSummary(membership: {
  id: string
  role: string
  active: boolean
  user: { id: string; name: string; email: string; lastLoginAt: Date | null }
}): MemberSummary {
  return {
    membershipId: membership.id,
    userId: membership.user.id,
    name: membership.user.name,
    email: membership.user.email,
    role: membership.role as MemberRole,
    active: membership.active,
    lastLoginAt: membership.user.lastLoginAt?.toISOString() ?? null,
  }
}

export async function institutionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/institutions', { preHandler: app.authenticate }, async (request) => {
    const auth = requireAuth(request)

    const where =
      auth.user.platformRole === 'SUPERADMIN'
        ? {}
        : { id: { in: auth.memberships.map((membership) => membership.institutionId) } }

    const institutions = await prisma.institution.findMany({
      where,
      orderBy: { name: 'asc' },
    })

    if (institutions.length === 0) return []

    const ids = institutions.map((institution) => institution.id)

    const [members, students, projects] = await Promise.all([
      prisma.membership.groupBy({
        by: ['institutionId'],
        where: { institutionId: { in: ids }, active: true },
        _count: { _all: true },
      }),
      prisma.student.groupBy({
        by: ['institutionId'],
        where: { institutionId: { in: ids }, status: 'ACTIVE' },
        _count: { _all: true },
      }),
      prisma.project.groupBy({
        by: ['institutionId'],
        where: { institutionId: { in: ids } },
        _count: { _all: true },
      }),
    ])

    const memberMap = new Map(members.map((row) => [row.institutionId, row._count._all]))
    const studentMap = new Map(students.map((row) => [row.institutionId, row._count._all]))
    const projectMap = new Map(projects.map((row) => [row.institutionId, row._count._all]))

    const result: InstitutionSummary[] = institutions.map((institution) => ({
      id: institution.id,
      name: institution.name,
      slug: institution.slug,
      kind: institutionKindSchema.parse(institution.kind),
      city: institution.city,
      state: institution.state,
      status: institution.status,
      isDemo: institution.isDemo,
      createdAt: institution.createdAt.toISOString(),
      counts: {
        members: memberMap.get(institution.id) ?? 0,
        students: studentMap.get(institution.id) ?? 0,
        projects: projectMap.get(institution.id) ?? 0,
      },
    }))

    return result
  })

  app.post('/institutions', { preHandler: app.authenticate }, async (request, reply) => {
    const auth = requireAuth(request)
    assertSuperadmin(auth)

    const input = parseInput(createInstitutionSchema, request.body)

    const institution = await prisma.institution.create({
      data: {
        name: input.name,
        slug: await uniqueSlug(input.name),
        kind: input.kind,
        city: input.city,
        state: input.state,
        isDemo: input.isDemo,
      },
    })

    await recordAudit({
      actorId: auth.user.id,
      institutionId: institution.id,
      action: 'INSTITUTION_CREATE',
      entity: 'Institution',
      entityId: institution.id,
      metadata: { name: institution.name, kind: institution.kind },
      ip: request.ip,
    })

    const summary: InstitutionSummary = {
      id: institution.id,
      name: institution.name,
      slug: institution.slug,
      kind: input.kind,
      city: institution.city,
      state: institution.state,
      status: institution.status,
      isDemo: institution.isDemo,
      createdAt: institution.createdAt.toISOString(),
      counts: { members: 0, students: 0, projects: 0 },
    }

    return reply.code(201).send(summary)
  })

  app.get(
    '/institutions/:institutionId',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'institution:read')

      const institution = await prisma.institution.findUnique({
        where: { id: institutionId },
        include: {
          _count: {
            select: { memberships: true, students: true, projects: true },
          },
        },
      })

      if (!institution) throw notFound('Instituição não encontrada.')

      const summary: InstitutionSummary = {
        id: institution.id,
        name: institution.name,
        slug: institution.slug,
        kind: institutionKindSchema.parse(institution.kind),
        city: institution.city,
        state: institution.state,
        status: institution.status,
        isDemo: institution.isDemo,
        createdAt: institution.createdAt.toISOString(),
        counts: {
          members: institution._count.memberships,
          students: institution._count.students,
          projects: institution._count.projects,
        },
      }

      return summary
    },
  )

  app.get(
    '/institutions/:institutionId/members',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'user:read')

      const memberships = await prisma.membership.findMany({
        where: { institutionId },
        include: {
          user: {
            select: { id: true, name: true, email: true, lastLoginAt: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      })

      return memberships.map(toMemberSummary)
    },
  )

  app.post(
    '/institutions/:institutionId/members',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'user:manage')

      const input = parseInput(createMemberSchema, request.body)
      const existingUser = await prisma.user.findUnique({ where: { email: input.email } })

      if (existingUser) {
        const existingMembership = await prisma.membership.findUnique({
          where: {
            userId_institutionId: {
              userId: existingUser.id,
              institutionId,
            },
          },
        })
        if (existingMembership?.active) {
          throw conflict('Este e-mail já possui vínculo ativo com a instituição.')
        }
      }

      const { hashPassword } = await import('../auth/password.js')

      const membership = await prisma.$transaction(async (tx) => {
        const user =
          existingUser ??
          (await tx.user.create({
            data: {
              name: input.name,
              email: input.email,
              passwordHash: await hashPassword(input.password),
              platformRole: 'USER',
            },
          }))

        if (existingUser) {
          const inactive = await tx.membership.findUnique({
            where: { userId_institutionId: { userId: user.id, institutionId } },
          })
          if (inactive) {
            return tx.membership.update({
              where: { id: inactive.id },
              data: { role: input.role, active: true },
              include: {
                user: { select: { id: true, name: true, email: true, lastLoginAt: true } },
              },
            })
          }
        }

        return tx.membership.create({
          data: { userId: user.id, institutionId, role: input.role },
          include: {
            user: { select: { id: true, name: true, email: true, lastLoginAt: true } },
          },
        })
      })

      await recordAudit({
        actorId: auth.user.id,
        institutionId,
        action: 'MEMBER_CREATE',
        entity: 'Membership',
        entityId: membership.id,
        metadata: { role: input.role, email: input.email },
        ip: request.ip,
      })

      return reply.code(201).send(toMemberSummary(membership))
    },
  )
}
