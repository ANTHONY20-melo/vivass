# VIVASS — Runbook de Incidente

> Documento operacional para resposta a incidentes de segurança e disponibilidade.
> Versão: 0.1.0 | Fases 1–6 | Atualizado: 2026-11-26

---

## 1. Classificação de Severidade

| Nível | Definição | SLA Resposta | SLA Resolução | Exemplos |
|---|---|---|---|---|
| **SEV-1** | Serviço indisponível ou vazamento de dados confirmado | 15 min | 4 horas | API down, vazamento LGPD, ransomware |
| **SEV-2** | Degradação severa / funcionalidade crítica falha | 30 min | 8 horas | Dashboard lentidão > 5s, auth intermitente |
| **SEV-3** | Falha não crítica / workaround existe | 2 horas | 24 horas | Relatórios falham, biblioteca indisponível |
| **SEV-4** | Baixo impacto / melhoria / investigação | Melhor esforço | Próxima sprint | Logs ruidosos, feature flag |

---

## 2. Contatos de Escalação

| Papel | Nome | Canal Primário | Canal Secundário |
|---|---|---|---|
| **Tech Lead** | — | Slack `#vivass-oncall` | Telefone |
| **DPO (LGPD)** | — | E-mail `dpo@rede.gov.br` | Telefone |
| **Infra/Cloud** | — | Slack `#infra-alerts` | PagerDuty |
| **Gestor Escolar (afetado)** | — | WhatsApp grupo gestores | E-mail institucional |

> **Regra:** SEV-1/2 aciona Tech Lead + DPO simultaneamente. SEV-3 aciona Tech Lead.

---

## 3. Procedimentos por Cenário

### 3.1 API Indisponível (SEV-1)

**Sintomas:** Health check `/api/health` retorna 5xx ou timeout; alerta de uptime disparado.

**Diagnóstico rápido (≤ 5 min):**
```bash
# 1. Verificar processo
systemctl status vivass-api || docker ps | grep vivass

# 2. Logs recentes
journalctl -u vivass-api -n 100 --since "10 minutes ago"
# ou
docker logs vivass-api --tail 100 --since 10m

# 3. Recursos
htop / docker stats
df -h /  # espaço em disco
```

**Causas comuns e ações:**
| Causa | Ação Imediata | Prevenção |
|---|---|---|
| OOM / Memory leak | Reiniciar serviço; aumentar heap Node (`NODE_OPTIONS=--max-old-space-size=2048`) | Alertas de memória > 80%; profiling periódico |
| Disco cheio (logs/backup) | `journalctl --vacuum-time=7d`; limpar backups antigos | Rotação de logs + retenção 30 dias |
| Migration travada | `npx prisma migrate resolve --rolled-back <id>` | Deploy com `migrate deploy` em transação |
| PostgreSQL conexões esgotadas | `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state='idle' AND state_change < NOW() - INTERVAL '10 min';` | PgBouncer / pool sizing |

**Comunicação:** Postar no `#vivass-oncall` + notificar gestores afetados se > 15 min.

---

### 3.2 Lentidão no Painel / Dashboard (SEV-2)

**Sintomas:** p95 > 5s no `/api/institutions/:id/dashboard`; alerta de latência.

**Diagnóstico:**
```bash
# 1. Query lenta no PG
psql $DATABASE_URL -c "
  SELECT query, mean_time, calls, rows
  FROM pg_stat_statements
  WHERE query LIKE '%dashboard%' OR query LIKE '%Activity%'
  ORDER BY mean_time DESC LIMIT 10;
"

# 2. Índices faltando
psql $DATABASE_URL -c "
  SELECT schemaname, tablename, indexname, idx_scan
  FROM pg_stat_user_indexes
  WHERE idx_scan = 0 AND schemaname = 'public';
"

# 3. Cache hit ratio
psql $DATABASE_URL -c "
  SELECT sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) AS cache_hit_ratio
  FROM pg_statio_user_tables;
"
```

**Ações:**
- `ANALYZE` tabelas principais (`Student`, `Activity`, `Project`, `Membership`)
- Criar índices compostos faltantes (ex.: `("institutionId", "scheduledAt")` em Activity)
- Se cache hit < 95%: aumentar `shared_buffers` / `effective_cache_size`
- Habilitar `pg_stat_statements` se não ativo

---

### 3.3 Vazamento de Dados / LGPD (SEV-1)

**Gatilhos:** Alerta de auditoria (acesso anômalo), denúncia de titular, log de exportação suspeita.

**Passos Imediatos (≤ 30 min):**
1. **Conter:** Revogar todos os refresh tokens → `UPDATE "RefreshToken" SET "revokedAt" = NOW() WHERE "revokedAt" IS NULL;`
2. **Rotacionar segredos:** Gerar novo `JWT_SECRET` → redeploy API
3. **Bloquear ator:** `UPDATE "User" SET status = 'BLOCKED' WHERE id = '<suspeito>';`
4. **Preservar evidências:** Snapshot do `AuditLog` (últimas 24h) → `pg_dump -t "AuditLog"`

