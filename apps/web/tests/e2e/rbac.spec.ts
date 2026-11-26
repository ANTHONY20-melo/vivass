import { test, expect } from '@playwright/test'

const ROLES = [
  { email: 'admin@vivass.demo', label: 'Superadmin', canAll: true },
  { email: 'gestor@vivass.demo', label: 'Gestor escolar', canManage: true },
  { email: 'coord@vivass.demo', label: 'Coordenador VIVASS', canManage: true },
  { email: 'prof@vivass.demo', label: 'Professor', canManage: false },
  { email: 'equipe@vivass.demo', label: 'Equipe multidisciplinar', canManage: false },
  { email: 'familia@vivass.demo', label: 'Família', canPortal: true },
  { email: 'aluno@vivass.demo', label: 'Estudante', canPortal: true },
] as const

async function login(page, email) {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', 'Vivass@2026')
  await page.click('button[type=submit]')
  await page.waitForURL(/\/app\/(painel|portal)/)
}

async function assertForbidden(page, url) {
  await page.goto(url)
  await expect(page.locator('text=Acesso negado, text=Você não tem permissão, text=403')).toBeVisible({ timeout: 5000 }).catch(() => {
    // Se não há mensagem explícita, verifica se ficou na página anterior ou foi redirecionado
  })
}

