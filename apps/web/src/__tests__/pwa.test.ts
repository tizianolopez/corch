import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import manifest from '../../app/manifest'

describe('PWA y Soporte Offline (Fase 7.1)', () => {
  it('manifest() genera un Web App Manifest válido para instalación standalone', () => {
    const m = manifest()

    expect(m.name).toBe('Corchetes — El juego de reconstrucción léxica')
    expect(m.short_name).toBe('Corchetes')
    expect(m.start_url).toBe('/')
    expect(m.display).toBe('standalone')
    expect(m.background_color).toBe('#F7F4EF')
    expect(m.theme_color).toBe('#F7F4EF')
    expect(m.lang).toBe('es')

    expect(m.icons).toBeDefined()
    expect(m.icons?.length).toBeGreaterThanOrEqual(3)

    const icon192 = m.icons?.find((i) => i.sizes === '192x192')
    expect(icon192).toBeDefined()
    expect(icon192?.src).toBe('/icons/icon-192.svg')

    const icon512 = m.icons?.find((i) => i.sizes === '512x512' && i.purpose !== 'maskable')
    expect(icon512).toBeDefined()
    expect(icon512?.src).toBe('/icons/icon-512.svg')

    const iconMaskable = m.icons?.find((i) => i.purpose === 'maskable')
    expect(iconMaskable).toBeDefined()
    expect(iconMaskable?.src).toBe('/icons/icon-maskable.svg')
  })

  it('los archivos de iconos existen físicamente en public/icons', () => {
    const publicDir = path.resolve(__dirname, '../../public/icons')
    expect(fs.existsSync(path.join(publicDir, 'icon-192.svg'))).toBe(true)
    expect(fs.existsSync(path.join(publicDir, 'icon-512.svg'))).toBe(true)
    expect(fs.existsSync(path.join(publicDir, 'icon-maskable.svg'))).toBe(true)
  })

  it('el Service Worker sw.js existe en public y contiene las estrategias de caché', () => {
    const swPath = path.resolve(__dirname, '../../public/sw.js')
    expect(fs.existsSync(swPath)).toBe(true)

    const swContent = fs.readFileSync(swPath, 'utf-8')
    // Comprobar eventos esenciales del Service Worker
    expect(swContent).toContain("addEventListener('install'")
    expect(swContent).toContain("addEventListener('activate'")
    expect(swContent).toContain("addEventListener('fetch'")

    // Comprobar estrategia para el puzle diario
    expect(swContent).toContain('/api/puzzle/today')
    expect(swContent).toContain('corchetes-daily')

    // Comprobar precache de la shell
    expect(swContent).toContain("'/manifest.webmanifest'")
    expect(swContent).toContain("'/'")
  })
})
