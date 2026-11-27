#!/usr/bin/env node
/**
 * Garante que os dois schemas do Prisma continuam idênticos.
 *
 * Existem dois arquivos porque o Prisma não aceita `provider` dinâmico via env():
 *   - apps/api/prisma/schema.prisma            → SQLite  (dev e testes, sem infraestrutura)
 *   - apps/api/prisma-postgres/schema.prisma   → Postgres (produção: Supabase)
 *
 * Só o bloco `datasource` e o `generator` podem divergir. Qualquer diferença em model,
 * enum ou campo é erro: a duplicação é uma dívida aceita, o drift silencioso não.
 */
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const sqlitePath = path.join(root, 'apps', 'api', 'prisma', 'schema.prisma')
const postgresPath = path.join(root, 'apps', 'api', 'prisma-postgres', 'schema.prisma')

function normalize(file) {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/\/\/.*$/gm, '')
    .replace(/datasource\s+db\s*\{[^}]*\}/g, '')
    .replace(/generator\s+client\s*\{[^}]*\}/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}

for (const file of [sqlitePath, postgresPath]) {
  if (!fs.existsSync(file)) {
    console.error(`Arquivo não encontrado: ${file}`)
    process.exit(1)
  }
}

const a = normalize(sqlitePath)
const b = normalize(postgresPath)

if (a === b) {
  console.log('OK: os modelos de prisma/schema.prisma e prisma-postgres/schema.prisma são idênticos.')
  process.exit(0)
}

const la = a.split('\n')
const lb = b.split('\n')
let i = 0
while (i < la.length && i < lb.length && la[i] === lb[i]) i += 1

console.error('DIVERGENCIA entre os schemas (fora de datasource/generator):')
console.error(`  prisma/schema.prisma          linha ${i + 1}: ${la[i] ?? '<fim>'}`)
console.error(`  prisma-postgres/schema.prisma linha ${i + 1}: ${lb[i] ?? '<fim>'}`)
console.error('Os modelos precisam ser idênticos. Aplique a alteração nos dois arquivos.')
process.exit(1)
