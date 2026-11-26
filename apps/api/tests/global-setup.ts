import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import path from 'node:path'

/**
 * Banco de teste isolado: recriado a cada execução. Nunca toca no dev.db.
 */
export default function globalSetup(): void {
  const dbPath = path.resolve('prisma/test.db')
  rmSync(dbPath, { force: true })
  rmSync(`${dbPath}-journal`, { force: true })

  execSync('npx prisma db push --skip-generate', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  })
}
