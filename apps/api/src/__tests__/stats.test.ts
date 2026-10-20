import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app'
import { getTodayDateMadrid, getTimesRedisKey } from '../utils/time'
import type { StatsDistributionResponse } from '../routes/stats'

describe('Endpoint de Estadísticas (Tarea 2.4)', () => {
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

  it('GET /api/stats/today/distribution devuelve 200 con cubetas vacías cuando no hay partidas', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/stats/today/distribution',
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<StatsDistributionResponse>()

    expect(body.publishDate).toBe(getTodayDateMadrid())
    expect(body.totalPlayers).toBe(0)
    expect(body.fastestSeconds).toBeNull()
    expect(body.medianSeconds).toBeNull()
    expect(Array.isArray(body.buckets)).toBe(true)
    expect(body.buckets.length).toBe(6)

    // Todas las cubetas tienen conteo 0
    for (const b of body.buckets) {
      expect(b.count).toBe(0)
    }

    // Cabecera Cache-Control corta (30s)
    expect(response.headers['cache-control']).toBe(
      'public, max-age=30, s-maxage=30',
    )
  })

  it('distribuye correctamente los tiempos de los jugadores en cubetas usando ZCOUNT', async () => {
    const today = getTodayDateMadrid()
    const redisKey = getTimesRedisKey(today)

    // Simular 5 partidas registradas en Redis con diferentes tiempos en segundos:
    // - 45s: cubeta '< 1 min' (0-60)
    // - 95s: cubeta '1 - 2 min' (61-120)
    // - 150s: cubeta '2 - 3 min' (121-180)
    // - 240s: cubeta '3 - 5 min' (181-300)
    // - 720s: cubeta '> 10 min' (601+)
    await app.redis.zadd(redisKey, { score: 45, member: 'player-1' })
    await app.redis.zadd(redisKey, { score: 95, member: 'player-2' })
    await app.redis.zadd(redisKey, { score: 150, member: 'player-3' })
    await app.redis.zadd(redisKey, { score: 240, member: 'player-4' })
    await app.redis.zadd(redisKey, { score: 720, member: 'player-5' })

    const response = await app.inject({
      method: 'GET',
      url: '/api/stats/today/distribution',
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<StatsDistributionResponse>()

    expect(body.totalPlayers).toBe(5)
    expect(body.fastestSeconds).toBe(45)
    expect(body.medianSeconds).toBe(150)

    const bucketCounts = body.buckets.map((b) => ({
      label: b.label,
      count: b.count,
    }))

    expect(bucketCounts).toEqual([
      { label: '< 1 min', count: 1 },
      { label: '1 - 2 min', count: 1 },
      { label: '2 - 3 min', count: 1 },
      { label: '3 - 5 min', count: 1 },
      { label: '5 - 10 min', count: 0 },
      { label: '> 10 min', count: 1 },
    ])
  })

  it('permite consultar estadísticas de una fecha específica vía query param ?date=', async () => {
    const customDate = '2026-10-15'
    const customKey = getTimesRedisKey(customDate)

    await app.redis.zadd(customKey, { score: 110, member: 'historical-1' })
    await app.redis.zadd(customKey, { score: 115, member: 'historical-2' })

    const response = await app.inject({
      method: 'GET',
      url: `/api/stats/today/distribution?date=${customDate}`,
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<StatsDistributionResponse>()

    expect(body.publishDate).toBe(customDate)
    expect(body.totalPlayers).toBe(2)
    expect(body.fastestSeconds).toBe(110)
  })

  it('calcula y devuelve el percentil del jugador al completar sesión (POST /api/session/complete)', async () => {
    // 1. Iniciar sesión para un nuevo jugador
    const startRes = await app.inject({
      method: 'POST',
      url: '/api/session/start',
      payload: { puzzleId: 'puzzle-stats-demo' },
    })
    const { sessionId } = startRes.json<{ sessionId: string }>()

    // 2. Pre-cargar jugadores en Redis:
    // Supongamos 3 jugadores existentes más lentos (200s, 300s, 400s)
    const today = getTodayDateMadrid()
    const redisKey = getTimesRedisKey(today)
    await app.redis.zadd(redisKey, { score: 200, member: 'slower-1' })
    await app.redis.zadd(redisKey, { score: 300, member: 'slower-2' })
    await app.redis.zadd(redisKey, { score: 400, member: 'slower-3' })

    // 3. Completar la partida con tiempo rápido (100s = 100000ms)
    const completeRes = await app.inject({
      method: 'POST',
      url: '/api/session/complete',
      payload: {
        sessionId,
        durationMs: 100000,
        mistakesCount: 0,
        hintsUsed: [],
        score: 100,
        rankAchieved: 'Gran Maestro',
      },
    })

    expect(completeRes.statusCode).toBe(200)
    const body = completeRes.json<{ percentile: number; isComplete: boolean }>()

    expect(body.isComplete).toBe(true)
    // El jugador fue más rápido que 3 de 3 jugadores previos -> percentil alto (>= 90%)
    expect(body.percentile).toBeGreaterThanOrEqual(90)
  })
})
