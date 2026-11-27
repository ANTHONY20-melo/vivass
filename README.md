# VIVASS — Plataforma de Gestão Educacional Integrada

**Vida, Valores, Aprendizado, Saúde e Sustentabilidade.**
_Educação integrada para transformar vidas._

Sistema de gestão, planejamento, acompanhamento e avaliação do Projeto VIVASS em
instituições de ensino. Não é um site institucional: é uma aplicação com banco de dados,
autenticação, controle de acesso por perfil, isolamento de dados por instituição,
auditoria e painel de indicadores.

> **Status desta entrega: Fases 1–6 concluídas** — fundação, autenticação, RBAC multi-instituição,
> identidade visual, painel real, gestão institucional completa (estudantes, turmas, consentimentos LGPD),
> módulos VIVASS (projetos, atividades, eixos, dimensões biopsicossociais),
> planejamento (planos de ação, marcos, diagnóstico anônimo),
> inteligência (comunicados, biblioteca, relatórios PDF/Excel, portal, calendário),
> validação (E2E Playwright, RBAC matrix, OWASP ASVS, WCAG 2.2 AA, load test, PG migration, backup/restore, runbook).
> Próximos passos em [`docs/ROADMAP.md`](docs/ROADMAP.md) — Fase 7 (expansão).

---

## Stack

| Camada | Tecnologia | Motivo |
|---|---|---|
| Runtime | Node.js 24 LTS | já instalado no ambiente; `node:sqlite` e recursos modernos |
| API | Fastify 5 + TypeScript | baixo overhead, plugins maduros, validação explícita |
| Banco | SQLite (dev) / PostgreSQL (prod) via Prisma 6 | zero infra local; schema compatível; Supabase (pooler) em produção |
| Validação | Zod 4 (`@vivass/shared`) | um contrato só para API e interface |
| Frontend | React 19 + Vite 7 + TypeScript | SPA servida pela própria API em produção |
| Estilo | Tailwind CSS 4 | design system com tokens, sem CSS morto |
| Gráficos | Recharts 3 | indicadores do painel |
| Testes | Vitest 3 + `app.inject` | integração real de rotas, RBAC e isolamento |
| Auth | scrypt (Node) + JWT HS256 (`jose`) + refresh rotativo | sem dependência binária nativa |

Sem Docker e sem pnpm: o ambiente do Senhor não tem nenhum dos dois, e nada aqui depende
deles para rodar.

---

## Estrutura

```
vivass/
├─ apps/
│  ├─ api/                 Fastify + Prisma + testes
│  │  ├─ prisma/           schema, migrações e seed de demonstração
│  │  ├─ src/
│  │  │  ├─ auth/          senha, tokens, cookie
│  │  │  ├─ lib/          erros, tenancy, auditoria, sessão
│  │  │  ├─ plugins/       autenticação por Bearer
│  │  │  └─ routes/        auth, instituições, painel, health
│  │  └─ tests/            integração (RBAC, tenancy, refresh)
│  └─ web/                 React + Vite + Tailwind
│     └─ src/
│        ├─ components/    Shell, Logo, UI base
│        ├─ lib/           cliente HTTP, sessão, instituição ativa
│        └─ pages/         Login, Painel, Instituições, Equipe
├─ packages/
│  └─ shared/              papéis, permissões, eixos, schemas Zod, tipos
└─ docs/                   arquitetura, LGPD, roadmap
```

---

## Como rodar

Pré-requisitos: **Node.js 22+** (testado em 24.19) e npm.

```powershell
cd C:\Users\Anthony.melo\Desktop\ULTRON\vivass
npm install

# 1. Configuração (a cópia já vem com segredo gerado nesta instalação)
Copy-Item apps\api\.env.example apps\api\.env
# edite JWT_SECRET com pelo menos 32 caracteres aleatórios:
#   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# 2. Banco + dados de demonstração
npm run db:migrate
npm run db:seed

# 3. Desenvolvimento (API em :3333, interface em :5173)
npm run dev
```

