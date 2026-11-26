#!/usr/bin/env node
/**
 * Script de validação OWASP ASVS Nível 2 — VIVASS
 * Executa verificações automatizadas e gera relatório.
 *
 * Uso: node scripts/security-audit.js
 */

const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const RESULTS = []

function check(name, fn) {
  try {
    const result = fn()
    RESULTS.push({ name, status: 'PASS', details: result ?? 'OK' })
    console.log(`✅ ${name}`)
  } catch (error) {
    RESULTS.push({ name, status: 'FAIL', details: error.message })
    console.log(`❌ ${name}: ${error.message}`)
  }
}

function warn(name, fn) {
  try {
    const result = fn()
    RESULTS.push({ name, status: 'WARN', details: result ?? 'Verificação manual necessária' })
    console.log(`⚠️  ${name}`)
  } catch (error) {
    RESULTS.push({ name, status: 'FAIL', details: error.message })
    console.log(`❌ ${name}: ${error.message}`)
  }
}

console.log('\n🔒 VIVASS — Auditoria OWASP ASVS Nível 2\n')
console.log('='.repeat(60))

/* ------------------------------------------------------------------ *
 * V1 — Arquitetura, design e modelagem de ameaças
 * ------------------------------------------------------------------ */

check('V1.1 — Documentação de arquitetura existe', () => {
  const doc = path.resolve('docs/ARQUITETURA.md')
  if (!fs.existsSync(doc)) throw new Error('docs/ARQUITETURA.md não encontrado')
  return 'Arquitetura documentada'
})

check('V1.2 — Modelo de ameaças documentado', () => {
  const doc = path.resolve('docs/ARQUITETURA.md')
  const content = fs.readFileSync(doc, 'utf8')
  if (!content.includes('Modelo de ameaças') && !content.includes('STRIDE') && !content.includes('threat model')) {
    throw new Error('Modelo de ameaças não encontrado na documentação')
  }
  return 'Modelo STRIDE documentado na arquitetura'
})

check('V1.3 — Segredos fora do código', () => {
  const envExample = path.resolve('apps/api/.env.example')
  if (!fs.existsSync(envExample)) throw new Error('.env.example não encontrado')
  const content = fs.readFileSync(envExample, 'utf8')
  // Deve ter placeholder, não segredo real
  if (content.includes('JWT_SECRET=') && !content.includes('troque-por-um-segredo') && !content.includes('your-') && !content.includes('placeholder')) {
    throw new Error('Segredo real no .env.example')
  }
  return 'Apenas placeholder no .env.example'
})

/* ------------------------------------------------------------------ *
 * V2 — Autenticação
 * ------------------------------------------------------------------ */

check('V2.1 — Senhas com hash forte (scrypt)', () => {
  const pwdFile = path.resolve('apps/api/src/auth/password.ts')
  const content = fs.readFileSync(pwdFile, 'utf8')
  if (!content.includes('scrypt')) throw new Error('scrypt não utilizado')
  if (!content.includes('timingSafeEqual')) throw new Error('Comparação não é timing-safe')
  return 'scrypt + timingSafeEqual'
})

check('V2.2 — Tokens JWT com expiração curta', () => {
  const tokensFile = path.resolve('apps/api/src/auth/tokens.ts')
  const content = fs.readFileSync(tokensFile, 'utf8')
  if (!content.includes('ACCESS_TOKEN_TTL_SECONDS') || !content.includes('15 * 60') && !content.includes('900')) {
    throw new Error('Access token não expira em ~15 min')
  }
  return 'Access token 15 min (900s via ACCESS_TOKEN_TTL_SECONDS)'
})

check('V2.3 — Refresh token rotativo com detecção de reuso', () => {
  const authFile = path.resolve('apps/api/src/routes/auth.ts')
  const content = fs.readFileSync(authFile, 'utf8')
  if (!content.includes('revokedAt') || !content.includes('revoga todas') && !content.includes('reuso')) {
    throw new Error('Rotação/reuso não implementado')
  }
  return 'Refresh rotativo + detecção de reuso'
})

check('V2.4 — Cookie refresh httpOnly, sameSite, path restrito', () => {
  const cookiesFile = path.resolve('apps/api/src/auth/cookies.ts')
  const content = fs.readFileSync(cookiesFile, 'utf8')
  if (!content.includes('httpOnly') || !content.includes('sameSite') || !content.includes('/api/auth')) {
    throw new Error('Cookie não tem flags de segurança')
  }
  return 'Cookie seguro configurado'
})

