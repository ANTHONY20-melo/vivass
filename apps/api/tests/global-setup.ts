import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import path from 'node:path'

/**
 * Banco de teste isolado: recriado a cada execução. Nunca toca no dev.db.
 *
 * O `db push` roda SEM `--skip-generate` de propósito: `npm run db:generate:prod`
 * regrava o client em node_modules a partir do schema PostgreSQL, e sem regenerar
 * aqui a suíte herdaria um client apontando para Postgres contra um arquivo SQLite.
 */
export default function globalSetup(): void {
  const dbPath = path.resolve('prisma/test.db')
  rmSync(dbPath, { force: true })
  rmSync(`${dbPath}-journal`, { force: true })

  execSync('npx prisma db push', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  })
}
