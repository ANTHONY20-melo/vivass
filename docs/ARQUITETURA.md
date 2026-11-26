# VIVASS — Arquitetura

## 1. Visão geral

```
Navegador
  │  React 19 + Vite (SPA)
  │  fetch /api (mesma origem; proxy no dev)
  ▼
Fastify 5
  ├─ helmet / rate-limit / cookie
  ├─ authenticate (Bearer JWT → usuário + vínculos do banco)
  ├─ rotas /api/auth · /api/institutions · /api/institutions/:id/dashboard
  ├─ tenancy (assertInstitutionAccess)
  ├─ auditoria (AuditLog)
  └─ Prisma 6 → SQLite (dev) / PostgreSQL (produção)
```

Em produção, o Fastify também serve `apps/web/dist` com fallback SPA. Um processo, uma
porta, sem CORS.

## 2. Por que esta arquitetura

| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| Monorepo npm workspaces | pnpm/Turborepo | pnpm não instalado; npm workspaces resolve sem nova ferramenta |
| Fastify | Express/Nest | Express sem schema nativo; Nest pesado para o tamanho da equipe |
| Prisma + SQLite | PostgreSQL + Docker | Docker ausente; SQLite entrega banco real hoje, com migração documentada |
| JWT curto + refresh rotativo | sessão em memória | permite API stateless e revogação real via refresh no banco |
| scrypt nativo | bcrypt/argon2 | sem compilação nativa no Windows; parâmetros versionados no hash |
| Tailwind 4 | CSS-in-JS | design tokens simples, bundle controlado, sem runtime de estilo |

## 3. Modelo de dados (Fase 1)

```
Institution 1─N Membership N─1 User
Institution 1─N Cycle
Institution 1─N SchoolClass 1─N Student
Institution 1─N Project 1─N Activity
User        1─N RefreshToken
User        1─N AuditLog (ator)
Institution 1─N AuditLog
```

- `Membership` é a **única** fonte de autorização por escola; `User.platformRole` só
  distingue `SUPERADMIN` de `USER`.
- `Activity.projectId` é opcional: ação avulsa não exige projeto.
- `axis` e `dimension` são strings validadas por Zod (SQLite não suporta enum no Prisma).
- Índices por `institutionId` em todas as consultas de lista e por
  `(institutionId, scheduledAt)` no painel.
- `AuditLog.metadata` é JSON serializado em `String` (portabilidade SQLite/PostgreSQL).

## 4. Isolamento entre instituições

Toda rota com `:institutionId` chama `assertInstitutionAccess(auth, id, permission)`:

1. `SUPERADMIN` → permitido (ação auditada).
2. Vínculo ativo do usuário com a instituição → verifica permissão do papel.
3. Caso contrário → **403**, sem revelar se o registro existe.

Nenhuma consulta Prisma de dados institucionais é feita antes dessa checagem. Consultas
agregadas do superadministrador usam `groupBy` por `institutionId` — nunca misturam linhas
de escolas diferentes na mesma resposta institucional.

## 5. Autenticação e sessão

```
login:    email+senha → scrypt verify → access JWT (15m)
                        └→ refresh opaco (48 bytes) → hash SHA-256 no banco + cookie httpOnly
refresh:  cookie → hash → registro válido? → revoga o atual → emite novo (rotação)
          registro já revogado? → revoga TODAS as sessões do usuário (reuso = roubo)
logout:   revoga o refresh atual + limpa cookie
```

- O access token não carrega permissões: a cada requisição o usuário e os vínculos são
  lidos do banco. Desativar um vínculo corta o acesso em ≤ 15 min, e o refresh já falha.
- `timingGuard`: quando o e-mail não existe, um hash descartável é verificado para igualar
  o tempo de resposta.
- CSRF: as rotas de dados usam `Authorization: Bearer` (não cookie), o cookie de refresh é
  `sameSite=lax` e restrito a `/api/auth`. Não há endpoint de escrita autenticado por cookie.

## 6. Matriz de permissões

| Permissão | Super | Gestor | Coord. | Prof. | Multidisc. | Família | Estudante |
|---|---|---|---|---|---|---|---|
| institution:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| institution:manage | ✓ | | | | | | |
| user:read | ✓ | ✓ | ✓ | | | | |
| user:manage | ✓ | ✓ | | | | | |
| student:read | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| student:manage | ✓ | ✓ | | | | | |
| project:read | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| project:manage | ✓ | ✓ | ✓ | | | | |
| activity:read | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| activity:manage | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| dashboard:read | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| report:read | ✓ | ✓ | ✓ | | | | |
| portal:access | ✓ | | | | | ✓ | ✓ |