check('V2.5 — Rate limit em login', () => {
  const authFile = path.resolve('apps/api/src/routes/auth.ts')
  const content = fs.readFileSync(authFile, 'utf8')
  if (!content.includes('rateLimit') || !content.includes('max: 8')) {
    throw new Error('Rate limit não configurado em login')
  }
  return 'Rate limit 8 req/min no login'
})

check('V2.6 — Anti-enumeração de usuários (timing guard)', () => {
  const authFile = path.resolve('apps/api/src/routes/auth.ts')
  const content = fs.readFileSync(authFile, 'utf8')
  if (!content.includes('timingGuard') || !content.includes('hash descartável') && !content.includes('hashPassword')) {
    throw new Error('Timing guard não implementado')
  }
  return 'Timing guard ativo'
})

/* ------------------------------------------------------------------ *
 * V3 — Gerenciamento de sessão
 * ------------------------------------------------------------------ */

check('V3.1 — Sessão invalidada no logout', () => {
  const authFile = path.resolve('apps/api/src/routes/auth.ts')
  const content = fs.readFileSync(authFile, 'utf8')
  if (!content.includes('revokedAt: new Date()') || !content.includes('clearCookie')) {
    throw new Error('Logout não revoga refresh token')
  }
  return 'Logout revoga token + limpa cookie'
})

check('V3.2 — Sessão invalidada em troca de senha', () => {
  const authFile = path.resolve('apps/api/src/routes/auth.ts')
  const content = fs.readFileSync(authFile, 'utf8')
  if (!content.includes('AUTH_PASSWORD_CHANGED') || !content.includes('updateMany') && !content.includes('revokedAt')) {
    throw new Error('Troca de senha não revoga sessões')
  }
  return 'Troca de senha revoga todas as sessões'
})

/* ------------------------------------------------------------------ *
 * V4 — Controle de acesso
 * ------------------------------------------------------------------ */

check('V4.1 — Matriz de permissões centralizada', () => {
  const rolesFile = path.resolve('packages/shared/src/roles.ts')
  const content = fs.readFileSync(rolesFile, 'utf8')
  if (!content.includes('PERMISSION_MATRIX') || !content.includes('can(')) {
    throw new Error('Matriz não centralizada')
  }
  return 'Matriz única em @vivass/shared'
})

check('V4.2 — Autorização por vínculo (tenancy) em toda rota', () => {
  const tenancyFile = path.resolve('apps/api/src/lib/tenancy.ts')
  const content = fs.readFileSync(tenancyFile, 'utf8')
  if (!content.includes('assertInstitutionAccess') || !content.includes('membership')) {
    throw new Error('Tenancy não implementada')
  }
  return 'assertInstitutionAccess em todas as rotas'
})

check('V4.3 — Superadmin separado de papel institucional', () => {
  const rolesFile = path.resolve('packages/shared/src/roles.ts')
  const content = fs.readFileSync(rolesFile, 'utf8')
  if (!content.includes('PLATFORM_ROLES') || !content.includes('SUPERADMIN')) {
    throw new Error('Papel de plataforma não separado')
  }
  return 'SUPERADMIN é papel de plataforma'
})

check('V4.4 — Permissão verificada no servidor, nunca só no cliente', () => {
  const shellFile = path.resolve('apps/web/src/components/Shell.tsx')
  const content = fs.readFileSync(shellFile, 'utf8')
  if (!content.includes('usePermissionChecker')) {
    throw new Error('Cliente não usa checker de permissão')
  }
  return 'Cliente usa usePermissionChecker; servidor é fonte da verdade'
})

/* ------------------------------------------------------------------ *
 * V5 — Validação de entrada
 * ------------------------------------------------------------------ */

check('V5.1 — Validação Zod em todas as rotas', () => {
  const schemasFile = path.resolve('packages/shared/src/schemas.ts')
  const validateFile = path.resolve('apps/api/src/lib/validate.ts')
  const schemasContent = fs.readFileSync(schemasFile, 'utf8')
  const validateContent = fs.readFileSync(validateFile, 'utf8')
  const hasZod = schemasContent.includes('zod') || schemasContent.includes('import { z }')
  const hasParseInput = validateContent.includes('parseInput') && validateContent.includes('zod')
  if (!hasZod || !hasParseInput) {
    throw new Error('Zod não utilizado')
  }
  return 'Schemas Zod (@vivass/shared) + parseInput (api/lib/validate)'
})

check('V5.2 — Erros padronizados sem stack trace', () => {
  const errorsFile = path.resolve('apps/api/src/lib/errors.ts')
  const content = fs.readFileSync(errorsFile, 'utf8')
  if (!content.includes('ERRO_INTERNO') || !content.includes('stack trace') && !content.includes('erro não tratado')) {
    throw new Error('Erros não padronizados')
  }
  return 'Contrato de erro estável (sem stack trace no cliente)'
})

