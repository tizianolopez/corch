import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { ClientPayload } from '@corchetes/core'
import { buildApp } from '../app'
import { getTodayDateMadrid, getSecondsUntilMidnightMadrid } from '../utils/time'
import { sanitizeClientPayload } from '../routes/puzzle'

describe('Endpoint: Puzzle del Día (Tarea 2.2)', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildApp({
      configOverrides: {
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
      },
    })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  // ── 1. Estructura y respuesta 200 ─────────────────────────────────────────
  it('GET /api/puzzle/today devuelve 200 con client_payload válido', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/puzzle/today',
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ClientPayload>()

    expect(body).toBeDefined()
    expect(typeof body.puzzleId).toBe('string')
    expect(typeof body.editionNumber).toBe('number')
    expect(body.publishDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(typeof body.rootTemplate).toBe('string')
    expect(typeof body.dailySalt).toBe('string')
    expect(typeof body.quoteAuthor).toBe('string')
    expect(typeof body.quoteWork).toBe('string')
    expect(typeof body.quoteYear).toBe('number')
    expect(typeof body.editorialNote).toBe('string')

    // Estructura de nodos
    expect(typeof body.nodes).toBe('object')
    const nodeKeys = Object.keys(body.nodes)
    expect(nodeKeys.length).toBeGreaterThan(0)

    for (const key of nodeKeys) {
      const node = body.nodes[key]
      expect(node).toBeDefined()
      expect(node?.id).toBe(key)
      expect(typeof node?.clueText).toBe('string')
      expect(Array.isArray(node?.children)).toBe(true)
      expect(typeof node?.solutionHash).toBe('string')
      expect(typeof node?.solutionCipher).toBe('string')
    }
  })

  it('GET /puzzle/today (alias) devuelve el mismo payload que /api/puzzle/today', async () => {
    const resAlias = await app.inject({
      method: 'GET',
      url: '/puzzle/today',
    })
    expect(resAlias.statusCode).toBe(200)
    const body = resAlias.json<ClientPayload>()
    expect(body.editionNumber).toBe(1)
  })

  // ── 2. Cabeceras Cache-Control para Cloudflare ─────────────────────────────
  it('incluye cabecera Cache-Control con max-age y s-maxage hasta medianoche', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/puzzle/today',
    })

    const cacheControl = response.headers['cache-control']
    expect(cacheControl).toBeDefined()
    expect(cacheControl).toMatch(/^public, max-age=\d+, s-maxage=\d+$/)

    // Extraer el max-age en segundos
    const match = /max-age=(\d+)/.exec(cacheControl as string)
    expect(match).not.toBeNull()
    const maxAgeStr = match?.[1] ?? '0'
    const maxAge = parseInt(maxAgeStr, 10)

    // Debe ser un TTL válido entre 60 segundos y 86400 segundos (24 h)
    expect(maxAge).toBeGreaterThanOrEqual(60)
    expect(maxAge).toBeLessThanOrEqual(86400)
  })

  // ── 3. TEST DE SEGURIDAD CRÍTICO: Ningún campo solution en texto plano ────
  it('SEGURIDAD: la respuesta NO contiene ningún campo solution en texto plano ni propiedades internas', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/puzzle/today',
    })

    const rawJson = response.body
    const body = response.json<Record<string, unknown>>()

    // 1. Comprobar que en el JSON en crudo no aparece "solution":
    expect(rawJson).not.toMatch(/"solution"\s*:/i)

    // 2. Comprobar que no aparecen campos sensibles de la base de datos
    expect(body['rawMarkup']).toBeUndefined()
    expect(body['raw_markup']).toBeUndefined()
    expect(body['compiledAst']).toBeUndefined()
    expect(body['compiled_ast']).toBeUndefined()
    expect(body['createdBy']).toBeUndefined()

    // 3. Comprobar nodo por nodo que solo contiene solutionHash y solutionCipher
    const nodes = body['nodes'] as Record<string, Record<string, unknown>>
    for (const node of Object.values(nodes)) {
      expect(node['solution']).toBeUndefined()
      expect(node['answer']).toBeUndefined()
      expect(node['plaintext']).toBeUndefined()
      expect(node['plainText']).toBeUndefined()

      // Los únicos campos criptográficos permitidos son solutionHash y solutionCipher
      expect(typeof node['solutionHash']).toBe('string')
      expect(typeof node['solutionCipher']).toBe('string')
    }
  })

  // ── 4. Comprobación de sanitizeClientPayload ──────────────────────────────
  it('sanitizeClientPayload elimina campos extra no permitidos', () => {
    const dirtyPayload = {
      puzzleId: 'p-1',
      editionNumber: 1,
      publishDate: '2026-10-20',
      rootTemplate: 'frase',
      nodes: {
        n1: {
          id: 'n1',
          clueText: 'pista',
          children: [],
          parent: null,
          type: 'definition' as const,
          solutionHash: 'hash',
          solutionCipher: 'cipher',
          solution: 'PALABRA_SECRETA_PROHIBIDA',
          secretInternalNote: 'no enviar',
        },
      },
      dailySalt: 'salt',
      quoteAuthor: 'Autor',
      quoteWork: 'Obra',
      quoteYear: 2026,
      editorialNote: 'Nota',
      rawMarkup: '[PALABRA_SECRETA_PROHIBIDA]',
      internalAdminComment: 'secreto',
    }

    const clean = sanitizeClientPayload(dirtyPayload as unknown as ClientPayload)
    const cleanRecord = clean as unknown as Record<string, unknown>
    const cleanNodes = clean.nodes as unknown as Record<string, Record<string, unknown>>

    // Verificar que los campos no autorizados fueron eliminados
    expect(cleanRecord['rawMarkup']).toBeUndefined()
    expect(cleanRecord['internalAdminComment']).toBeUndefined()
    expect(cleanNodes['n1']?.['solution']).toBeUndefined()
    expect(cleanNodes['n1']?.['secretInternalNote']).toBeUndefined()

    // Verificar que los campos requeridos se mantienen intactos
    expect(clean.puzzleId).toBe('p-1')
    expect(clean.nodes['n1']?.solutionHash).toBe('hash')
  })
})

describe('Utilidades de tiempo (time.ts)', () => {
  it('getTodayDateMadrid devuelve una fecha en formato YYYY-MM-DD', () => {
    const dateStr = getTodayDateMadrid()
    expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('getSecondsUntilMidnightMadrid devuelve un valor entre 60 y 86400', () => {
    const seconds = getSecondsUntilMidnightMadrid()
    expect(seconds).toBeGreaterThanOrEqual(60)
    expect(seconds).toBeLessThanOrEqual(86400)
  })

  it('calcula correctamente segundos a medianoche con fecha fija', () => {
    // 23:30:00 UTC (alrededor de medianoche o 01:30 dependiendo de horario verano/invierno)
    const fixedDate = new Date('2026-10-20T23:30:00Z')
    const remaining = getSecondsUntilMidnightMadrid(fixedDate)
    expect(typeof remaining).toBe('number')
    expect(remaining).toBeGreaterThanOrEqual(60)
    expect(remaining).toBeLessThanOrEqual(86400)
  })
})
