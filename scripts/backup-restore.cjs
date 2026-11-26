#!/usr/bin/env node
/**
 * Backup e Restore — VIVASS (PostgreSQL)
 *
 * Uso:
 *   node scripts/backup-restore.js backup    # Cria backup
 *   node scripts/backup-restore.js restore <arquivo>  # Restaura backup
 *
 * Variáveis:
 *   DATABASE_URL_PG — URL do PostgreSQL de produção
 *   BACKUP_DIR — Diretório para backups (padrão: ./backups)
 */

const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const PG_URL = process.env.DATABASE_URL_PG
const BACKUP_DIR = process.env.BACKUP_DIR || path.resolve('backups')
const ACTION = process.argv[2]

if (!PG_URL) {
  console.error('❌ DATABASE_URL_PG não definido')
  process.exit(1)
}

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

function backup() {
  const file = path.join(BACKUP_DIR, `vivass-backup-${timestamp()}.dump`)
  console.log(`\n💾 Criando backup: ${file}`)

  try {
    execSync(`pg_dump "${PG_URL}" -Fc -Z9 -f "${file}"`, { stdio: 'inherit' })
    const stats = fs.statSync(file)
    console.log(`\n✅ Backup concluído: ${file} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`)

    // Manter apenas os últimos 30 backups
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('vivass-backup-') && f.endsWith('.dump'))
      .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtime }))
      .sort((a, b) => b.time - a.time)

    if (files.length > 30) {
      for (const f of files.slice(30)) {
        fs.unlinkSync(path.join(BACKUP_DIR, f.name))
        console.log(`🗑️  Removido backup antigo: ${f.name}`)
      }
    }

    return file
  } catch (error) {
    console.error('❌ Falha no backup:', error.message)
    process.exit(1)
  }
}

function restore(file) {
  const filePath = path.isAbsolute(file) ? file : path.join(BACKUP_DIR, file)

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Arquivo não encontrado: ${filePath}`)
    process.exit(1)
  }

  console.log(`\n🔄 Restaurando backup: ${filePath}`)
  console.log('⚠️  ATENÇÃO: Isso irá SUBSTITUIR todos os dados do banco de destino!')
  console.log('Pressione Ctrl+C para cancelar, ou Enter para confirmar...')

  // Aguardar confirmação (10s timeout)
  const readline = require('node:readline')
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  rl.question('', () => {
    rl.close()
    doRestore(filePath)
  })

  setTimeout(() => {
    rl.close()
    console.log('\n⏱️  Timeout — cancelado por segurança')
    process.exit(1)
  }, 10000)
}

function doRestore(filePath) {
  try {
    // Terminar conexões existentes
    const dbName = new URL(PG_URL).pathname.slice(1)
    const adminUrl = PG_URL.replace(/\/[^/]+$/, '/postgres')
    execSync(`psql "${adminUrl}" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${dbName}' AND pid <> pg_backend_pid();"`, { stdio: 'pipe' })

    // Dropar e recriar banco
    execSync(`psql "${adminUrl}" -c "DROP DATABASE IF EXISTS ${dbName};"`, { stdio: 'pipe' })
    execSync(`psql "${adminUrl}" -c "CREATE DATABASE ${dbName};"`, { stdio: 'pipe' })

    // Restaurar
    execSync(`pg_restore -d "${PG_URL}" -v "${filePath}"`, { stdio: 'inherit' })

    console.log('\n✅ Restore concluído com sucesso')
  } catch (error) {
    console.error('❌ Falha no restore:', error.message)
    process.exit(1)
  }
}

console.log('\n🐘 VIVASS — Backup/Restore PostgreSQL')
console.log('='.repeat(50))

switch (ACTION) {
  case 'backup':
    backup()
    break
  case 'restore':
    if (!process.argv[3]) {
      console.error('❌ Informe o arquivo de backup: node scripts/backup-restore.js restore <arquivo>')
      process.exit(1)
    }
    restore(process.argv[3])
    break
  default:
    console.log('Uso:')
    console.log('  node scripts/backup-restore.js backup')
    console.log('  node scripts/backup-restore.js restore <arquivo.dump>')
    console.log('\nVariáveis:')
    console.log('  DATABASE_URL_PG=postgresql://user:pass@host:5432/db')
    console.log('  BACKUP_DIR=./backups')
    process.exit(1)
}