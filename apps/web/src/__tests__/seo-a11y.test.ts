import { describe, it, expect } from 'vitest'
import sitemap from '../../app/sitemap'
import robots from '../../app/robots'
import { JsonLd } from '../components/JsonLd'

/**
 * Función para calcular la luminancia relativa según WCAG 2.1
 */
function getLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '')
  const r = parseInt(cleanHex.slice(0, 2), 16) / 255
  const g = parseInt(cleanHex.slice(2, 4), 16) / 255
  const b = parseInt(cleanHex.slice(4, 6), 16) / 255

  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

/**
 * Calcula el ratio de contraste entre dos colores HEX
 */
function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getLuminance(hex1)
  const lum2 = getLuminance(hex2)
  const brightest = Math.max(lum1, lum2)
  const darkest = Math.min(lum1, lum2)
  return (brightest + 0.05) / (darkest + 0.05)
}

describe('SEO y Accesibilidad (Fase 7.2)', () => {
  describe('SEO — Sitemap y Robots', () => {
    it('sitemap() genera la lista de URLs indexables con prioridades y frecuencias', () => {
      const entries = sitemap()
      expect(entries).toBeDefined()
      expect(entries.length).toBeGreaterThanOrEqual(2)

      const homeEntry = entries.find((e) => e.url === 'https://corchetes.es' || e.url.endsWith('corchetes.es'))
      expect(homeEntry).toBeDefined()
      expect(homeEntry?.priority).toBe(1.0)
      expect(homeEntry?.changeFrequency).toBe('daily')

      const crearEntry = entries.find((e) => e.url.includes('/crear'))
      expect(crearEntry).toBeDefined()
      expect(crearEntry?.priority).toBe(0.8)
      expect(crearEntry?.changeFrequency).toBe('monthly')
    })

    it('robots() configura las directivas de indexación y referencia al sitemap', () => {
      const config = robots()
      expect(config.rules).toBeDefined()
      expect(config.sitemap).toContain('/sitemap.xml')

      const rules = Array.isArray(config.rules) ? config.rules[0] : config.rules
      expect(rules?.allow).toBe('/')
      expect(rules?.disallow).toContain('/api/auth/')
    })
  })

  describe('SEO — Schema.org JSON-LD', () => {
    it('JsonLd genera marcado estructurado válido de WebApplication y Game', () => {
      const element = JsonLd()
      expect(element).toBeDefined()
      const jsonString = (element.props as any).dangerouslySetInnerHTML.__html
      expect(jsonString).toBeDefined()

      const data = JSON.parse(jsonString)
      expect(data['@context']).toBe('https://schema.org')
      expect(data['@graph']).toBeDefined()

      interface SchemaItem {
        '@type': string
        name?: string
        applicationCategory?: string
        inLanguage?: string
        genre?: string[]
        offers?: { price: string }
      }

      const webApp = (data['@graph'] as SchemaItem[]).find(
        (item) => item['@type'] === 'WebApplication',
      )
      expect(webApp).toBeDefined()
      expect(webApp?.name).toBe('Corchetes')
      expect(webApp?.applicationCategory).toBe('GameApplication')
      expect(webApp?.inLanguage).toBe('es')
      expect(webApp?.genre).toContain('Juego de palabras')
      expect(webApp?.offers?.price).toBe('0')
    })
  })

  describe('Accesibilidad WCAG 2.1 AA — Ratios de Contraste', () => {
    const COLOR_PAPER = '#F7F4EF'
    const COLOR_INK = '#1A1917'
    const COLOR_ACCENT_INK = '#8B2500'

    it('el contraste entre tinta (#1A1917) y papel (#F7F4EF) supera 13:1 (cumple WCAG AAA)', () => {
      const ratio = getContrastRatio(COLOR_PAPER, COLOR_INK)
      // WCAG AA requiere 4.5:1 para texto normal, AAA requiere 7:1
      expect(ratio).toBeGreaterThan(13.0)
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    })

    it('el contraste entre tinta almagre (#8B2500) y papel (#F7F4EF) supera 7:1 (cumple WCAG AAA)', () => {
      const ratio = getContrastRatio(COLOR_PAPER, COLOR_ACCENT_INK)
      expect(ratio).toBeGreaterThan(7.0)
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    })
  })
})
