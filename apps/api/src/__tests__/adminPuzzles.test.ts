import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app'
import { config } from '../config'
import { InMemoryRedisClient } from '../plugins/redis'
import {
  memoryGeneratedPuzzles,
  type PipelineResultSuccess,
} from '../services/puzzleCompiler'
import type { ILlmModel } from '../services/puzzleGenerator'
import type { GeneratedPuzzleDraft } from '../services/puzzleValidator'

describe('Admin Puzzles Endpoints (CMS Fase 4.2)', () => {
  let app: FastifyInstance
  let redisClient: InMemoryRedisClient
  const adminSecret = config.ADMIN_JWT_SECRET

  const sampleDraftPuzzle: PipelineResultSuccess = {
    success: true,
    puzzleId: 'draft-puz-1',
    editionNumber: 10,
    publishDate: '2026-10-25',
    status: 'DRAFT',
    source: 'AI',
    rawMarkup: 'Un día [pista uno [pista dos]] y [pista tres].',
    compiledAst: {
      puzzleId: 'draft-puz-1',
      editionNumber: 10,
      publishDate: '2026-10-25',
      rootTemplate: 'Un día {{n1}} y {{n3}}.',
      nodes: {
        n1: { id: 'n1', clueText: 'pista uno {{n2}}', children: ['n2'], parent: null, type: 'definition', solution: 'sol1' },
        n2: { id: 'n2', clueText: 'pista dos', children: [], parent: 'n1', type: 'definition', solution: 'sol2' },
        n3: { id: 'n3', clueText: 'pista tres', children: [], parent: null, type: 'definition', solution: 'sol3' },
      },
      quoteAuthor: 'Autor Histórico',
      quoteWork: 'Obra Histórica',
      quoteYear: 1950,
      editorialNote: 'Nota editorial de prueba.',
      source: 'AI',
    },
    clientPayload: {
      puzzleId: 'draft-puz-1',
      editionNumber: 10,
      publishDate: '2026-10-25',
      rootTemplate: 'Un día {{n1}} y {{n3}}.',
      nodes: {
        n1: { id: 'n1', clueText: 'pista uno {{n2}}', children: ['n2'], parent: null, type: 'definition', solutionHash: 'hash1', solutionCipher: 'ciph1' },
        n2: { id: 'n2', clueText: 'pista dos', children: [], parent: 'n1', type: 'definition', solutionHash: 'hash2', solutionCipher: 'ciph2' },
        n3: { id: 'n3', clueText: 'pista tres', children: [], parent: null, type: 'definition', solutionHash: 'hash3', solutionCipher: 'ciph3' },
      },
      dailySalt: 'test-salt',
      quoteAuthor: 'Autor Histórico',
      quoteWork: 'Obra Histórica',
      quoteYear: 1950,
      editorialNote: 'Nota editorial de prueba.',
    },
    meta: {
      maxDepth: 2,
      totalNodes: 3,
      initialLeaves: 2,
      attempts: 1,
    },
  }

  const validDraft: GeneratedPuzzleDraft = {
    originalQuote: 'Un texto regenerado por IA.',
    markup: 'Un texto [con pista [anidada]] y [otra hoja].',
    nodes: [
      { id: 'n1', solution: 'pista', type: 'definition' },
      { id: 'n2', solution: 'anidada', type: 'definition' },
      { id: 'n3', solution: 'hoja', type: 'definition' },
    ],
    quoteYear: 1960,
    editorialNote: 'Regenerado',
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
    memoryGeneratedPuzzles.clear()
    memoryGeneratedPuzzles.set(sampleDraftPuzzle.puzzleId, { ...sampleDraftPuzzle })

    // Precargar efeméride para regeneración
    await redisClient.set('ephemeris:es:10:25', [
      { year: 1960, text: 'Evento para regeneración', pages: [] },
    ])

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

  // ── 1. Listado de puzles ────────────────────────────────────────────────────

  it('GET /api/admin/puzzles rechaza sin autenticación con 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/puzzles',
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/admin/puzzles con token admin devuelve la lista de borradores', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/puzzles?status=DRAFT',
      headers: {
        'x-admin-token': adminSecret,
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<Array<{ id: string; status: string; quoteAuthor: string }>>()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThanOrEqual(1)
    expect(body[0]?.id).toBe('draft-puz-1')
    expect(body[0]?.status).toBe('DRAFT')
  })

  // ── 2. Aprobación y cambio de estado ────────────────────────────────────────

  it('PATCH /api/admin/puzzles/:id/status actualiza el estado a SCHEDULED', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/admin/puzzles/draft-puz-1/status',
      headers: {
        'x-admin-token': adminSecret,
      },
      payload: {
        status: 'SCHEDULED',
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ success: boolean; id: string; status: string }>()
    expect(body.success).toBe(true)
    expect(body.status).toBe('SCHEDULED')

    // Verificar que el estado cambió en el almacén
    expect(memoryGeneratedPuzzles.get('draft-puz-1')?.status).toBe('SCHEDULED')
  })

  it('PATCH /api/admin/puzzles/:id/status devuelve 404 si el ID no existe', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/admin/puzzles/no-existe/status',
      headers: {
        'x-admin-token': adminSecret,
      },
      payload: {
        status: 'SCHEDULED',
      },
    })

    expect(res.statusCode).toBe(404)
  })

  // ── 3. Edición inline de pista ──────────────────────────────────────────────

  it('PATCH /api/admin/puzzles/:id/clue actualiza el texto de una pista específica', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/admin/puzzles/draft-puz-1/clue',
      headers: {
        'x-admin-token': adminSecret,
      },
      payload: {
        nodeId: 'n2',
        newClueText: 'texto de pista editado por el supervisor',
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{
      success: boolean
      nodeId: string
      newClueText: string
      clientPayload: { nodes: Record<string, { clueText: string }> }
    }>()

    expect(body.success).toBe(true)
    expect(body.nodeId).toBe('n2')
    expect(body.clientPayload.nodes['n2']?.clueText).toBe(
      'texto de pista editado por el supervisor',
    )
  })

  it('PATCH /api/admin/puzzles/:id/clue devuelve 404 si el nodeId no existe', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/admin/puzzles/draft-puz-1/clue',
      headers: {
        'x-admin-token': adminSecret,
      },
      payload: {
        nodeId: 'n999',
        newClueText: 'nueva pista',
      },
    })

    expect(res.statusCode).toBe(404)
  })

  // ── 4. Regeneración con IA ──────────────────────────────────────────────────

  it('POST /api/admin/puzzles/:id/regenerate vuelve a solicitar un borrador con IA', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/puzzles/draft-puz-1/regenerate',
      headers: {
        'x-admin-token': adminSecret,
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ success: boolean; status: string; rawMarkup: string }>()
    expect(body.success).toBe(true)
    expect(body.status).toBe('DRAFT')
    expect(body.rawMarkup).toContain('[con pista [anidada]]')
  })
})
