import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app'
import { memorySessions } from '../routes/session'
import type { UserStatsResponse, UserHistoryResponse } from '../routes/user'

describe('Estadísticas e Historial de Usuario (Fase 5.4)', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    memorySessions.clear()
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

  it('POST /api/session/complete actualiza la racha y estadísticas del usuario autenticado', async () => {
    const testUserId = '11111111-2222-3333-4444-555555555555'

    // 1. Iniciar sesión directamente vinculada al usuario
    const startRes = await app.inject({
      method: 'POST',
      url: '/api/session/start',
      payload: {
        puzzleId: 'puzzle-user-1',
        userId: testUserId,
      },
    })

    const { sessionId } = startRes.json<{ sessionId: string }>()

    // 2. Completar partida
    const completeRes = await app.inject({
      method: 'POST',
      url: '/api/session/complete',
      payload: {
        sessionId,
        durationMs: 110000,
        mistakesCount: 0,
        hintsUsed: [],
        score: 100,
        rankAchieved: 'Gran Maestro',
      },
    })

    expect(completeRes.statusCode).toBe(200)
    const completeBody = completeRes.json<{
      success: boolean
      score: number
      rankAchieved: string
      userStats?: {
        streakCurrent: number
        streakMax: number
        totalPlays: number
        totalWins: number
      }
    }>()

    expect(completeBody.success).toBe(true)
    expect(completeBody.userStats).toBeDefined()
    expect(completeBody.userStats?.totalPlays).toBe(1)
    expect(completeBody.userStats?.totalWins).toBe(1)
    expect(completeBody.userStats?.streakCurrent).toBeGreaterThanOrEqual(1)
    expect(completeBody.userStats?.streakMax).toBeGreaterThanOrEqual(1)
  })

  it('GET /api/user/:userId/stats devuelve las estadísticas acumuladas y racha del lector', async () => {
    const testUserId = '22222222-3333-4444-5555-666666666666'

    // Crear 2 sesiones para el usuario
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/session/start',
      payload: { puzzleId: 'puz-101', userId: testUserId },
    })
    const s1 = res1.json<{ sessionId: string }>().sessionId

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/session/start',
      payload: { puzzleId: 'puz-102', userId: testUserId },
    })
    const s2 = res2.json<{ sessionId: string }>().sessionId

    // Completar solo la primera partida
    await app.inject({
      method: 'POST',
      url: '/api/session/complete',
      payload: {
        sessionId: s1,
        durationMs: 80000,
        mistakesCount: 1,
        hintsUsed: [],
        score: 95,
        rankAchieved: 'Maestro',
      },
    })

    // Consultar estadísticas
    const statsRes = await app.inject({
      method: 'GET',
      url: `/api/user/${testUserId}/stats`,
    })

    expect(statsRes.statusCode).toBe(200)
    const stats = statsRes.json<UserStatsResponse>()

    expect(stats.userId).toBe(testUserId)
    expect(stats.totalPlays).toBe(2)
    expect(stats.totalWins).toBe(1)
    expect(stats.winRate).toBe(0.5)
    expect(stats.streakCurrent).toBeGreaterThanOrEqual(1)
  })

  it('GET /api/user/:userId/history devuelve el listado de partidas jugadas con metadatos', async () => {
    const testUserId = '33333333-4444-5555-6666-777777777777'

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/session/start',
      payload: { puzzleId: 'puz-hist-1', userId: testUserId },
    })
    const s1 = res1.json<{ sessionId: string }>().sessionId

    await app.inject({
      method: 'POST',
      url: '/api/session/complete',
      payload: {
        sessionId: s1,
        durationMs: 140000,
        mistakesCount: 2,
        hintsUsed: [{ nodeId: 'n1', type: 'matrix', at: Date.now() }],
        score: 82,
        rankAchieved: 'Cronista',
      },
    })

    const historyRes = await app.inject({
      method: 'GET',
      url: `/api/user/${testUserId}/history`,
    })

    expect(historyRes.statusCode).toBe(200)
    const body = historyRes.json<UserHistoryResponse>()

    expect(body.userId).toBe(testUserId)
    expect(body.history.length).toBe(1)

    const item = body.history[0]
    expect(item?.sessionId).toBe(s1)
    expect(item?.score).toBe(82)
    expect(item?.rankAchieved).toBe('Cronista')
    expect(item?.isComplete).toBe(true)
    expect(item?.hintsCount).toBe(1)
    expect(item?.mistakesCount).toBe(2)
  })
})
