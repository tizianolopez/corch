import { test, expect } from '@playwright/test'

test.describe('E2E: Experiencia de Juego y Resolución (Fase 7.3)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`))
    page.on('pageerror', (err) => console.log(`[BROWSER ERROR]: ${err.message}\n${err.stack}`))
    page.on('response', (res) => {
      if (res.status() >= 400) console.log(`[HTTP ${res.status()}]: ${res.url()}`)
    })
    // Resetear localStorage antes de cada prueba para arrancar estado limpio
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
  })

  test('Juego completo sin ayudas otorga rango Gran Maestro', async ({ page }) => {
    // 1. Verificar carga de la portada
    await expect(page).toHaveTitle(/Corchetes/i)
    const input = page.locator('#corchetes-answer-input')
    await expect(input).toBeVisible()

    // 2. Resolver n1 ("la patria de la samba..." -> "Brasil")
    await input.fill('Brasil')
    await page.locator('#corchetes-submit-btn').click()
    await expect(input).toHaveValue('')

    // 3. Resolver n3 ("campeonatos universales..." -> "mundiales")
    await input.fill('mundiales')
    await page.locator('#corchetes-submit-btn').click()
    await expect(input).toHaveValue('')

    // 4. Resolver n4 ("tantos introducidos..." -> "goles")
    await input.fill('goles')
    await page.locator('#corchetes-submit-btn').click()
    await expect(input).toHaveValue('')

    // 5. Resolver n2 ("delantero de Santos..." -> "Pelé")
    await input.fill('Pelé')
    await page.locator('#corchetes-submit-btn').click()

    // 6. Verificar cierre de edición
    const endScreen = page.locator('section[aria-label="Resultado de la edición"]')
    await expect(endScreen).toBeVisible({ timeout: 5000 })

    // Comprobar rango Gran Maestro (sin errores ni ayudas)
    await expect(endScreen).toContainText('Gran Maestro')

    // Comprobar presencia del botón "Copiar crónica"
    const copyBtn = page.locator('#corchetes-copy-cronica-btn')
    await expect(copyBtn).toBeVisible()
    await expect(copyBtn).toContainText('Copiar crónica')

    // Probar interacción de copiado
    await copyBtn.click()
    await expect(copyBtn).toContainText('Crónica copiada')
  })

  test('Error de respuesta muestra animación de shake y mensaje de error', async ({ page }) => {
    const input = page.locator('#corchetes-answer-input')
    await expect(input).toBeVisible()

    // Enviar respuesta incorrecta deliberada
    await input.fill('respuesta_invalida')
    await page.locator('#corchetes-submit-btn').click()

    // Comprobar que aparece el mensaje de error accesible
    const errorNotice = page.locator('text=Respuesta incorrecta')
    await expect(errorNotice).toBeVisible()

    // El input debe tener estado visual de error (clase inputError que activa el shake)
    await expect(input).toHaveAttribute('class', /inputError/)
  })

  test('Juego con ayudas otorga rango Cronista', async ({ page }) => {
    const input = page.locator('#corchetes-answer-input')
    await expect(input).toBeVisible()

    // 1. Usar pista de matriz (-8 pts)
    const hintMatrixBtn = page.locator('#corchetes-hint-matrix-btn')
    await expect(hintMatrixBtn).toBeVisible()
    await hintMatrixBtn.click()

    // 2. Usar pista de revelación para el nodo activo (-15 pts)
    const hintRevealBtn = page.locator('#corchetes-hint-reveal-btn')
    await expect(hintRevealBtn).toBeVisible()
    await hintRevealBtn.click()

    // Resolver los nodos restantes de forma limpia:
    // Resolver n3 ("mundiales")
    await input.fill('mundiales')
    await page.locator('#corchetes-submit-btn').click()
    await expect(input).toHaveValue('')

    // Resolver n4 ("goles")
    await input.fill('goles')
    await page.locator('#corchetes-submit-btn').click()
    await expect(input).toHaveValue('')

    // Resolver n2 ("Pelé")
    await input.fill('Pelé')
    await page.locator('#corchetes-submit-btn').click()

    // 5. Verificar pantalla final y rango Cronista (100 - 8 - 15 = 77 pts, entre 65 y 84)
    const endScreen = page.locator('section[aria-label="Resultado de la edición"]')
    await expect(endScreen).toBeVisible({ timeout: 5000 })
    await expect(endScreen).toContainText('Cronista')

    // Verificar que la crónica muestra el símbolo de término revelado (†)
    const copyBtn = page.locator('#corchetes-copy-cronica-btn')
    await expect(copyBtn).toBeVisible()
  })
})
