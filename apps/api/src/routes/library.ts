import type { FastifyInstance } from 'fastify'
import type { LibraryItemSummary } from '@vivass/shared'
import { createLibraryItemSchema, updateLibraryItemSchema } from '@vivass/shared'
import { prisma } from '../db.js'
import { invalid, notFound } from '../lib/errors.js'
import { parseInput } from '../lib/validate.js'
import { recordAudit } from '../lib/audit.js'
import { assertInstitutionAccess, requireAuth } from '../lib/tenancy.js'

function toLibrarySummary(item: {
  id: string
  title: string
  description: string | null
  category: string
  kind: string
  url: string | null
  content: string | null
  audience: string
  createdAt: Date
}): LibraryItemSummary {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    category: item.category as LibraryItemSummary['category'],
    kind: item.kind as LibraryItemSummary['kind'],
    url: item.url,
    content: item.content,
    audience: item.audience as LibraryItemSummary['audience'],
    createdAt: item.createdAt.toISOString(),
  }
}

function assertPayload(kind: string, url?: string | null, content?: string | null): void {
  if (kind === 'LINK' && !url) throw invalid('Informe a URL do link.')
  if (kind === 'TEXT' && !content) throw invalid('Informe o conteúdo do texto.')
  if (kind === 'FILE' && !url) throw invalid('Informe a URL do arquivo.')
}

export async function libraryRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/institutions/:institutionId/library',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'library:read')

      const items = await prisma.libraryItem.findMany({
        where: { institutionId },
        orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
        take: 200,
      })

      return items.map(toLibrarySummary)
    },
  )

  app.post(
    '/institutions/:institutionId/library',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = requireAuth(request)
      const { institutionId } = request.params as { institutionId: string }
      assertInstitutionAccess(auth, institutionId, 'library:manage')

      const input = parseInput(createLibraryItemSchema, request.body)
      assertPayload(input.kind, input.url, input.content)

      const item = await prisma.libraryItem.create({
        data: {
          institutionId,
          title: input.title,
          description: input.description ?? null,
          category: input.category,
          kind: input.kind,
          url: input.url ?? null,
          content: input.content ?? null,
          audience: input.audience,
          createdById: auth.user.id,
        },
      })

      await recordAudit({
        actorId: auth.user.id,
        institutionId,
        action: 'LIBRARY_CREATE',
        entity: 'LibraryItem',
        entityId: item.id,
        metadata: { category: item.category, kind: item.kind },
        ip: request.ip,
      })

      return reply.code(201).send(toLibrarySummary(item))
    },
  )

  app.patch(
    '/institutions/:institutionId/library/:itemId',
    { preHandler: app.authenticate },
    async (request) => {
      const auth = requireAuth(request)
      const { institutionId, itemId } = request.params as {
        institutionId: string
        itemId: string
      }
      assertInstitutionAccess(auth, institutionId, 'library:manage')

      const existing = await prisma.libraryItem.findFirst({
        where: { id: itemId, institutionId },
      })
      if (!existing) throw notFound('Item da biblioteca não encontrado.')

      const input = parseInput(updateLibraryItemSchema, request.body)
      assertPayload(
        input.kind ?? existing.kind,
        input.url !== undefined ? input.url : existing.url,
        input.content !== undefined ? input.content : existing.content,
      )

      const item = await prisma.libraryItem.update({
        where: { id: itemId },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.kind !== undefined ? { kind: input.kind } : {}),
          ...(input.url !== undefined ? { url: input.url } : {}),
          ...(input.content !== undefined ? { content: input.content } : {}),
          ...(input.audience !== undefined ? { audience: input.audience } : {}),
        },
      })

      await recordAudit({
        actorId: auth.user.id,
        institutionId,
        action: 'LIBRARY_UPDATE',
        entity: 'LibraryItem',
        entityId: itemId,
        metadata: { fields: Object.keys(input) },
        ip: request.ip,
      })

      return toLibrarySummary(item)
    },
  )
}