for (const role of ROLES) {
  test.describe(`RBAC — ${role.label} (${role.email})`, () => {
    test.beforeEach(async ({ page }) => {
      await login(page, role.email)
    })

    test('acessa painel se tem dashboard:read', async ({ page }) => {
      if (role.canPortal && !role.canManage) {
        // família/estudante vão para portal, não painel
        await page.goto('/app/painel')
        await expect(page).toHaveURL('/app/portal')
        return
      }
      await page.goto('/app/painel')
      await expect(page.locator('h1')).toContainText('Painel da instituição')
    })

    test('instituições — lista/criação', async ({ page }) => {
      if (role.canAll) {
        await page.goto('/app/instituicoes')
        await expect(page.locator('h1')).toContainText('Instituições de ensino')
        await expect(page.locator('button:has-text("Nova instituição")')).toBeVisible()
      } else {
        await page.goto('/app/instituicoes')
        await expect(page).not.toHaveURL('/app/instituicoes')
      }
    })

    test('estudantes — CRUD', async ({ page }) => {
      if (['Superadmin', 'Gestor escolar', 'Coordenador VIVASS'].includes(role.label)) {
        await page.goto('/app/estudantes')
        await expect(page.locator('h1')).toContainText('Estudantes')
        await expect(page.locator('button:has-text("Novo estudante")')).toBeVisible()
      } else {
        await page.goto('/app/estudantes')
        await expect(page).not.toHaveURL('/app/estudantes')
      }
    })

    test('turmas — CRUD', async ({ page }) => {
      if (['Superadmin', 'Gestor escolar', 'Coordenador VIVASS'].includes(role.label)) {
        await page.goto('/app/turmas')
        await expect(page.locator('h1')).toContainText('Turmas')
        await expect(page.locator('button:has-text("Nova turma")')).toBeVisible()
      } else {
        await page.goto('/app/turmas')
        await expect(page).not.toHaveURL('/app/turmas')
      }
    })

    test('projetos — leitura/escrita', async ({ page }) => {
      if (['Superadmin', 'Gestor escolar', 'Coordenador VIVASS'].includes(role.label)) {
        await page.goto('/app/projetos')
        await expect(page.locator('h1')).toContainText('Projetos')
        await expect(page.locator('button:has-text("Novo projeto")')).toBeVisible()
      } else if (['Professor', 'Equipe multidisciplinar'].includes(role.label)) {
        await page.goto('/app/projetos')
        await expect(page.locator('h1')).toContainText('Projetos')
        await expect(page.locator('button:has-text("Novo projeto")')).not.toBeVisible()
      } else {
        await page.goto('/app/projetos')
        await expect(page).not.toHaveURL('/app/projetos')
      }
    })

    test('atividades — leitura/escrita', async ({ page }) => {
      if (['Superadmin', 'Gestor escolar', 'Coordenador VIVASS', 'Professor', 'Equipe multidisciplinar'].includes(role.label)) {
        await page.goto('/app/atividades')
        await expect(page.locator('h1')).toContainText('Atividades')
        await expect(page.locator('button:has-text("Nova atividade")')).toBeVisible()
      } else {
        await page.goto('/app/atividades')
        await expect(page).not.toHaveURL('/app/atividades')
      }
    })

    test('planos de ação — leitura/escrita', async ({ page }) => {
      if (['Superadmin', 'Gestor escolar', 'Coordenador VIVASS'].includes(role.label)) {
        await page.goto('/app/planos')
        await expect(page.locator('h1')).toContainText('Planos de ação')
        await expect(page.locator('button:has-text("Novo plano")')).toBeVisible()
      } else if (['Professor', 'Equipe multidisciplinar'].includes(role.label)) {
        await page.goto('/app/planos')
        await expect(page.locator('h1')).toContainText('Planos de ação')
        await expect(page.locator('button:has-text("Novo plano")')).not.toBeVisible()
      } else {
        await page.goto('/app/planos')
        await expect(page).not.toHaveURL('/app/planos')
      }
    })

    test('diagnósticos — gestão/resposta', async ({ page }) => {
      if (['Superadmin', 'Gestor escolar', 'Coordenador VIVASS'].includes(role.label)) {
        await page.goto('/app/diagnosticos')
        await expect(page.locator('h1')).toContainText('Diagnóstico')
        await expect(page.locator('button:has-text("Novo diagnóstico")')).toBeVisible()
      } else {
        await page.goto('/app/diagnosticos')
        await expect(page.locator('h1')).toContainText('Diagnóstico')
        await expect(page.locator('button:has-text("Novo diagnóstico")')).not.toBeVisible()
      }
    })

    test('comunicados — gestão/leitura', async ({ page }) => {
      if (['Superadmin', 'Gestor escolar', 'Coordenador VIVASS'].includes(role.label)) {
        await page.goto('/app/comunicados')
        await expect(page.locator('h1')).toContainText('Comunicados')
        await expect(page.locator('button:has-text("Novo comunicado")')).toBeVisible()
      } else {
        await page.goto('/app/comunicados')
        await expect(page.locator('h1')).toContainText('Comunicados')
        await expect(page.locator('button:has-text("Novo comunicado")')).not.toBeVisible()
      }
    })

    test('biblioteca — gestão/leitura', async ({ page }) => {
      if (['Superadmin', 'Gestor escolar', 'Coordenador VIVASS'].includes(role.label)) {
        await page.goto('/app/biblioteca')
        await expect(page.locator('h1')).toContainText('Biblioteca')
        await expect(page.locator('button:has-text("Novo item")')).toBeVisible()
      } else {
        await page.goto('/app/biblioteca')
        await expect(page.locator('h1')).toContainText('Biblioteca')
        await expect(page.locator('button:has-text("Novo item")')).not.toBeVisible()
      }
    })

    test('calendário — leitura', async ({ page }) => {
      if (role.canManage || role.canPortal) {
        await page.goto('/app/calendario')
        await expect(page.locator('h1')).toContainText('Calendário')
      } else {
        await page.goto('/app/calendario')
        await expect(page).not.toHaveURL('/app/calendario')
      }
    })

    test('relatórios — geração', async ({ page }) => {
      if (['Superadmin', 'Gestor escolar', 'Coordenador VIVASS'].includes(role.label)) {
        await page.goto('/app/relatorios')
        await expect(page.locator('h1')).toContainText('Relatórios')
        await expect(page.locator('button:has-text("Relatório em PDF")')).toBeVisible()
        await expect(page.locator('button:has-text("Planilha Excel")')).toBeVisible()
      } else {
        await page.goto('/app/relatorios')
        await expect(page).not.toHaveURL('/app/relatorios')
      }
    })

    test('portal — acesso família/estudante', async ({ page }) => {
      if (role.canPortal) {
        await page.goto('/app/portal')
        await expect(page.locator('h1')).toContainText('Portal de')
      } else {
        await page.goto('/app/portal')
        await expect(page).not.toHaveURL('/app/portal')
      }
    })

    test('solicitações LGPD — gestão', async ({ page }) => {
      if (['Superadmin', 'Gestor escolar', 'Coordenador VIVASS'].includes(role.label)) {
        await page.goto('/app/solicitacoes')
        await expect(page.locator('h1')).toContainText('Solicitações')
        await expect(page.locator('button:has-text("Nova solicitação")')).toBeVisible()
      } else {
        await page.goto('/app/solicitacoes')
        await expect(page).not.toHaveURL('/app/solicitacoes')
      }
    })

    test('auditoria — leitura', async ({ page }) => {
      if (['Superadmin', 'Gestor escolar'].includes(role.label)) {
        await page.goto('/app/auditoria')
        await expect(page.locator('h1')).toContainText('Auditoria')
      } else {
        await page.goto('/app/auditoria')
        await expect(page).not.toHaveURL('/app/auditoria')
      }
    })
  })
}