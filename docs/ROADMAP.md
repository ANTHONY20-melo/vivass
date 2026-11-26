# VIVASS — Roadmap de entrega

Status: **Fase 1 concluída e validada** (build, typecheck e 12 testes de integração).

## Fase 1 — Fundação ✅

- Monorepo npm workspaces, TypeScript estrito, contrato compartilhado (`@vivass/shared`).
- Schema relacional + migração + seed demo rotulado.
- Autenticação (scrypt, JWT, refresh rotativo com detecção de reuso).
- RBAC por vínculo + isolamento por instituição + auditoria.
- Identidade visual, login, shell responsivo, painel com indicadores reais.
- Gestão de instituições (superadmin) e de vínculos/equipe.
- Testes de integração e documentação de arquitetura/LGPD.

## Fase 2 — Gestão institucional completa

- CRUD de estudantes e turmas (com importação CSV validada).
- Tela de perfil, troca de senha, recuperação por e-mail (token de uso único).
- Consentimento do responsável e termo de imagem (registro com data e versão).
- Direitos do titular: solicitação de acesso/correção/exclusão com fila de atendimento.
- Paginação e busca no servidor; logs de acesso a dado de estudante.

## Fase 3 — Módulos VIVASS

- CRUD de projetos e atividades por eixo (Vida, Valores, Aprendizado, Saúde,
  Sustentabilidade), com responsáveis, público-alvo e anexos.
- Painel biopsicossocial (BIO/PSICO/SOCIAL/AMBIENTAL) por interseção de ações — sem score.
- Campanhas e calendário por eixo; matéria educativa por eixo.
- Diário de atividade: participantes, evidências autorizadas, ocorrências.

## Fase 4 — Planejamento e execução

- Diagnóstico inicial (questionários com versionamento e anonimização de respostas).
- Planos de ação com metas, marcos, responsáveis e dependências.
- Cronograma integrado (calendário por instituição e por projeto).
- Avaliação participativa e registro de aprendizados.
- Fluxo de aprovação de planejamento pelo gestor.

## Fase 5 — Inteligência de gestão

- Relatórios institucionais em PDF (identidade VIVASS, gráficos, assinaturas) e Excel.
- Exportação assíncrona com fila e link assinado.
- Central de comunicados segmentada por perfil/turma.
- Biblioteca digital com categorias, versões e controle de acesso por eixo.
- Portal da família e do estudante (conteúdo e conquistas, sem dado sensível).
- Notificações (in-app; e-mail/WhatsApp como integração opcional).

## Fase 6 — Validação e endurecimento

- Testes E2E de fluxo (login → cadastro → plano → atividade → relatório) com Playwright.
- Teste de autorização por combinação perfil × rota (matriz automatizada).
- Auditoria de segurança (OWASP ASVS nível 2), revisão de dependências (`npm audit`).
- Teste de responsividade e acessibilidade (WCAG 2.2 AA) com axe.
- Carga: 10 mil estudantes por escola, 200 mil atividades, p95 do painel < 800 ms.
- Migração para PostgreSQL + backup/restore testado + runbook de incidente.
- Documentação final e treinamento de operação.

## Fase 7 — Expansão (opcional, sob demanda)

- Painel de secretarias (agregado por rede, sem ranking entre escolas).
- Aplicativo móvel (PWA primeiro).
- Assistente de IA para planos de ação — sempre como sugestão a adultos, nunca decisão
  sobre estudante.
- Integração com sistemas de gestão escolar (exportação/importação por API).
