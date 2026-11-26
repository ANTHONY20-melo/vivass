# VIVASS — Auditoria OWASP ASVS Nível 2

**Data:** 2026-11-26
**Versão:** 0.1.0 (Fases 1–6)

## Resumo
- ✅ PASS: 30
- ⚠️ WARN: 2
- ❌ FAIL: 1
- Total: 33

## Detalhes

### ✅ V1.1 — Documentação de arquitetura existe
**Status:** PASS
**Detalhes:** Arquitetura documentada

### ✅ V1.2 — Modelo de ameaças documentado
**Status:** PASS
**Detalhes:** Modelo STRIDE documentado na arquitetura

### ✅ V1.3 — Segredos fora do código
**Status:** PASS
**Detalhes:** Apenas placeholder no .env.example

### ✅ V2.1 — Senhas com hash forte (scrypt)
**Status:** PASS
**Detalhes:** scrypt + timingSafeEqual

### ✅ V2.2 — Tokens JWT com expiração curta
**Status:** PASS
**Detalhes:** Access token 15 min (900s via ACCESS_TOKEN_TTL_SECONDS)

### ✅ V2.3 — Refresh token rotativo com detecção de reuso
**Status:** PASS
**Detalhes:** Refresh rotativo + detecção de reuso

### ✅ V2.4 — Cookie refresh httpOnly, sameSite, path restrito
**Status:** PASS
**Detalhes:** Cookie seguro configurado

### ✅ V2.5 — Rate limit em login
**Status:** PASS
**Detalhes:** Rate limit 8 req/min no login

### ✅ V2.6 — Anti-enumeração de usuários (timing guard)
**Status:** PASS
**Detalhes:** Timing guard ativo

### ✅ V3.1 — Sessão invalidada no logout
**Status:** PASS
**Detalhes:** Logout revoga token + limpa cookie

### ✅ V3.2 — Sessão invalidada em troca de senha
**Status:** PASS
**Detalhes:** Troca de senha revoga todas as sessões

### ✅ V4.1 — Matriz de permissões centralizada
**Status:** PASS
**Detalhes:** Matriz única em @vivass/shared

### ✅ V4.2 — Autorização por vínculo (tenancy) em toda rota
**Status:** PASS
**Detalhes:** assertInstitutionAccess em todas as rotas

### ✅ V4.3 — Superadmin separado de papel institucional
**Status:** PASS
**Detalhes:** SUPERADMIN é papel de plataforma

### ✅ V4.4 — Permissão verificada no servidor, nunca só no cliente
**Status:** PASS
**Detalhes:** Cliente usa usePermissionChecker; servidor é fonte da verdade

### ✅ V5.1 — Validação Zod em todas as rotas
**Status:** PASS
**Detalhes:** Schemas Zod (@vivass/shared) + parseInput (api/lib/validate)

### ✅ V5.2 — Erros padronizados sem stack trace
**Status:** PASS
**Detalhes:** Contrato de erro estável (sem stack trace no cliente)

### ✅ V6.1 — TLS em produção (Helmet + secure cookies)
**Status:** PASS
**Detalhes:** Helmet + cookies secure em produção (via env.COOKIE_SECURE)

### ✅ V6.2 — Segredos com entropia adequada
**Status:** PASS
**Detalhes:** Refresh token 48 bytes base64url

### ✅ V7.1 — Logs sem dados sensíveis (redaction)
**Status:** PASS
**Detalhes:** Redaction de authorization e cookie

### ✅ V7.2 — Auditoria de ações sensíveis
**Status:** PASS
**Detalhes:** recordAudit com ator, ação, entidade, IP

### ✅ V8.1 — Dados sensíveis não em logs/URLs
**Status:** PASS
**Detalhes:** Sem senhas em logs

### ✅ V8.2 — Isolamento de dados por instituição testado
**Status:** PASS
**Detalhes:** Teste automatizado de isolamento

### ⚠️ V9.1 — CSP configurado em produção
**Status:** WARN
**Detalhes:** CSP ativo em produção

### ⚠️ V9.2 — HSTS em produção
**Status:** WARN
**Detalhes:** Helmet inclui HSTS

### ✅ V10.1 — Variáveis de ambiente validadas
**Status:** PASS
**Detalhes:** Validação de env no bootstrap (Zod min 32)

### ❌ V10.2 — Dependências auditadas
**Status:** FAIL
**Detalhes:** Vulnerabilidades conhecidas na cadeia de dependências do `exceljs` (uuid, fast-csv, tmp). 
Requer atualização do `exceljs` para versão >= 3.10.0 ou substituição da biblioteca antes de produção.
Mitigação temporária: `npm audit` monitorado em CI; uso apenas em relatórios internos; entrada de dados validada. 

### ✅ V11.1 — Testes de RBAC automatizados
**Status:** PASS
**Detalhes:** Matriz perfil × rota testada em E2E

### ✅ V11.2 — Testes de acessibilidade WCAG 2.2 AA
**Status:** PASS
**Detalhes:** axe-core + Playwright configurado

### ✅ V12.1 — Consentimento granular por tipo
**Status:** PASS
**Detalhes:** Consentimento DATA/IMAGE/HEALTH

### ✅ V12.2 — Direitos do titular (acesso/correção/exclusão/portabilidade)
**Status:** PASS
**Detalhes:** Solicitações LGPD com 4 tipos (importado de @vivass/shared)

### ✅ V12.3 — Nenhum diagnóstico/pontuação automática de estudante
**Status:** PASS
**Detalhes:** Sem score de estudante no domínio

### ✅ V12.4 — Dados de diagnóstico anônimos
**Status:** PASS
**Detalhes:** Respostas sem autor/turma/estudante


---
*Gerado automaticamente por `scripts/security-audit.js`*
