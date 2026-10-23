import { describe, it, expect } from 'vitest'
import {
  formatHemerographicDate,
  formatEditionLabel,
  renderOgImage,
} from '../lib/og/generateOgImage'
import { GET as getOgEdition } from '../../app/api/og/[editionNumber]/route'
import { GET as getOgDefault } from '../../app/api/og/route'
import { NextRequest } from 'next/server'

describe('Ficha hemerográfica e imagen OG (Fase 6.1)', () => {
  it('formatHemerographicDate formatea la fecha en mayúsculas estilo prensa histórica', () => {
    const testDate = new Date(2026, 9, 23) // 23 de octubre de 2026 (viernes)
    const formatted = formatHemerographicDate(testDate)
    expect(formatted).toBe('VIERNES, 23 DE OCTUBRE DE 2026')
  })

  it('formatEditionLabel formatea el número de edición con relleno a 5 dígitos o diario', () => {
    expect(formatEditionLabel('142')).toBe('N.º 00142')
    expect(formatEditionLabel(5)).toBe('N.º 00005')
    expect(formatEditionLabel('today')).toBe('EDICIÓN DIARIA')
    expect(formatEditionLabel(undefined)).toBe('EDICIÓN DIARIA')
  })

  it('renderOgImage genera un objeto ImageResponse con opciones por defecto', () => {
    const response = renderOgImage()
    expect(response).toBeDefined()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('image/png')
  })

  it('renderOgImage acepta metadatos de jugador (rango, puntuación, tiempo, árbol)', () => {
    const response = renderOgImage({
      editionNumber: '142',
      author: 'Federico García Lorca',
      work: 'Romancero Gitano',
      year: 1928,
      rank: 'Gran Maestro',
      score: 950,
      precision: 98,
      time: '01m 45s',
      structure: '[ [ · ] [ · ] ]',
    })
    expect(response).toBeDefined()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('image/png')
  })

  it('GET /api/og/[editionNumber] responde con código 200 e imagen PNG', async () => {
    const req = new NextRequest('http://localhost:3000/api/og/142?rank=Maestro&score=850')
    const params = Promise.resolve({ editionNumber: '142' })
    const res = await getOgEdition(req, { params })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('image/png')
  })

  it('GET /api/og responde con código 200 e imagen PNG para la edición del día', async () => {
    const req = new NextRequest('http://localhost:3000/api/og')
    const res = await getOgDefault(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('image/png')
  })
})
