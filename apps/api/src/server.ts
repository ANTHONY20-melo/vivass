import { buildApp } from './app.js'
import { env } from './env.js'
import { prisma } from './db.js'

const app = await buildApp()

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'encerrando o servidor')
  await app.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
  app.log.info(`VIVASS API em http://localhost:${env.PORT}`)
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
