import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const PAGES = [
  { path: '/login', name: 'Login', skipAuth: true },
  { path: '/app/painel', name: 'Painel' },
  { path: '/app/instituicoes', name: 'Instituições' },
  { path: '/app/equipe', name: 'Equipe' },
  { path: '/app/estudantes', name: 'Estudantes' },
  { path: '/app/turmas', name: 'Turmas' },
  { path: '/app/projetos', name: 'Projetos' },
  { path: '/app/atividades', name: 'Atividades' },
  { path: '/app/eixos', name: 'Eixos' },
  { path: '/app/planos', name: 'Planos' },
  { path: '/app/diagnosticos', name: 'Diagnósticos' },
  { path: '/app/comunicados', name: 'Comunicados' },
  { path: '/app/biblioteca', name: 'Biblioteca' },
  { path: '/app/calendario', name: 'Calendário' },
  { path: '/app/relatorios', name: 'Relatórios' },
  { path: '/app/portal', name: 'Portal' },
  { path: '/app/solicitacoes', name: 'Solicitações' },
  { path: '/app/auditoria', name: 'Auditoria' },
]

async function loginAs(page, email) {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', 'Vivass@2026')
  await page.click('button[type=submit]')
  await page.waitForURL(/\/app\/(painel|portal)/)
}

for (const pageDef of PAGES) {
  test.describe(`Acessibilidade — ${pageDef.name}`, () => {
    test.use({ storageState: undefined })

    test('não viola WCAG 2.2 AA', async ({ page }) => {
      if (!pageDef.skipAuth) {
        await loginAs(page, 'gestor@vivass.demo')
      }
      await page.goto(pageDef.path)
      await page.waitForLoadState('networkidle')

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa', 'wcag21aa', 'best-practice'])
        .analyze()

      expect(accessibilityScanResults.violations).toEqual([])
    })

    test('tem foco visível em elementos interativos', async ({ page }) => {
      if (!pageDef.skipAuth) {
        await loginAs(page, 'gestor@vivass.demo')
      }
      await page.goto(pageDef.path)
      await page.waitForLoadState('networkidle')

      const focusable = await page.locator('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])').all()
      for (const el of focusable.slice(0, 5)) {
        await el.focus()
        const styles = await el.evaluate((node) => {
          const computed = window.getComputedStyle(node)
          return {
            outline: computed.outline,
            outlineOffset: computed.outlineOffset,
            boxShadow: computed.boxShadow,
          }
        })
        const hasFocusIndicator = styles.outline !== 'none' || styles.outlineOffset !== '0px' || styles.boxShadow !== 'none'
        expect(hasFocusIndicator).toBeTruthy()
      }
    })
  })
}

test.describe('Contraste e semântica global', () => {
  test('cores da marca atendem contraste AA', async ({ page }) => {
    await page.goto('/login')
    const results = await new AxeBuilder({ page })
      .withTags(['cat.color'])
      .analyze()
    expect(results.violations.filter(v => v.id === 'color-contrast')).toEqual([])
  })

  test('landmarks ARIA presentes nas páginas autenticadas', async ({ page }) => {
    await loginAs(page, 'gestor@vivass.demo')
    await page.goto('/app/painel')
    await page.waitForLoadState('networkidle')

    const main = page.locator('main')
    await expect(main).toHaveAttribute('id', 'conteudo')

    const nav = page.locator('nav[aria-label="Navegação principal"]')
    await expect(nav).toBeVisible()

    const header = page.locator('header')
    await expect(header).toBeVisible()

    const footer = page.locator('footer')
    await expect(footer).toBeVisible()
  })
})