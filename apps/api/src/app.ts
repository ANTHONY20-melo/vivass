import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import { env } from './env.js'
import { errorHandler } from './lib/errors.js'
import { authPlugin } from './plugins/auth.js'
import { registerRoutes } from './routes/index.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const webDist = path.resolve(here, '../../web/dist')

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'test'
        ? false
        : {
            level: env.NODE_ENV === 'production' ? 'info' : 'debug',
            redact: ['req.headers.authorization', 'req.headers.cookie'],
          },
    trustProxy: true,
    bodyLimit: 1024 * 1024,
  })

  await app.register(helmet, {
    contentSecurityPolicy:
      env.NODE_ENV === 'production'
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:'],
              fontSrc: ["'self'", 'data:'],
              connectSrc: ["'self'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
    crossOriginEmbedderPolicy: false,
  })

  /**
   * CORS: o SPA pode rodar em outro host (Vercel) chamando esta API (Railway).
   * `WEB_ORIGIN` aceita uma lista separada por vírgula. `credentials: true` é
   * obrigatório para o cookie de refresh viajar entre origens.
   */
  await app.register(cors, {
    origin: env.WEB_ORIGIN.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
  })

  await app.register(cookie)
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
  })
  await app.register(authPlugin)

  app.setErrorHandler(errorHandler)

  await app.register(registerRoutes, { prefix: '/api' })

  if (env.NODE_ENV === 'production' && existsSync(webDist)) {
    await app.register(fastifyStatic, {
      root: webDist,
      wildcard: false,
      index: ['index.html'],
      maxAge: '1h',
    })

    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api')) {
        return reply.code(404).send({
          error: { code: 'NAO_ENCONTRADO', message: 'Rota não encontrada.' },
        })
      }
      return reply.sendFile('index.html')
    })
  }

  return app
}
