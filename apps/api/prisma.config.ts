import 'dotenv/config'
import { defineConfig } from 'prisma/config'

/**
 * Configuração do Prisma 6 (formato que substitui `package.json#prisma`).
 * O `dotenv/config` é necessário porque, com este arquivo, o Prisma deixa de
 * carregar `.env` automaticamente.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
})
