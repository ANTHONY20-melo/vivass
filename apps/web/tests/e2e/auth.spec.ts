import { test, expect } from '@playwright/test'

test.describe('Autenticação e sessão', () => {
  test('login com credenciais válidas redireciona ao painel', async ({ page }) => {
    await page.goto('/login')
    await page.fill('#email', 'gestor@vivass.demo')
    await page.fill('#password', 'Vivass@2026')
    await page.click('button[type=submit]')
    await expect(page).toHaveURL(/\/app\/painel/)
    await expect(page.locator('h1')).toContainText('Painel da instituição')
  })

  test('login com senha incorreta mostra erro genérico', async ({ page }) => {
    await page.goto('/login')
    await page.fill('#email', 'gestor@vivass.demo')
    await page.fill('#password', 'senha-errada')
    await page.click('button[type=submit]')
    await expect(page.locator('[role=alert]')).toContainText('E-mail ou senha inválidos')
  })

  test('logout encerra a sessão e volta ao login', async ({ page }) => {
    await page.goto('/login')
    await page.fill('#email', 'gestor@vivass.demo')
    await page.fill('#password', 'Vivass@2026')
    await page.click('button[type=submit]')
    await expect(page).toHaveURL(/\/app\/painel/)
    await page.click('button[aria-label="Sair da plataforma"]')
    await expect(page).toHaveURL('/login')
  })

  test('rota protegida sem sessão redireciona ao login', async ({ page }) => {
    await page.goto('/app/painel')
    await expect(page).toHaveURL('/login')
  })
})

test.describe('Troca de instituição (superadmin)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('#email', 'admin@vivass.demo')
    await page.fill('#password', 'Vivass@2026')
    await page.click('button[type=submit]')
    await expect(page).toHaveURL(/\/app\/painel/)
  })

  test('seletor no header troca a instituição ativa', async ({ page }) => {
    await page.goto('/app/instituicoes')
    await expect(page.locator('table')).toBeVisible()
    const firstName = await page.locator('tbody tr').first().locator('td').first().textContent()
    await page.selectOption('header select', { index: 1 })
    await page.goto('/app/painel')
    await expect(page.locator('h1')).toContainText('Painel da instituição')
  })

  test('seletor na sidebar troca a instituição ativa', async ({ page }) => {
    await page.goto('/app/instituicoes')
    await page.selectOption('#institution-switch-sidebar', { index: 1 })
    await page.goto('/app/painel')
    await expect(page.locator('h1')).toContainText('Painel da instituição')
  })
})