import { test, expect } from '@playwright/test'

async function login(page, email) {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', 'Vivass@2026')
  await page.click('button[type=submit]')
  await page.waitForURL(/\/app\/(painel|portal)/)
}

test.describe('Fluxo completo: login → cadastro → plano → atividade → relatório', () => {
  test('gestor cria estudante, projeto, plano, atividade e gera relatório', async ({ page }) => {
    // 1. Login
    await login(page, 'gestor@vivass.demo')
    await expect(page.locator('h1')).toContainText('Painel da instituição')

    // 2. Criar estudante
    await page.goto('/app/estudantes')
    await page.click('button:has-text("Novo estudante")')
    await page.fill('#student-name', 'Estudante E2E Teste')
    await page.fill('#student-birth', '2013-05-10')
    await page.fill('#student-guardian', 'Responsável E2E')
    await page.fill('#student-phone', '19988887777')
    await page.click('button[type=submit]:has-text("Salvar")')
    await expect(page.locator('text=Estudante salvo com sucesso')).toBeVisible()

    // 3. Criar projeto
    await page.goto('/app/projetos')
    await page.click('button:has-text("Novo projeto")')
    await page.fill('#project-name', 'Projeto E2E Teste')
    await page.fill('#project-description', 'Descrição do projeto de teste E2E')
    await page.fill('#project-objective', 'Objetivo do projeto de teste')
    await page.selectOption('#project-axis', 'VIDA')
    await page.selectOption('#project-dimension', 'BIO')
    await page.selectOption('#project-status', 'ACTIVE')
    await page.click('button[type=submit]:has-text("Salvar")')
    await expect(page.locator('text=Projeto salvo com sucesso')).toBeVisible()

    // 4. Criar plano de ação
    await page.goto('/app/planos')
    await page.click('button:has-text("Novo plano")')
    await page.fill('#plan-title', 'Plano E2E Teste')
    await page.fill('#plan-objective', 'Objetivo do plano de ação E2E')
    await page.selectOption('#plan-axis', 'VIDA')
    await page.fill('#plan-responsible', 'Gestor E2E')
    await page.fill('#plan-start', '2026-11-26')
    await page.fill('#plan-due', '2026-12-26')
    await page.click('button[type=submit]:has-text("Criar plano")')
    await expect(page.locator('text=Plano de ação criado')).toBeVisible()

    // Adicionar marco ao plano
    await page.locator('input[placeholder="Novo marco"]').fill('Marco E2E')
    await page.click('button:has-text("Adicionar")')
    await expect(page.locator('text=Marco E2E')).toBeVisible()

    // 5. Criar atividade vinculada ao projeto
    await page.goto('/app/atividades')
    await page.click('button:has-text("Nova atividade")')
    await page.fill('#activity-title', 'Atividade E2E Teste')
    await page.fill('#activity-description', 'Descrição da atividade de teste')
    await page.selectOption('#activity-project', { label: /Projeto E2E Teste/ })
    await page.selectOption('#activity-axis', 'VIDA')
    await page.selectOption('#activity-dimension', 'BIO')
    await page.selectOption('#activity-status', 'COMPLETED')
    await page.fill('#activity-date', '2026-11-26')
    await page.fill('#activity-participants', '30')
    await page.click('button[type=submit]:has-text("Salvar")')
    await expect(page.locator('text=Atividade salva com sucesso')).toBeVisible()

    // 6. Gerar relatório PDF
    await page.goto('/app/relatorios')
    await page.selectOption('select', '180')
    const downloadPromise = page.waitForEvent('download')
    await page.click('button:has-text("Relatório em PDF")')
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/vivass-relatorio.*\.pdf$/)

    // 7. Gerar relatório Excel
    const downloadPromise2 = page.waitForEvent('download')
    await page.click('button:has-text("Planilha Excel")')
    const download2 = await downloadPromise2
    expect(download2.suggestedFilename()).toMatch(/vivass-relatorio.*\.xlsx$/)
  })
})

test.describe('Fluxo família/estudante: login → portal', () => {
  test('família acessa portal e vê comunicados e atividades', async ({ page }) => {
    await login(page, 'familia@vivass.demo')
    await expect(page).toHaveURL('/app/portal')
    await expect(page.locator('h1')).toContainText('Portal de')

    // Ver comunicados
    await expect(page.locator('text=Comunicados')).toBeVisible()

    // Ver próximas atividades
    await expect(page.locator('text=Próximas atividades')).toBeVisible()

    // Ver biblioteca
    await expect(page.locator('text=Materiais da biblioteca')).toBeVisible()
  })

  test('estudante acessa portal', async ({ page }) => {
    await login(page, 'aluno@vivass.demo')
    await expect(page).toHaveURL('/app/portal')
    await expect(page.locator('h1')).toContainText('Portal de')
  })
})