Acesse **http://localhost:5173** e entre com uma conta de demonstração.

> `npm run dev` compila `@vivass/shared` antes de subir API e web. Se alterar apenas
> arquivos de `packages/shared`, rode `npm run build --workspace @vivass/shared`.

### Contas de demonstração

Senha única: `Vivass@2026` — **todos os registros do seed são fictícios**
(`isDemo = true`) e a interface exibe o aviso.

| E-mail | Perfil |
|---|---|
| `admin@vivass.demo` | Superadministrador (todas as instituições) |
| `gestor@vivass.demo` | Gestor escolar — EMEF Helena Duarte |
| `gestor2@vivass.demo` | Gestor escolar — Colégio Vale Verde |
| `coord@vivass.demo` | Coordenador VIVASS |
| `prof@vivass.demo` | Professor / educador |
| `equipe@vivass.demo` | Equipe multidisciplinar |
| `familia@vivass.demo` | Família / responsável |
| `aluno@vivass.demo` | Estudante |

---

## O que já funciona (Fase 1)

- **Login real** com e-mail e senha; senha com scrypt e parâmetros gravados no hash.
- **Sessão** com access token de 15 min + refresh token opaco de 30 dias em cookie
  `httpOnly`, **com rotação** e detecção de reuso (revoga todas as sessões).
- **RBAC** por vínculo (`Membership`): gestor, coordenador, professor, equipe
  multidisciplinar, família e estudante — cada um com permissões explícitas.
- **Isolamento por instituição** em toda consulta: sem vínculo ativo, a resposta é 403.
- **Superadministrador** cria instituições; cada escola nasce com espaço de dados próprio.
- **Equipe**: listagem de vínculos e criação de usuário com perfil e senha provisória.
- **Painel** com indicadores calculados no banco (estudantes, profissionais, projetos,
  atividades, participação, execução do planejamento), gráficos por eixo e evolução mensal,
  filtro de período e estado vazio honesto.
- **Auditoria** de login, falha de login, logout, criação de instituição e de vínculo.
- **Identidade visual** VIVASS: marca tipográfica com símbolo de cinco arcos (um por eixo),
  paleta verde institucional, tipografia Plus Jakarta Sans, layout responsivo com menu
  lateral, drawer mobile, foco visível e navegação por teclado.
- **Testes de integração**: 12 casos cobrindo autenticação, RBAC, isolamento, painel,
  auditoria e rotação de refresh.

## O que ainda não existe (e está sinalizado na interface)

Módulos por eixo, projetos/atividades editáveis, diagnóstico, planos de ação, avaliação
participativa, relatórios PDF/Excel, calendário, comunicados, biblioteca digital, portal da
família/estudante e biopsicossocial. Nada disso é botão morto: os itens aparecem como
"Fase 3/4/5" no menu, sem link.

---

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | API (:3333) + interface (:5173) com proxy `/api` |
| `npm run build` | compila shared → API → web |
| `npm start` | sobe a API servindo também o build da interface |
| `npm test` | testes de integração da API |
| `npm run typecheck` | TypeScript estrito nos três pacotes |
| `npm run db:migrate` | cria/aplica migração de desenvolvimento (SQLite) |
| `npm run db:seed` | recria os dados de demonstração |
| `npm run db:reset` | zera o banco e reaplica tudo |
| `npm run db:generate:prod` | gera o client a partir do schema PostgreSQL |
| `npm run db:migrate:prod` | aplica migrações em produção (PostgreSQL/Supabase) |
| `npm run db:seed:prod` | popula o banco de produção |
| `npm run schema:check` | falha se os schemas SQLite e Postgres divergirem |

### Dois schemas do Prisma

O Prisma não aceita `provider` dinâmico via variável de ambiente, então existem dois arquivos:

