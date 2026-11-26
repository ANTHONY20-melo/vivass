import { PrismaClient } from '@prisma/client'

/**
 * Instância única do Prisma. Em desenvolvimento o módulo é recarregado pelo tsx watch;
 * guardar no globalThis evita abrir uma conexão nova a cada alteração.
 */
const globalForPrisma = globalThis as unknown as { vivassPrisma?: PrismaClient }

export const prisma =
  globalForPrisma.vivassPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.vivassPrisma = prisma
}
