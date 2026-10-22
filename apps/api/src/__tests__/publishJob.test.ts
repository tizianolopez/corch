import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app'
import { config } from '../config'
import {
  executePublishJob,
  purgeCloudflareCache,
} from '../services/publishJob'
import {
  memoryGeneratedPuzzles,
  type PipelineResultSuccess,
} from '../services/puzzleCompiler'

describe('Servicio de Publicación e Invalidación Cloudflare (Fase 4.3)', () => {
  let app: FastifyInstance
  const adminSecret = config.ADMIN_JWT_SECRET

  const puzzleToday: PipelineResultSuccess = {
    success: true,
    puzzleId: 'puz-today',
    editionNumber: 101,
    publishDate: '2026-10-22',
    status: 'SCHEDULED' as unknown as 'DRAFT',
    source: 'AI',
    rawMarkup: 'Texto de hoy',
    compiledAst: {} as any,
    clientPayload: {
      puzzleId: 'puz-today',
      editionNumber: 101,
      publishDate: '2026-10-22',
      rootTemplate: 'Texto',
      nodes: {},
      dailySalt: 'salt',
      quoteAuthor: 'Autor',
      quoteWork: 'Obra',
      quoteYear: 2026,
      editorialNote: 'Nota',
    },
    meta: { maxDepth: 2, totalNodes: 3, initialLeaves: 2, attempts: 1 },
  }

  const puzzleTomorrow: PipelineResultSuccess = {
    ...puzzleToday,
    puzzleId: 'puz-tomorrow',
    editionNumber: 102,
    publishDate: '2026-10-23',
    status: 'SCHEDULED' as unknown as 'DRAFT',
  }

  beforeEach(async () => {
    memoryGeneratedPuzzles.clear()
    memoryGeneratedPuzzles.set('puz-today', { ...puzzleToday })
    memoryGeneratedPuzzles.set('puz-tomorrow', { ...puzzleTomorrow })

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

  it('executePublishJob publica solo puzles con publishDate <= todayDate', async () => {
    const result = await executePublishJob({
      todayDate: '2026-10-22',
      memoryStore: memoryGeneratedPuzzles,
    })

    expect(result.success).toBe(true)
    expect(result.publishedCount).toBe(1)
    expect(result.publishedIds).toEqual(['puz-today'])

    // El puzle de hoy debe estar PUBLISHED
    expect(memoryGeneratedPuzzles.get('puz-today')?.status).toBe('PUBLISHED')
    // El puzle de mañana debe permanecer SCHEDULED
    expect(memoryGeneratedPuzzles.get('puz-tomorrow')?.status).toBe('SCHEDULED')
  })

  it('purgeCloudflareCache envía petición POST a Cloudflare con cabecera Bearer', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as Response)

    const purged = await purgeCloudflareCache(
      {
        zoneId: 'zone-123',
        apiToken: 'token-abc',
      },
      mockFetch,
    )

    expect(purged).toBe(true)
    expect(mockFetch).toHaveBeenCalledOnce()
    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[0]).toContain('/zones/zone-123/purge_cache')
    expect(callArgs[1].headers.Authorization).toBe('Bearer token-abc')
  })

  it('POST /api/admin/publish-scheduled ejecuta la publicación bajo demanda con 200 OK', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/publish-scheduled',
      headers: {
        'x-admin-token': adminSecret,
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{
      success: boolean
      publishedCount: number
      publishedIds: string[]
    }>()

    expect(body.success).toBe(true)
    expect(Array.isArray(body.publishedIds)).toBe(true)
  })

  it('PATCH /api/admin/puzzles/:id/schedule reasigna la fecha y programa como SCHEDULED', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/admin/puzzles/puz-today/schedule',
      headers: {
        'x-admin-token': adminSecret,
      },
      payload: {
        publishDate: '2026-10-28',
        status: 'SCHEDULED',
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<{ success: boolean; publishDate: string; status: string }>()
    expect(body.success).toBe(true)
    expect(body.publishDate).toBe('2026-10-28')
    expect(body.status).toBe('SCHEDULED')

    expect(memoryGeneratedPuzzles.get('puz-today')?.publishDate).toBe('2026-10-28')
  })
})