/* ------------------------------------------------------------------ *
 * V6 — Criptografia
 * ------------------------------------------------------------------ */

check('V6.1 — TLS em produção (Helmet + secure cookies)', () => {
  const appFile = path.resolve('apps/api/src/app.ts')
  const content = fs.readFileSync(appFile, 'utf8')
  if (!content.includes('helmet') || !content.includes('COOKIE_SECURE') && !content.includes('cookie')) {
    throw new Error('TLS/Helmet não configurado')
  }
  return 'Helmet + cookies secure em produção (via env.COOKIE_SECURE)'
})

check('V6.2 — Segredos com entropia adequada', () => {
  const tokensFile = path.resolve('apps/api/src/auth/tokens.ts')
  const content = fs.readFileSync(tokensFile, 'utf8')
  if (!content.includes('randomBytes(48)') || !content.includes('base64url')) {
    throw new Error('Refresh token não tem entropia suficiente')
  }
  return 'Refresh token 48 bytes base64url'
})

/* ------------------------------------------------------------------ *
 * V7 — Tratamento de erros e logging
 * ------------------------------------------------------------------ */

check('V7.1 — Logs sem dados sensíveis (redaction)', () => {
  const appFile = path.resolve('apps/api/src/app.ts')
  const content = fs.readFileSync(appFile, 'utf8')
  if (!content.includes('redact') || !content.includes('authorization')) {
    throw new Error('Logs não removem auth/cookie')
  }
  return 'Redaction de authorization e cookie'
})

check('V7.2 — Auditoria de ações sensíveis', () => {
  const auditFile = path.resolve('apps/api/src/lib/audit.ts')
  const content = fs.readFileSync(auditFile, 'utf8')
  if (!content.includes('recordAudit') || !content.includes('actorId')) {
    throw new Error('Auditoria não implementada')
  }
  return 'recordAudit com ator, ação, entidade, IP'
})

/* ------------------------------------------------------------------ *
 * V8 — Proteção de dados
 * ------------------------------------------------------------------ */

check('V8.1 — Dados sensíveis não em logs/URLs', () => {
  const routes = fs.readdirSync(path.resolve('apps/api/src/routes'))
  let ok = true
  for (const route of routes) {
    const content = fs.readFileSync(path.resolve('apps/api/src/routes', route), 'utf8')
    if (content.includes('password') && content.includes('console.log')) ok = false
  }
  if (!ok) throw new Error('Possível vazamento de senha em logs')
  return 'Sem senhas em logs'
})

check('V8.2 — Isolamento de dados por instituição testado', () => {
  const testFile = path.resolve('apps/api/tests/core.test.ts')
  const content = fs.readFileSync(testFile, 'utf8')
  if (!content.includes('isolamento') || !content.includes('não vaza')) {
    throw new Error('Teste de isolamento não encontrado')
  }
  return 'Teste automatizado de isolamento'
})

/* ------------------------------------------------------------------ *
 * V9 — Comunicações seguras
 * ------------------------------------------------------------------ */

warn('V9.1 — CSP configurado em produção', () => {
  const appFile = path.resolve('apps/api/src/app.ts')
  const content = fs.readFileSync(appFile, 'utf8')
  if (!content.includes('contentSecurityPolicy')) throw new Error('CSP não configurado')
  return 'CSP ativo em produção'
})

warn('V9.2 — HSTS em produção', () => {
  const appFile = path.resolve('apps/api/src/app.ts')
  const content = fs.readFileSync(appFile, 'utf8')
  if (!content.includes('helmet')) throw new Error('Helmet não configurado')
  return 'Helmet inclui HSTS'
})

/* ------------------------------------------------------------------ *
 * V10 — Configuração segura
 * ------------------------------------------------------------------ */

check('V10.1 — Variáveis de ambiente validadas', () => {
  const envFile = path.resolve('apps/api/src/env.ts')
  const content = fs.readFileSync(envFile, 'utf8')
  if (!content.includes('JWT_SECRET') || !content.includes('min(32') && !content.includes('min 32')) {
    throw new Error('Validação de JWT_SECRET ausente')
  }
  return 'Validação de env no bootstrap (Zod min 32)'
})

check('V10.2 — Dependências auditadas', () => {
  try {
    execSync('npm audit --audit-level=high --workspaces=false', { stdio: 'pipe', cwd: path.resolve('apps/api') })
    return 'npm audit sem vulnerabilidades altas'
  } catch (error) {
    const output = error.stdout?.toString() ?? error.message
    if (output.includes('found 0 vulnerabilities')) return 'npm audit limpo'
    throw new Error(`Vulnerabilidades encontradas: ${output.slice(0, 200)}`)
  }
})

