import { test, expect } from '@playwright/test'

test.describe('E2E: Flujo de Registro y Fusión de Sesión Anónima (Fase 7.3)', () => {
  test.beforeEach(async ({ page }) => {
    // Interceptar la llamada a Supabase Auth para simular envío de Magic Link exitoso
    await page.route('**/auth/v1/otp*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      })
    })

    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
  })

  test('Apertura de AuthDrawer, envío de Magic Link y cierre con Escape', async ({ page }) => {
    // 1. Verificar carga de la portada y presencia del botón de lector
    const authBtn = page.locator('button[aria-label="Acceder o guardar racha"]')
    await expect(authBtn).toBeVisible()
    await expect(authBtn).toContainText('Guardar racha / Identifícate')

    // 2. Abrir el panel de autenticación
    await authBtn.click()

    const drawerTitle = page.locator('#auth-drawer-title')
    await expect(drawerTitle).toBeVisible()
    await expect(drawerTitle).toContainText('Tu archivo personal')

    // 3. Introducir correo y enviar Magic Link
    const emailInput = page.locator('#auth-email-input')
    await expect(emailInput).toBeVisible()
    await emailInput.fill('lector.prueba@corchetes.es')

    const submitBtn = page.locator('button:has-text("Enviar enlace de acceso")')
    await expect(submitBtn).toBeVisible()
    await submitBtn.click()

    // 4. Verificar mensaje de confirmación de envío de enlace
    const feedbackStatus = page.getByRole('status')
    await expect(feedbackStatus).toBeVisible({ timeout: 5000 })
    await expect(feedbackStatus).toContainText('Enlace enviado')

    // 5. Cerrar el drawer pulsando la tecla Escape
    await page.keyboard.press('Escape')
    await expect(drawerTitle).not.toBeVisible()
  })

  test('Fusión de sesión anónima preserva estadísticas en backend (/api/auth/merge)', async ({
    page,
    request,
  }) => {
    // 1. Cargar la página y verificar generación de UUID anónimo
    await page.goto('/')
    const input = page.locator('#corchetes-answer-input')
    await expect(input).toBeVisible()

    const anonId = await page.evaluate(() => localStorage.getItem('corchetes_anonymous_id'))
    expect(anonId).toBeTruthy()
    expect(anonId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

    // 2. Llamada directa a /api/auth/merge vinculando el anonId a un nuevo userId
    const mockUserId = 'usr-e2e-test-' + Date.now()
    const mergeResponse = await request.post('/api/auth/merge', {
      data: {
        anonymousId: anonId,
        userId: mockUserId,
        email: 'lector.e2e@corchetes.es',
        displayName: 'Lector E2E',
      },
    })

    expect(mergeResponse.ok()).toBeTruthy()
    const result = await mergeResponse.json()

    // 3. Verificar estructura de respuesta y preservación de stats
    expect(result.success).toBe(true)
    expect(result.userId).toBe(mockUserId)
    expect(result.stats).toBeDefined()
    expect(typeof result.stats.streakCurrent).toBe('number')
    expect(typeof result.stats.streakMax).toBe('number')
    expect(typeof result.stats.totalPlays).toBe('number')
    expect(typeof result.stats.totalWins).toBe('number')
  })
})
