import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app'
import { config } from '../config'
import type { ILlmModel } from '../services/puzzleGenerator'
import type { GeneratedPuzzleDraft } from '../services/puzzleValidator'
import { InMemoryRedisClient } from '../plugins/redis'
import type { EphemerisEvent } from '../services/ephemeris'

describe('Pipeline de Generación y Compilación (Fase 3.4)', () => {
  let app: FastifyInstance
  let redisClient: InMemoryRedisClient
  const adminSecret = config.ADMIN_JWT_SECRET

  const sampleEvent: EphemerisEvent = {
    year: 1962,
    text: 'El presidente John F. Kennedy anunció el bloqueo naval a Cuba durante la Crisis de los Misiles.',
    extract:
      'La crisis de los misiles de Cuba fue un conflicto de 13 días entre Estados Unidos y la Unión Soviética.',
    wikipediaUrl: 'https://es.wikipedia.org/wiki/Crisis_de_los_misiles_de_Cuba',
  }

  const validDraft: GeneratedPuzzleDraft = {
    originalQuote:
      'Un día como hoy, pero en 1962, John F. Kennedy anunció el bloqueo naval a Cuba.',
    markup:
      'Un día como hoy, pero en 1962, [el mandatario demócrata que gestionó [la isla caribeña gobernada por Fidel]] anunció el [cerco marítimo] a Cuba.',
    nodes: [
      { id: 'n1', solution: 'John F. Kennedy', type: 'reference' },
      { id: 'n2', solution: 'Cuba', type: 'definition' },
      { id: 'n3', solution: 'bloqueo naval', type: 'definition' },
    ],
    quoteAuthor: 'John F. Kennedy',
    quoteWork: 'Discurso sobre la crisis de los misiles',
    quoteYear: 1962,
    editorialNote: 'Episodio histórico decisivo de la Guerra Fría.',
  }

  const mockModel: ILlmModel = {
    generateContent: vi.fn().mockResolvedValue({
      response: {
        text: () => JSON.stringify(validDraft),
      },
    }),
  }

  beforeEach(async () => {
    redisClient = new InMemoryRedisClient()

    // Pre-poblar caché de Redis con efemérides para evitar llamadas a la API externa
    await redisClient.set('ephemeris:es:10:22', [sampleEvent])
    await redisClient.set('ephemeris:es:10:23', [sampleEvent])
    await redisClient.set('ephemeris:es:10:24', [sampleEvent])

    app = await buildApp({
      configOverrides: {
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
      },
      redisClient,
      injectedModel: mockModel,
    })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  // ── 1. Autenticación de administrador ───────────────────────────────────────

  it('POST /api/generate rechaza peticiones sin token admin con 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/generate',
      payload: { publishDate: '2026-10-22' },
    })

    expect(res.statusCode).toBe(401)
    const body = res.json<{ error: string }>()
    expect(body.error).toBe('Unauthorized')
  })

  it('POST /api/generate rechaza token admin erróneo con 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/generate',
      headers: {
        'x-admin-token': 'token-invalido-123',
      },
      payload: { publishDate: '2026-10-22' },
    })

    expect(res.statusCode).toBe(401)
  })

  // ── 2. Pipeline completo: generación, validación, compilación y guardado ────

  it('POST /api/generate con x-admin-token ejecuta el pipeline completo y devuelve 201 Created', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/generate',
      headers: {
        'x-admin-token': adminSecret,
      },
      payload: {
        publishDate: '2026-10-22',
        editionNumber: 42,
      },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json<{
      success: boolean
      puzzleId: string
      editionNumber: number
      publishDate: string
      status: string
      source: string
      clientPayload: {
        nodes: Record<string, { solutionHash: string; solutionCipher: string }>
      }
      meta: {
        maxDepth: number
        totalNodes: number
        initialLeaves: number
      }
    }>()

    expect(body.success).toBe(true)
    expect(body.status).toBe('DRAFT')
    expect(body.source).toBe('AI')
    expect(body.editionNumber).toBe(42)
    expect(body.publishDate).toBe('2026-10-22')
    expect(body.meta.maxDepth).toBe(2)
    expect(body.meta.totalNodes).toBe(3)
    expect(body.meta.initialLeaves).toBe(2)

    // REGLA CRÍTICA: Las soluciones en clientPayload están cifradas, nunca en claro
    const nodes = body.clientPayload.nodes
    expect(nodes['n1']?.solutionHash).toMatch(/^[0-9a-f]{64}$/)
    expect(nodes['n1']?.solutionCipher).toContain(':')
    expect(JSON.stringify(body.clientPayload.nodes)).not.toContain('John F. Kennedy')
    expect(JSON.stringify(body.clientPayload.nodes)).not.toContain('bloqueo naval')
  })

  it('POST /api/generate acepta autenticación mediante Bearer token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/generate',
      headers: {
        authorization: `Bearer ${adminSecret}`,
      },
      payload: {
        publishDate: '2026-10-22',
      },
    })

    expect(res.statusCode).toBe(201)
  })

  // ── 3. Generación en lote (Batch) ───────────────────────────────────────────

  it('POST /api/generate/batch genera múltiples puzles programados con 200 OK', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/generate/batch',
      headers: {
        'x-admin-token': adminSecret,
      },
      payload: {
        startDate: '2026-10-22',
        days: 2,
        startEditionNumber: 50,
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{
      requestedDays: number
      generatedCount: number
      failedCount: number
      successful: Array<{ editionNumber: number; publishDate: string }>
    }>()

    expect(body.requestedDays).toBe(2)
    expect(body.generatedCount).toBe(2)
    expect(body.failedCount).toBe(0)
    expect(body.successful[0]?.editionNumber).toBe(50)
    expect(body.successful[0]?.publishDate).toBe('2026-10-22')
    expect(body.successful[1]?.editionNumber).toBe(51)
    expect(body.successful[1]?.publishDate).toBe('2026-10-23')
  })

  // ── 4. Manejo de errores cuando la IA falla persistentemente ────────────────

  it('POST /api/generate devuelve 422 Unprocessable Entity si la generación no puede validarse', async () => {
    // Modelo que falla persistentemente devolviendo corchetes rotos
    const failingModel: ILlmModel = {
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify({ ...validDraft, markup: 'Texto [roto' }),
        },
      }),
    }

    const appWithFailingModel = await buildApp({
      configOverrides: {
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
      },
      redisClient,
      injectedModel: failingModel,
    })
    await appWithFailingModel.ready()

    const res = await appWithFailingModel.inject({
      method: 'POST',
      url: '/api/generate',
      headers: {
        'x-admin-token': adminSecret,
      },
      payload: {
        publishDate: '2026-10-22',
      },
    })

    expect(res.statusCode).toBe(422)
    const body = res.json<{ statusCode: number; error: string; details: string[] }>()
    expect(body.statusCode).toBe(422)
    expect(body.error).toBe('Unprocessable Entity')
    expect(body.details.length).toBeGreaterThan(0)

    await appWithFailingModel.close()
  })
})
