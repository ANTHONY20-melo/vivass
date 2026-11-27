/**
 * Adaptador Vercel para a VIVASS API.
 *
 * A API é um servidor Fastify de vida longa; na Vercel cada requisição é uma
 * invocação de função. Aqui reaproveitamos uma única instância do Fastify por
 * container (o `buildApp` valida env, registra CORS/helmet/cookie/rate-limit e
 * as rotas sob o prefixo `/api`) e entregamos o socket do Node a ela — que é o
 * mesmo caminho de código usado por `server.ts` em produção local.
 *
 * O catch-all `[...route]` faz qualquer `/api/*` cair nesta função.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { buildApp } from '../apps/api/dist/app.js'

type App = Awaited<ReturnType<typeof buildApp>>

let appPromise: Promise<App> | undefined

function getApp(): Promise<App> {
  appPromise ??= buildApp().then(async (app) => {
    await app.ready()
    return app
  })
  return appPromise
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const app = await getApp()
  app.server.emit('request', req, res)
}
