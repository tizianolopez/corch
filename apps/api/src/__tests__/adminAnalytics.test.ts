import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app'
import { config } from '../config'
import { InMemoryRedisClient } from '../plugins/redis'
import {
  memoryGeneratedPuzzles,
  type PipelineResultSuccess,
} from '../services/puzzleCompiler'

describe('Admin Analytics & Library (CMS Fase 4.5)', () => {
  let app: FastifyInstance
  let redisClient: InMemoryRedisClient
  const adminSecret = config.ADMIN_JWT_SECRET

  const sampleAiPuzzle: PipelineResultSuccess = {
    success: true,
    puzzleId: 'ai-puz-101',
    editionNumber: 101,
    publishDate: '2026-10-21',
    status: 'PUBLISHED',
    source: 'AI',
    rawMarkup: 'En [1969] la [misión [Apolo]] pisó la Luna.',
    compiledAst: {
      puzzleId: 'ai-puz-101',
      editionNumber: 101,
      publishDate: '2026-10-21',
      rootTemplate: 'En {{n1}} la {{n2}} pisó la Luna.',
      nodes: {
        n1: { id: 'n1', clueText: '1969', children: [], parent: null, type: 'definition', solution: '1969' },
        n2: { id: 'n2', clueText: 'misión {{n3}}', children: ['n3'], parent: null, type: 'charade', solution: 'espacial' },
        n3: { id: 'n3', clueText: 'Apolo', children: [], parent: 'n2', type: 'definition', solution: 'apolo' },
      },
      quoteAuthor: 'Neil Armstrong',
      quoteWork: 'Diario de la Luna',
      quoteYear: 1969,
      editorialNote: 'Aterrizaje lunar',
      source: 'AI',
    },
    clientPayload: {
      puzzleId: 'ai-puz-101',
      editionNumber: 101,
      publishDate: '2026-10-21',
      rootTemplate: 'En {{n1}} la {{n2}} pisó la Luna.',
      nodes: {
        n1: { id: 'n1', clueText: '1969', children: [], parent: null, type: 'definition', solutionHash: 'h1', solutionCipher: 'c1' },
        n2: { id: 'n2', clueText: 'misión {{n3}}', children: ['n3'], parent: null, type: 'definition', solutionHash: 'h2', solutionCipher: 'c2' },
        n3: { id: 'n3', clueText: 'Apolo', children: [], parent: 'n2', type: 'definition', solutionHash: 'h3', solutionCipher: 'c3' },
      },
      dailySalt: 'test-salt-101',
      quoteAuthor: 'Neil Armstrong',
      quoteWork: 'Diario de la Luna',
      quoteYear: 1969,
      editorialNote: 'Aterrizaje lunar',
    },
    meta: {
      maxDepth: 2,
      totalNodes: 3,
      initialLeaves: 2,
      attempts: 2,
    },
  }

  const sampleManualPuzzle: PipelineResultSuccess = {
    success: true,
    puzzleId: 'manual-puz-102',
    editionNumber: 102,
    publishDate: '2026-10-22',
    status: 'DRAFT',
    source: 'MANUAL',
    rawMarkup: 'Un día [como hoy [en Madrid]] ocurrió esto.',
    compiledAst: {
      puzzleId: 'manual-puz-102',
      editionNumber: 102,
      publishDate: '2026-10-22',
      rootTemplate: 'Un día {{n1}} ocurrió esto.',
      nodes: {
        n1: { id: 'n1', clueText: 'como hoy {{n2}}', children: ['n2'], parent: null, type: 'definition', solution: 'especial' },
        n2: { id: 'n2', clueText: 'en Madrid', children: [], parent: 'n1', type: 'definition', solution: 'capital' },
      },
      quoteAuthor: 'Cervantes',
      quoteWork: 'Novelas Ejemplares',
      quoteYear: 1613,
      editorialNote: 'Nota manual',
      source: 'MANUAL',
    },
    clientPayload: {
      puzzleId: 'manual-puz-102',
      editionNumber: 102,
      publishDate: '2026-10-22',
      rootTemplate: 'Un día {{n1}} ocurrió esto.',
      nodes: {
        n1: { id: 'n1', clueText: 'como hoy {{n2}}', children: ['n2'], parent: null, type: 'definition', solutionHash: 'hm1', solutionCipher: 'cm1' },
        n2: { id: 'n2', clueText: 'en Madrid', children: [], parent: 'n1', type: 'definition', solutionHash: 'hm2', solutionCipher: 'cm2' },
      },
      dailySalt: 'test-salt-102',
      quoteAuthor: 'Cervantes',
      quoteWork: 'Novelas Ejemplares',
      quoteYear: 1613,
      editorialNote: 'Nota manual',
    },
    meta: {
      maxDepth: 2,
      totalNodes: 2,
      initialLeaves: 1,
      attempts: 1,
    },
  }

  beforeEach(async () => {
    redisClient = new InMemoryRedisClient()
    memoryGeneratedPuzzles.clear()
    memoryGeneratedPuzzles.set(sampleAiPuzzle.puzzleId, { ...sampleAiPuzzle })
    memoryGeneratedPuzzles.set(sampleManualPuzzle.puzzleId, { ...sampleManualPuzzle })

    // Simular tiempos de partidas en Redis para la edición 101
    await redisClient.zadd('stats:edition:101:times', { score: 45, member: 'session-1' })
    await redisClient.zadd('stats:edition:101:times', { score: 95, member: 'session-2' })
    await redisClient.zadd('stats:edition:101:times', { score: 140, member: 'session-3' })
    await redisClient.zadd('stats:edition:101:times', { score: 210, member: 'session-4' })

    app = await buildApp({
      configOverrides: {
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
      },
      redisClient,
    })
  })

  // ── Biblioteca de Ediciones (Filtros y Búsqueda) ───────────────────────────

  it('GET /api/admin/puzzles filtra correctamente por source (AI vs MANUAL)', async () => {
    // 1. Filtrar solo AI
    const resAi = await app.inject({
      method: 'GET',
      url: '/api/admin/puzzles?source=AI',
      headers: { 'x-admin-token': adminSecret },
    })
    expect(resAi.statusCode).toBe(200)
    const listAi = resAi.json<Array<{ source: string; id: string }>>()
    expect(listAi.length).toBe(1)
    expect(listAi[0]?.source).toBe('AI')
    expect(listAi[0]?.id).toBe('ai-puz-101')

    // 2. Filtrar solo MANUAL
    const resManual = await app.inject({
      method: 'GET',
      url: '/api/admin/puzzles?source=MANUAL',
      headers: { 'x-admin-token': adminSecret },
    })
    expect(resManual.statusCode).toBe(200)
    const listManual = resManual.json<Array<{ source: string; id: string }>>()
    expect(listManual.length).toBe(1)
    expect(listManual[0]?.source).toBe('MANUAL')
    expect(listManual[0]?.id).toBe('manual-puz-102')
  })

  it('GET /api/admin/puzzles busca por término de texto (autor o contenido)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/puzzles?search=Cervantes',
      headers: { 'x-admin-token': adminSecret },
    })

    expect(res.statusCode).toBe(200)
    const list = res.json<Array<{ quoteAuthor: string }>>()
    expect(list.length).toBe(1)
    expect(list[0]?.quoteAuthor).toBe('Cervantes')
  })

  // ── Analíticas por Edición ──────────────────────────────────────────────────

  it('GET /api/admin/analytics/edition/:id devuelve KPIs, distribución y diagnósticos de nodos', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/analytics/edition/101',
      headers: { 'x-admin-token': adminSecret },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{
      edition: { editionNumber: number; quoteAuthor: string }
      kpis: { completedSessions: number; startedSessions: number; abandonmentRate: number }
      timeDistribution: Array<{ label: string; count: number }>
      nodeDiagnostics: Array<{ nodeId: string; isLeaf: boolean; totalAttempts: number }>
    }>()

    expect(body.edition.editionNumber).toBe(101)
    expect(body.edition.quoteAuthor).toBe('Neil Armstrong')
    expect(body.kpis.completedSessions).toBe(4) // 4 sesiones registradas en redis
    expect(body.timeDistribution.length).toBe(6) // 6 cubetas de tiempo
    expect(body.nodeDiagnostics.length).toBe(3) // 3 nodos (n1, n2, n3)
  })

  it('GET /api/admin/analytics/edition/:id devuelve 404 para identificador inexistente', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/analytics/edition/inexistente',
      headers: { 'x-admin-token': adminSecret },
    })
    expect(res.statusCode).toBe(404)
  })

  // ── Rendimiento del Agente IA ───────────────────────────────────────────────

  it('GET /api/admin/analytics/agent devuelve tasa de éxito, distribución de reintentos y desgloses', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/analytics/agent',
      headers: { 'x-admin-token': adminSecret },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{
      summary: { totalGeneratedAi: number; totalManual: number; successRate: number; averageAttempts: number }
      attemptsDistribution: { attempt1: number; attempt2: number; attempt3: number }
      statusBreakdown: { drafts: number; published: number }
      rejectionFeedback: Array<{ reason: string; count: number }>
    }>()

    expect(body.summary.totalGeneratedAi).toBe(1)
    expect(body.summary.totalManual).toBe(1)
    expect(body.summary.averageAttempts).toBe(2) // el sample ai requirió 2 intentos
    expect(body.statusBreakdown.published).toBe(1)
    expect(body.rejectionFeedback.length).toBeGreaterThan(0)
  })
})