**Avaliação (≤ 2h):**
- Quais instituições afetadas? (query por `institutionId` no `AuditLog`)
- Quais entidades expostas? (`entity`, `entityId` no `AuditLog`)
- Dados sensíveis? (`entity IN ('Student','Consent','DataRequest')`)

**Comunicação LGPD (≤ 24h):**
- Notificar DPO + gestores das escolas afetadas
- Relatório sem dados pessoais: período, vetor, registros afetados (contagem), ações tomadas
- Registrar no `AuditLog` ação `INCIDENT_LGPD_REPORTED`

**Pós-incidente (≤ 72h):**
- Post-mortem escrito (sem dados pessoais)
- Ação corretiva + teste de regressão
- Atualizar runbook se novo vetor

---

### 3.4 Falha de Autenticação em Massa (SEV-2)

**Sintomas:** Pico de `AUTH_LOGIN_FAILED` > 100/min; usuários legítimos não conseguem entrar.

**Diagnóstico:**
```bash
# Verificar se é brute force ou bug
psql $DATABASE_URL -c "
  SELECT ip, COUNT(*) AS tentativas
  FROM "AuditLog"
  WHERE action = 'AUTH_LOGIN_FAILED' AND "createdAt" > NOW() - INTERVAL '1 hour'
  GROUP BY ip ORDER BY tentativas DESC LIMIT 20;
"
```

**Ações:**
- Se brute force: bloquear IPs no firewall / rate limit mais agressivo
- Se bug (ex.: clock skew, cookie domain): hotfix + deploy
- Comunicar status aos gestores

---

### 3.5 Perda de Dados / Corrupção (SEV-1)

**Cenários:** `DROP TABLE` acidental, `DELETE` sem `WHERE`, falha de migração.

**Recuperação:**
1. **Parar escrita:** `systemctl stop vivass-api` / scale to 0
2. **Identificar último backup válido:** `ls -lt backups/`
3. **Restore point-in-time (se PG com WAL archiving):**
   ```bash
   pg_basebackup -D /recovery -R -X stream -P
   # configurar recovery.signal + restore_command
   ```
4. **Se apenas backup lógico:** `pg_restore -d $DATABASE_URL backups/vivass-backup-YYYYMMDD.dump`
5. **Validar integridade:** rodar seed + testes automatizados
6. **Reativar API**

---

## 4. Checklist de Pós-Incidente (Todos os SEV)

- [ ] **Timeline** registrada (início, detecção, contenção, resolução)
- [ ] **Causa raiz** (5 Porquês) documentada
- [ ] **Impacto** quantificado (usuários, escolas, dados)
- [ ] **Ações corretivas** com dono e prazo
- [ ] **Teste de regressão** adicionado (unit/E2E)
- [ ] **Runbook atualizado** se novo cenário
- [ ] **Comunicação** enviada a stakeholders (sem dados pessoais)

---

## 5. Comandos Úteis de Operação

```bash
# Status geral
systemctl status vivass-api vivass-web
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Logs estruturados (últimos 100)
journalctl -u vivass-api -n 100 -o json-pretty | jq '.MESSAGE'

# Métricas rápidas PG
psql $DATABASE_URL -c "
  SELECT datname, numbackends, xact_commit, xact_rollback, blks_read, blks_hit
  FROM pg_stat_database WHERE datname = current_database();
"

# Tamanho tabelas
psql $DATABASE_URL -c "
  SELECT relname, pg_size_pretty(pg_total_relation_size(oid)) AS size
  FROM pg_class WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace
  ORDER BY pg_total_relation_size(oid) DESC LIMIT 20;
"

# Revogar todas as sessões (emergência)
psql $DATABASE_URL -c "
  UPDATE "RefreshToken" SET "revokedAt" = NOW() WHERE "revokedAt" IS NULL;
"

# Rotacionar JWT_SECRET (requer redeploy)
# 1. Gerar: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
# 2. Atualizar .env + restart API
```

---

## 6. Métricas de Alerta (Configurar no Prometheus/Grafana)

| Métrica | Threshold SEV-2 | Threshold SEV-1 |
|---|---|---|
| `http_request_duration_seconds{quantile="0.95",handler="/api/institutions/*/dashboard"}` | > 5s | > 15s |
| `http_requests_total{status=~"5.."}` | > 1%/5min | > 5%/5min |
| `process_resident_memory_bytes` | > 1.5GB | > 2.5GB |
| `node_filesystem_avail_bytes{mountpoint="/"} ` | < 2GB | < 500MB |
| `pg_stat_database_deadlocks` | > 0/hora | > 5/hora |
| `audit_log_failed_login_total` | > 50/min | > 200/min |

---

## 7. Aprovação e Revisão

| Versão | Data | Autor | Aprovado por |
|---|---|---|---|
| 0.1.0 | 2026-11-26 | ULTRON CORE | — |

**Próxima revisão:** Após primeiro incidente real ou a cada 6 meses.