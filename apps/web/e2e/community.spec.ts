import { test, expect } from '@playwright/test'

test.describe('E2E: Creador de Retos y Juego Comunitario (Fase 7.3)', () => {
  test('Creador de retos → URL compartible → juego y resolución del reto', async ({ page }) => {
    // 1. Acceder al taller de creación de retos (/crear)
    await page.goto('/crear')
    await expect(page).toHaveTitle(/Creador de Retos/i)

    const textarea = page.locator('#markup-textarea')
    await expect(textarea).toBeVisible()

    // 2. Verificar que el markup por defecto está preconfigurado con soluciones inline
    await expect(textarea).toHaveValue(/\[región histórica donde cabalgaba Don Quijote\|Mancha\]/)

    // 3. Completar firma del autor y pulsar publicar
    const aliasInput = page.locator('#creator-alias')
    await aliasInput.fill('Linotipista E2E')

    const publishBtn = page.locator('#publish-challenge-btn')
    await expect(publishBtn).toBeVisible()
    await expect(publishBtn).toBeEnabled()
    await publishBtn.click()

    // 4. Verificar tarjeta de éxito y generación de URL única (/r/[shortId])
    const successTitle = page.locator('text=¡Reto Publicado con Éxito!')
    await expect(successTitle).toBeVisible({ timeout: 10000 })

    const playLink = page.locator('a:has-text("Jugar mi reto ahora →")')
    await expect(playLink).toBeVisible()

    const playHref = await playLink.getAttribute('href')
    expect(playHref).toBeTruthy()
    expect(playHref).toMatch(/^\/r\/[A-Za-z0-9_-]+$/)

    // 5. Navegar a la página de resolución del reto comunitario
    await playLink.click()
    await page.waitForURL(/\/r\/[A-Za-z0-9_-]+/)

    // 6. Verificar carga del juego comunitario
    const input = page.locator('#corchetes-answer-input')
    await expect(input).toBeVisible({ timeout: 10000 })

    // Resolver las dos pistas del reto por defecto:
    // Pista 1: "Mancha"
    await input.fill('Mancha')
    await page.locator('#corchetes-submit-btn').click()
    await expect(input).toHaveValue('')

    // Pista 2: "nombre"
    await input.fill('nombre')
    await page.locator('#corchetes-submit-btn').click()

    // 7. Verificar pantalla final del reto de la comunidad
    const endScreen = page.locator('section[aria-label="Resultado de la edición"]')
    await expect(endScreen).toBeVisible({ timeout: 5000 })

    // Comprobar presencia de opciones para compartir o volver al taller
    const copyBtn = page.locator('#corchetes-copy-cronica-btn')
    await expect(copyBtn).toBeVisible()
  })
})
