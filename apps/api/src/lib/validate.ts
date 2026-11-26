import type { ZodType } from 'zod'
import { invalid } from './errors.js'

/** Valida entrada com Zod e devolve dados já normalizados, ou 400 com detalhes por campo. */
export function parseInput<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw invalid(
      'Verifique os campos informados.',
      result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    )
  }
  return result.data
}
