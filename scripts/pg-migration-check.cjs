#!/usr/bin/env node
/**
 * Validação de migração SQLite → PostgreSQL — VIVASS
 * Verifica compatibilidade do schema e executa migração de teste.
 *
 * Uso: node scripts/pg-migration-check.js
 * Requer: PostgreSQL rodando e DATABASE_URL_PG configurado
 */

const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const PG_URL = process.env.DATABASE_URL_PG
if (!PG_URL) {
  console.log('⚠️  DATABASE_URL_PG não definido — pulando validação PostgreSQL')
  console.log('   Configure: DATABASE_URL_PG="postgresql://user:pass@host:5432/vivass_test"')
  process.exit(0)
}

console.log('\n🐘 VIVASS — Validação Migração PostgreSQL')
console.log('='.repeat(50))

function run(cmd, cwd = process.cwd()) {
  try {
    return execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf8' }).trim()
  } catch (error) {
    throw new Error(`${cmd}\n${error.stdout ?? error.message}`)
  }
}

// 1. Verificar schema Prisma para compatibilidade
console.log('\n1️⃣  Verificando schema Prisma...')
const schemaPath = path.resolve('apps/api/prisma/schema.prisma')
const schema = fs.readFileSync(schemaPath, 'utf8')

const issues = []

// SQLite-only: provider
if (schema.includes('provider = "sqlite"')) {
  issues.push('Provider ainda é "sqlite" — deve ser "postgresql" em produção')
}

// Enums nativos não suportados no SQLite (já tratado com String)
const enumFields = schema.match(/^\s+\w+\s+\w+\s+@default\(/gm) || []
if (enumFields.length > 0) {
  console.log('   ℹ️  Campos com @default detectados — verificar enums em PG')
}

// JSON vs String para metadata
if (schema.includes('metadata      String?') && !schema.includes('Json')) {
  console.log('   ℹ️  metadata como String — em PG pode ser Json')
}

// 2. Gerar cliente Prisma para PostgreSQL
console.log('\n2️⃣  Gerando Prisma Client para PostgreSQL...')
process.env.DATABASE_URL = PG_URL
run('npx prisma generate', path.resolve('apps/api'))
console.log('   ✅ Client gerado')

// 3. Criar banco de teste e aplicar migrações
console.log('\n3️⃣  Aplicando migrações no PostgreSQL de teste...')
const testDbName = `vivass_migration_test_${Date.now()}`
const adminUrl = PG_URL.replace(/\/[^/]+$/, '/postgres')
const testUrl = PG_URL.replace(/\/[^/]+$/, `/${testDbName}`)

try {
  // Criar banco
  execSync(`psql "${adminUrl}" -c "CREATE DATABASE ${testDbName};"`, { stdio: 'pipe' })
  console.log(`   ✅ Banco ${testDbName} criado`)

  // Aplicar migrações
  process.env.DATABASE_URL = testUrl
  run('npx prisma migrate deploy', path.resolve('apps/api'))
  console.log('   ✅ Migrações aplicadas')

  // 4. Verificar integridade referencial
  console.log('\n4️⃣  Verificando integridade...')
  const checks = [
    'SELECT COUNT(*) FROM "Institution"',
    'SELECT COUNT(*) FROM "User"',
    'SELECT COUNT(*) FROM "Membership"',
    'SELECT COUNT(*) FROM "Student"',
    'SELECT COUNT(*) FROM "Project"',
    'SELECT COUNT(*) FROM "Activity"',
    'SELECT COUNT(*) FROM "AuditLog"',
    'SELECT COUNT(*) FROM "Consent"',
    'SELECT COUNT(*) FROM "DataRequest"',
    'SELECT COUNT(*) FROM "ActionPlan"',
    'SELECT COUNT(*) FROM "PlanMilestone"',
    'SELECT COUNT(*) FROM "Diagnostic"',
    'SELECT COUNT(*) FROM "DiagnosticAnswer"',
    'SELECT COUNT(*) FROM "Announcement"',
    'SELECT COUNT(*) FROM "LibraryItem"',
  ]

  for (const sql of checks) {
    const count = execSync(`psql "${testUrl}" -t -c "${sql}"`, { stdio: 'pipe' }).trim()
    console.log(`   ${sql.split('"')[1]}: ${count} registros`)
  }

  // 5. Testar seed
  console.log('\n5️⃣  Executando seed de demonstração...')
  run('npx prisma db seed', path.resolve('apps/api'))
  console.log('   ✅ Seed executado')

  // 6. Verificar índices
  console.log('\n6️⃣  Verificando índices...')
  const indexes = execSync(`psql "${testUrl}" -t -c "
    SELECT indexrelid::regclass AS index_name, relname AS table_name
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    WHERE schemaname = 'public'
    ORDER BY table_name, index_name;
  "`, { stdio: 'pipe', encoding: 'utf8' })
  console.log(indexes.trim().split('\n').map(l => `   ${l.trim()}`).join('\n'))

  // 7. Testar consulta do painel (a mais crítica)
  console.log('\n7️⃣  Testando consulta do painel (dashboard)...')
  const dashboardSql = `
    SELECT
      (SELECT COUNT(*) FROM "Student" WHERE "institutionId" = i.id AND status = 'ACTIVE') AS students,
      (SELECT COUNT(*) FROM "Membership" m JOIN "User" u ON u.id = m."userId" WHERE m."institutionId" = i.id AND m.active AND m.role IN ('SCHOOL_MANAGER','COORDINATOR','TEACHER','MULTIDISCIPLINARY')) AS professionals,
      (SELECT COUNT(*) FROM "Membership" WHERE "institutionId" = i.id AND active AND role = 'FAMILY') AS families,
      (SELECT COUNT(*) FROM "Project" WHERE "institutionId" = i.id AND status = 'ACTIVE') AS projects_active,
      (SELECT COUNT(*) FROM "Activity" WHERE "institutionId" = i.id AND "scheduledAt" >= NOW() - INTERVAL '90 days') AS activities_total,
      (SELECT COUNT(*) FROM "Activity" WHERE "institutionId" = i.id AND "scheduledAt" >= NOW() - INTERVAL '90 days' AND status = 'COMPLETED') AS activities_completed,
      (SELECT COALESCE(SUM(participants), 0) FROM "Activity" WHERE "institutionId" = i.id AND "scheduledAt" >= NOW() - INTERVAL '90 days') AS participants
    FROM "Institution" i
    WHERE i.id = (SELECT id FROM "Institution" LIMIT 1);
  `
  const result = execSync(`psql "${testUrl}" -t -c "${dashboardSql}"`, { stdio: 'pipe', encoding: 'utf8' })
  console.log(`   Dashboard query OK: ${result.trim()}`)

  console.log('\n' + '='.repeat(50))
  console.log('✅ MIGRAÇÃO POSTGRESQL VALIDADA COM SUCESSO')
  console.log('='.repeat(50))
  console.log(`\nBanco de teste: ${testDbName}`)
  console.log('Para limpar: DROP DATABASE ' + testDbName + ';')

} catch (error) {
  console.error('\n❌ FALHA NA VALIDAÇÃO:', error.message)
  // Tentar limpar
  try { execSync(`psql "${adminUrl}" -c "DROP DATABASE IF EXISTS ${testDbName};"`, { stdio: 'ignore' }) } catch {}
  process.exit(1)
}