| Arquivo | Provider | Uso |
|---|---|---|
| `apps/api/prisma/schema.prisma` | SQLite | desenvolvimento e testes — sem infraestrutura local |
| `apps/api/prisma-postgres/schema.prisma` | PostgreSQL | produção (Supabase) |

Os **modelos devem ser idênticos** nos dois arquivos. `npm run schema:check` falha no primeiro
campo divergente — a duplicação é uma dívida aceita, o drift silencioso não.

Produção (Supabase + Railway + Vercel):

```powershell
# 1. Variáveis da API (definidas no painel do Railway). NUNCA comite esses valores.
# DATABASE_URL  = Supabase → Connect → "Session pooler" (porta 5432) + ?sslmode=require
#                 Verificado: a porta 6543 (transaction pooler) faz `prisma migrate` TRAVAR.
#                 Se precisar dela no runtime, use ?pgbouncer=true&connection_limit=1
# JWT_SECRET    = node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
# COOKIE_SECURE = true
# WEB_ORIGIN    = https://<seu-front>.vercel.app
# NODE_ENV      = production

# 2. Railway — Root Directory: apps/api
#    Build:  npm run db:generate:prod && npm run build --workspace @vivass/shared && npm run build --workspace @vivass/api
#    Start:  node dist/server.js
#    Deploy: npm run db:migrate:prod   (uma vez, e a cada migração nova)

# 3. Vercel — Root Directory: RAIZ do repositório (não apps/web)
#    O front depende do workspace @vivass/shared; buildar de apps/web não resolve o pacote.
#    Build:    npm run build --workspace @vivass/shared && npm run build --workspace @vivass/web
#    Output:   apps/web/dist
#    Variável: VITE_API_URL = https://<sua-api>.railway.app

# 4. Amarre as origens nos dois lados
#    WEB_ORIGIN (Railway) precisa conter a URL do Vercel.
#    VITE_API_URL (Vercel) precisa ser a URL do Railway.
#    Origem divergente = CORS bloqueado e cookie de refresh descartado pelo navegador.
```

---

## Segurança em resumo

- Senha: **scrypt** com salt por usuário; comparação em tempo constante.
- Refresh token: valor aleatório de 48 bytes; no banco só o **SHA-256**.
- Cookie de refresh restrito a `/api/auth`, `httpOnly`, `sameSite=lax`, `secure` em produção.
- Autorização **sempre** por vínculo ativo lido do banco a cada requisição — desativar um
  vínculo tem efeito imediato, sem esperar token expirar.
- Erros de autenticação não distinguem e-mail inexistente de senha errada, e o tempo de
  resposta é equalizado.
- Rate limit global (300/min) e login restrito a 8 tentativas/min por IP.
- Helmet + CSP em produção; `authorization` e `cookie` removidos dos logs.
- Auditoria de ações sensíveis com ator, instituição, entidade, IP e metadados.
- Nenhum dado pessoal de estudante é exposto em resposta pública; o painel só devolve
  **agregados**.

Detalhes e pendências: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) e
[`docs/LGPD.md`](docs/LGPD.md).

---

## Decisões que valem registro

1. **SQLite agora, PostgreSQL depois.** O schema não usa recurso exclusivo de SQLite;
   trocar o `provider` e gerar nova migração é o caminho. Produção multipolo exige
   PostgreSQL (ver roadmap).
2. **Sem Next.js.** A SPA é servida pelo Fastify em produção: um processo, um deploy,
   sem SSR desnecessário para um painel autenticado.
3. **Sem ORM "mágico" no frontend.** TanStack Query cuida de cache e refetch; nenhum
   estado global mutável além de sessão e instituição ativa.
4. **Domínios em `@vivass/shared`.** Papéis, permissões, eixos e schemas Zod são a única
   fonte: API e interface não podem divergir.
5. **Permissão é dado, não decoração.** A matriz está em `packages/shared/src/roles.ts` e é
   aplicada no servidor em `assertInstitutionAccess`.
