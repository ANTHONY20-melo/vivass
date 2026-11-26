# VIVASS — Proteção de dados e LGPD

> Documento de engenharia, não parecer jurídico. A validação final com o encarregado de
> dados (DPO) da rede de ensino é obrigatória antes de operar com dados reais.

## 1. Princípios aplicados

| Princípio (LGPD) | Como aparece no sistema |
|---|---|
| Finalidade | cada campo tem uso declarado no modelo; nada é coletado "para o futuro" |
| Minimização | estudante tem nome, nascimento, responsável e turma — sem saúde, sem biometria, sem endereço |
| Adequação | o painel só devolve agregados por instituição |
| Transparência | aviso de ambiente de demonstração; política de retenção documentada |
| Segurança | scrypt, refresh hasheado, RBAC, isolamento por instituição, auditoria |
| Prestação de contas | `AuditLog` com ator, ação, entidade, IP e data |
| Não discriminação | **proibido** score automático de estudante ou inferência de transtorno |

## 2. Dados tratados na Fase 1

| Entidade | Dados pessoais | Base legal prevista | Retenção |
|---|---|---|---|
| User | nome, e-mail, hash de senha, último acesso | execução de contrato / legítimo interesse | enquanto o vínculo existir + 1 ano |
| Membership | papel na instituição | obrigação legal/contratual | idem |
| Student | nome, data de nascimento, nome do responsável, turma | consentimento do responsável + obrigação legal | 1 ano após o ciclo, salvo obrigação de guarda |
| AuditLog | ator, IP, ação | obrigação legal / segurança | 2 anos |
| RefreshToken | hash do token, user agent, IP | segurança | 30 dias ou revogação |

**Crianças e adolescentes:** o sistema não cria login de estudante sem vínculo institucional
autorizado; dados de menores nunca aparecem em tela pública; o portal do estudante (Fase 5)
será limitado a conteúdo e conquistas, sem dados de saúde.

## 3. O que o sistema faz hoje

- Senhas com scrypt (salt por usuário, comparação em tempo constante).
- Refresh token armazenado apenas como SHA-256; cookie `httpOnly` restrito a `/api/auth`.
- Autorização por vínculo, verificada no servidor em toda requisição.
- Isolamento de instituição testado automaticamente (teste de vazamento entre escolas).
- Erros de login genéricos e com tempo equalizado (anti-enumeração).
- Rate limit em login e global; Helmet/CSP em produção.
- Logs sem `authorization`/`cookie`.
- Auditoria de criação de instituição, criação de vínculo, login e logout.
- Seed inteiramente fictício e rotulado na interface (`Ambiente de demonstração`).
- Nenhum endpoint público de estudante; painel só com agregados.

## 4. Lacunas conhecidas (por fase)

| Lacuna | Fase | Mitigação atual |
|---|---|---|
| Tela de consentimento do responsável | 2 | vínculo só é criado por gestor autorizado; termo assinado fora do sistema |
| Direito de acesso/correção/exclusão pelo titular | 2 | atendimento manual pelo gestor + auditoria |
| Criptografia em repouso de campos sensíveis | 2–3 | SQLite local; produção exige disco criptografado/PostgreSQL gerenciado |
| Anexos com controle de acesso | 4 | ainda não há upload |
| Registro de acesso a dado de saúde | 3 | modelo de saúde ainda não existe |
| Política de retenção automatizada (job de expurgo) | 6 | documentada, execução manual |
| Plano de resposta a incidente | 6 | esboço abaixo |

## 5. Esboço de resposta a incidente

1. **Detectar**: alerta de 5xx, pico de `AUTH_LOGIN_FAILED`, revisão de `AuditLog`.
2. **Conter**: revogar todos os refresh tokens (`updateMany revokedAt`), rotacionar
   `JWT_SECRET`, bloquear usuário (`status = BLOCKED`).
3. **Avaliar**: quais entidades/dados foram expostos, por instituição.
4. **Comunicar**: DPO e gestores das escolas afetadas em prazo compatível com a LGPD.
5. **Corrigir**: causa raiz + teste de regressão.
6. **Registrar**: post-mortem sem dados pessoais no documento.

## 6. Regras de desenvolvimento que não se negociam

1. Dado pessoal novo exige justificativa, base legal e campo de retenção.
2. Nenhum endpoint devolve lista de estudantes para perfil sem `student:read`.
3. Nenhum indicador público compara escolas por desempenho individual.
4. Nenhum log recebe senha, token, cookie ou dado de saúde.
5. Nenhuma decisão automatizada sobre estudante — IA apenas sugere conteúdo a adultos.
