import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'

export class AppError extends Error {
  readonly statusCode: number
  readonly code: string
  readonly details?: unknown

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

export function invalid(message: string, details?: unknown): AppError {
  return new AppError(400, 'DADOS_INVALIDOS', message, details)
}

export function unauthorized(message = 'Sessão inválida ou expirada.'): AppError {
  return new AppError(401, 'NAO_AUTENTICADO', message)
}

export function forbidden(message = 'Você não tem permissão para esta ação.'): AppError {
  return new AppError(403, 'ACESSO_NEGADO', message)
}

export function notFound(message = 'Registro não encontrado.'): AppError {
  return new AppError(404, 'NAO_ENCONTRADO', message)
}

export function conflict(message: string, details?: unknown): AppError {
  return new AppError(409, 'CONFLITO', message, details)
}

export function errorHandler(
  error: FastifyError | AppError | ZodError,
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply {
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({
      error: { code: error.code, message: error.message, details: error.details },
    })
  }

  if (error instanceof ZodError) {
    return reply.code(400).send({
      error: {
        code: 'DADOS_INVALIDOS',
        message: 'Verifique os campos informados.',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    })
  }

  const statusCode = 'statusCode' in error ? error.statusCode ?? 500 : 500

  if (statusCode === 429) {
    return reply.code(429).send({
      error: {
        code: 'MUITAS_TENTATIVAS',
        message: 'Muitas tentativas em pouco tempo. Aguarde um instante e tente novamente.',
      },
    })
  }

  if (statusCode < 500) {
    return reply.code(statusCode).send({
      error: {
        code: 'REQUISICAO_INVALIDA',
        message: 'Requisição inválida.',
      },
    })
  }

  request.log.error({ err: error }, 'erro não tratado')
  return reply.code(500).send({
    error: {
      code: 'ERRO_INTERNO',
      message: 'Erro interno ao processar a solicitação. Tente novamente.',
    },
  })
}