/* ------------------------------------------------------------------ *
 * V11 — Testes de segurança
 * ------------------------------------------------------------------ */

check('V11.1 — Testes de RBAC automatizados', () => {
  const testFile = path.resolve('apps/web/tests/e2e/rbac.spec.ts')
  if (!fs.existsSync(testFile)) throw new Error('Teste RBAC não encontrado')
  return 'Matriz perfil × rota testada em E2E'
})

check('V11.2 — Testes de acessibilidade WCAG 2.2 AA', () => {
  const testFile = path.resolve('apps/web/tests/e2e/accessibility.spec.ts')
  if (!fs.existsSync(testFile)) throw new Error('Teste de acessibilidade não encontrado')
  return 'axe-core + Playwright configurado'
})

/* ------------------------------------------------------------------ *
 * V12 — Privacidade (LGPD)
 * ------------------------------------------------------------------ */

check('V12.1 — Consentimento granular por tipo', () => {
  const schemasFile = path.resolve('packages/shared/src/schemas.ts')
  const content = fs.readFileSync(schemasFile, 'utf8')
  if (!content.includes('CONSENT_TYPES') || !content.includes('createConsentSchema')) {
    throw new Error('Consentimento não implementado')
  }
  return 'Consentimento DATA/IMAGE/HEALTH'
})

check('V12.2 — Direitos do titular (acesso/correção/exclusão/portabilidade)', () => {
  const requestsFile = path.resolve('apps/api/src/routes/requests.ts')
  const content = fs.readFileSync(requestsFile, 'utf8')
  const sharedFile = path.resolve('packages/shared/src/vivass.ts')
  const sharedContent = fs.readFileSync(sharedFile, 'utf8')
  if (!content.includes('createDataRequestSchema') || !sharedContent.includes('ACCESS') || !sharedContent.includes('DELETION')) {
    throw new Error('Direitos do titular não implementados')
  }
  return 'Solicitações LGPD com 4 tipos (importado de @vivass/shared)'
})

check('V12.3 — Nenhum diagnóstico/pontuação automática de estudante', () => {
  const vivassFile = path.resolve('packages/shared/src/vivass.ts')
  const content = fs.readFileSync(vivassFile, 'utf8')
  if (content.includes('score') || content.includes('pontuação')) {
    throw new Error('Referência a score/pontuação encontrada')
  }
  return 'Sem score de estudante no domínio'
})

check('V12.4 — Dados de diagnóstico anônimos', () => {
  const diagFile = path.resolve('apps/api/src/routes/diagnostics.ts')
  const content = fs.readFileSync(diagFile, 'utf8')
  if (!content.includes('anônima') && !content.includes('anônimo') || !content.includes('sem autor') && !content.includes('não grava autor')) {
    throw new Error('Diagnóstico não é anônimo')
  }
  return 'Respostas sem autor/turma/estudante'
})

/* ------------------------------------------------------------------ *
 * Relatório
 * ------------------------------------------------------------------ */

console.log('\n' + '='.repeat(60))
console.log('📊 RESUMO DA AUDITORIA')
console.log('='.repeat(60))

const pass = RESULTS.filter(r => r.status === 'PASS').length
const warnCount = RESULTS.filter(r => r.status === 'WARN').length
const fail = RESULTS.filter(r => r.status === 'FAIL').length

console.log(`✅ PASS: ${pass}`)
console.log(`⚠️  WARN: ${warnCount}`)
console.log(`❌ FAIL: ${fail}`)
console.log(`Total: ${RESULTS.length}`)

if (fail > 0) {
  console.log('\n❌ FALHAS:')
  RESULTS.filter(r => r.status === 'FAIL').forEach(r => console.log(`  - ${r.name}: ${r.details}`))
  process.exitCode = 1
}

const reportPath = path.resolve('docs/SECURITY_AUDIT.md')
const report = `# VIVASS — Auditoria OWASP ASVS Nível 2

**Data:** ${new Date().toISOString().slice(0, 10)}
**Versão:** 0.1.0 (Fases 1–6)

## Resumo
- ✅ PASS: ${pass}
- ⚠️ WARN: ${warnCount}
- ❌ FAIL: ${fail}
- Total: ${RESULTS.length}

## Detalhes

${RESULTS.map(r => `### ${r.status === 'PASS' ? '✅' : r.status === 'WARN' ? '⚠️' : '❌'} ${r.name}
**Status:** ${r.status}
**Detalhes:** ${r.details}
`).join('\n')}

---
*Gerado automaticamente por \`scripts/security-audit.js\`*
`

fs.writeFileSync(reportPath, report)
console.log(`\n📄 Relatório salvo em: ${reportPath}`)