Fonte única: `packages/shared/src/roles.ts`.

## 7. Contrato de erro

```json
{ "error": { "code": "ACESSO_NEGADO", "message": "...", "details": [...] } }
```

Códigos estáveis: `NAO_AUTENTICADO`, `ACESSO_NEGADO`, `DADOS_INVALIDOS`,
`NAO_ENCONTRADO`, `CONFLITO`, `MUITAS_TENTATIVAS`, `ERRO_INTERNO`. O cliente nunca recebe
stack trace.

## 8. Painel

`GET /api/institutions/:id/dashboard?days=90` calcula, no servidor:

- contagens de estudantes ativos, profissionais, famílias ativas, projetos ativos;
- atividades do período (total, realizadas, pendentes), participantes somados e
  percentual de execução;
- série por eixo e série mensal de 6 meses;
- execução por projeto e últimas atividades.

Períodos permitidos: 7 a 730 dias. Nenhum número é inventado: instituição sem dados
mostra zero e estado vazio explícito.

## 9. Caminho de escala (quando sair do piloto)

1. **PostgreSQL**: trocar `provider`/`DATABASE_URL`, gerar migração, revisar `String`
   `metadata` para `Json`.
2. **Réplica de leitura** para o painel + cache de 60 s por instituição/período.
3. **Particionamento por instituição** nas tabelas de atividade/auditoria.
4. **Storage de anexos** (S3 compatível) com URLs assinadas — nunca no banco.
5. **Fila** (BullMQ + Redis) para exportação de relatórios e envio de comunicados.
6. **Observabilidade**: OpenTelemetry, logs estruturados com traceId, métricas de p95 por
   rota e alerta em 5xx.
7. **Code splitting** do front: hoje o bundle único tem ~907 kB (268 kB gzip); rotas por
   módulo resolvem isso na Fase 3.

## 10. Modelo de ameaças (Threat Modeling — STRIDE)

| Ameaça | Vetor | Mitigação implementada | Residual |
|---|---|---|---|
| **Spoofing** | Credenciais roubadas / session hijack | scrypt + timing guard, refresh rotativo com detecção de reuso, JWT 15 min, cookie httpOnly/sameSite/secure | Baixo — requer roubo de refresh token + uso antes da rotação |
| **Tampering** | Injeção SQL / manipulação de payload | Prisma parameterized queries, validação Zod em toda entrada, Helmet + CSP em produção | Baixo — ORM previne SQLi nativo |
| **Repudiation** | Usuário nega ação realizada | Auditoria obrigatória (actorId, action, entity, IP, timestamp) em toda escrita sensível | Baixo — log imutável com ator identificado |
| **Information Disclosure** | Vazamento cross-tenant / logs / erros | Isolamento por instituição em toda rota (assertInstitutionAccess), redaction de auth/cookie nos logs, erros padronizados sem stack | Baixo — tenancy testada automaticamente |
| **Denial of Service** | Brute force login / query pesada / recurso exausto | Rate limit global (300/min) + login (8/min), p95 dashboard < 800ms testado, índices compostos | Médio — depende de capacidade da instância |
| **Elevation of Privilege** | Escalação de papel / bypass RBAC | Papel de plataforma (SUPERADMIN) separado de vínculo; permissão verificada no servidor em toda rota; matriz única em @vivass/shared | Baixo — autorização centralizada |

**Superfície de ataque exposta:**
- `POST /api/auth/login` — rate limited, timing guard
- `POST /api/auth/refresh` — cookie httpOnly, rotação, detecção reuso
- `GET /api/institutions/:id/dashboard` — autorização por vínculo, agregações server-side
- `POST /api/institutions/:id/members` — permissão `user:manage`, auditoria
- `GET /api/institutions/:id/reports/*.pdf|xlsx` — permissão `report:read`, auditoria

**Controles de detecção:**
- `AuditLog` em tempo real para `AUTH_LOGIN_FAILED`, `AUTH_PASSWORD_CHANGED`, `INSTITUTION_CREATE`, `MEMBER_CREATE`, `REPORT_EXPORT_*`
- Alertas configuráveis em `http_request_duration_seconds{p95}`, `http_requests_total{5xx}`, `audit_log_failed_login_total`

**Plano de resposta a incidente:** ver [`docs/RUNBOOK.md`](RUNBOOK.md).
