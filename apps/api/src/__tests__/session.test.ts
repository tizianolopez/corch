import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app'
import { memorySessions } from '../routes/session'

describe('Endpoints de Sesión (Tarea 2.3)', () => {
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

  // ── 1. POST /api/session/start ───────────────────────────────────────────
  it('POST /api/session/start crea una play_session y devuelve sessionId', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/session/start',
      payload: {
        puzzleId: 'puzzle-demo-123',
        anonymousId: 'anon-user-uuid-456',
      },
    })

    expect(response.statusCode).toBe(201)
    const body = response.json<{
      sessionId: string
      puzzleId: string
      startedAt: string
      anonymousId?: string
    }>()

    expect(body.sessionId).toBeDefined()
    // Validar formato UUID v4
    expect(body.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    expect(body.puzzleId).toBe('puzzle-demo-123')
    expect(body.startedAt).toBeDefined()
    expect(body.anonymousId).toBe('anon-user-uuid-456')

    // Comprobar que está en memoria
    const saved = memorySessions.get(body.sessionId)
    expect(saved).toBeDefined()
    expect(saved?.anonymousId).toBe('anon-user-uuid-456')
  })

  it('POST /api/session/start genera automáticamente un anonymousId si se omite en la petición', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/session/start',
      payload: {
        puzzleId: 'puzzle-demo-123',
      },
    })

    expect(response.statusCode).toBe(201)
    const body = response.json<{
      sessionId: string
      puzzleId: string
      anonymousId?: string
    }>()

    expect(body.anonymousId).toBeDefined()
    expect(body.anonymousId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    const saved = memorySessions.get(body.sessionId)
    expect(saved?.anonymousId).toBe(body.anonymousId)
  })

  it('POST /api/session/start falla con 400 si falta puzzleId', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/session/start',
      payload: {},
    })

    expect(response.statusCode).toBe(400)
    const body = response.json()
    expect(body.statusCode).toBe(400)
    expect(body.error).toBe('Bad Request')
  })

  // ── 2. POST /api/session/hint ────────────────────────────────────────────
  it('POST /api/session/hint devuelve letra inicial para hintType matrix', async () => {
    // 1. Iniciar sesión
    const startRes = await app.inject({
      method: 'POST',
      url: '/api/session/start',
      payload: { puzzleId: 'puzzle-demo-123' },
    })
    const { sessionId } = startRes.json<{ sessionId: string }>()

    // 2. Pedir pista de tipo 'matrix' para n3 (molinos)
    const hintRes = await app.inject({
      method: 'POST',
      url: '/api/session/hint',
      payload: {
        sessionId,
        nodeId: 'n3',
        hintType: 'matrix',
      },
    })

    expect(hintRes.statusCode).toBe(200)
    const body = hintRes.json<{
      success: boolean
      hintType: string
      nodeId: string
      initialLetter: string
    }>()

    expect(body.success).toBe(true)
    expect(body.hintType).toBe('matrix')
    expect(body.nodeId).toBe('n3')
    expect(body.initialLetter).toBe('M')

    // Verificar que se registró en hintsUsed de la sesión
    const saved = memorySessions.get(sessionId)
    expect(saved?.hintsUsed.length).toBe(1)
    expect(saved?.hintsUsed[0]?.type).toBe('matrix')
  })

  it('POST /api/session/hint devuelve solución en texto claro para hintType reveal', async () => {
    // 1. Iniciar sesión
    const startRes = await app.inject({
      method: 'POST',
      url: '/api/session/start',
      payload: { puzzleId: 'puzzle-demo-123' },
    })
    const { sessionId } = startRes.json<{ sessionId: string }>()

    // 2. Revelar término n3 (molinos)
    const hintRes = await app.inject({
      method: 'POST',
      url: '/api/session/hint',
      payload: {
        sessionId,
        nodeId: 'n3',
        hintType: 'reveal',
      },
    })

    expect(hintRes.statusCode).toBe(200)
    const body = hintRes.json<{
      success: boolean
      hintType: string
      nodeId: string
      solution: string
    }>()

    expect(body.success).toBe(true)
    expect(body.hintType).toBe('reveal')
    expect(body.nodeId).toBe('n3')
    expect(body.solution).toBe('mundiales')

    // Verificar registro en hintsUsed
    const saved = memorySessions.get(sessionId)
    expect(saved?.hintsUsed.length).toBe(1)
    expect(saved?.hintsUsed[0]?.type).toBe('reveal')
  })

  it('POST /api/session/hint devuelve 404 si la sesión no existe', async () => {
    const hintRes = await app.inject({
      method: 'POST',
      url: '/api/session/hint',
      payload: {
        sessionId: '00000000-0000-0000-0000-000000000000',
        nodeId: 'n1',
        hintType: 'reveal',
      },
    })

    expect(hintRes.statusCode).toBe(404)
    expect(hintRes.json().error).toBe('Not Found')
  })

  // ── 3. POST /api/session/complete ────────────────────────────────────────
  it('POST /api/session/complete guarda el resultado, actualiza Redis y devuelve percentil', async () => {
    // 1. Iniciar sesión
    const startRes = await app.inject({
      method: 'POST',
      url: '/api/session/start',
      payload: { puzzleId: 'puzzle-demo-123' },
    })
    const { sessionId } = startRes.json<{ sessionId: string }>()

    // 2. Completar sesión con puntuación y tiempo
    const completeRes = await app.inject({
      method: 'POST',
      url: '/api/session/complete',
      payload: {
        sessionId,
        durationMs: 125000,
        mistakesCount: 1,
        hintsUsed: [{ nodeId: 'n1', type: 'matrix', at: Date.now() }],
        score: 92,
        rankAchieved: 'Maestro',
      },
    })

    expect(completeRes.statusCode).toBe(200)
    const body = completeRes.json<{
      success: boolean
      sessionId: string
      isComplete: boolean
      score: number
      rankAchieved: string
      percentile: number
    }>()

    expect(body.success).toBe(true)
    expect(body.sessionId).toBe(sessionId)
    expect(body.isComplete).toBe(true)
    expect(body.score).toBe(92)
    expect(body.rankAchieved).toBe('Maestro')
    expect(typeof body.percentile).toBe('number')
    expect(body.percentile).toBeGreaterThanOrEqual(1)
    expect(body.percentile).toBeLessThanOrEqual(99)

    // Comprobar actualización en memoria
    const saved = memorySessions.get(sessionId)
    expect(saved?.isComplete).toBe(true)
    expect(saved?.durationMs).toBe(125000)
    expect(saved?.score).toBe(92)
  })

  // ── 4. Rate Limiting en /api/session/hint ─────────────────────────────────
  it('aplica cabeceras de rate limiting en /api/session/hint con límite de 60 req/min', async () => {
    const startRes = await app.inject({
      method: 'POST',
      url: '/api/session/start',
      payload: { puzzleId: 'puzzle-demo-123' },
    })
    const { sessionId } = startRes.json<{ sessionId: string }>()

    const hintRes = await app.inject({
      method: 'POST',
      url: '/api/session/hint',
      payload: {
        sessionId,
        nodeId: 'n2',
        hintType: 'matrix',
      },
    })

    expect(hintRes.statusCode).toBe(200)
    // Cabecera rate limit configurada para máximo 60 req/min
    const limitHeader =
      hintRes.headers['x-ratelimit-limit'] ??
      hintRes.headers['ratelimit-limit']
    expect(Number(limitHeader)).toBe(60)

    const remainingHeader =
      hintRes.headers['x-ratelimit-remaining'] ??
      hintRes.headers['ratelimit-remaining']
    expect(Number(remainingHeader)).toBeLessThanOrEqual(59)
  })

  // ── 5. POST /api/auth/merge (Fase 5.3) ────────────────────────────────────
  describe('POST /api/auth/merge (Fase 5.3)', () => {
    it('vincula las sesiones de un anonymousId al userId y calcula estadísticas', async () => {
      const anonId = '00000000-1111-2222-3333-444444444444'
      const targetUserId = '99999999-8888-7777-6666-555555555555'

      // Iniciar 2 sesiones con el anonymousId
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/session/start',
        payload: { puzzleId: 'puz-1', anonymousId: anonId },
      })
      const s1 = res1.json<{ sessionId: string }>().sessionId

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/session/start',
        payload: { puzzleId: 'puz-2', anonymousId: anonId },
      })
      const s2 = res2.json<{ sessionId: string }>().sessionId

      // Completar la primera sesión
      await app.inject({
        method: 'POST',
        url: '/api/session/complete',
        payload: {
          sessionId: s1,
          durationMs: 90000,
          mistakesCount: 0,
          score: 100,
          rankAchieved: 'Gran Maestro',
        },
      })

      // Ejecutar fusión
      const mergeRes = await app.inject({
        method: 'POST',
        url: '/api/auth/merge',
        payload: {
          anonymousId: anonId,
          userId: targetUserId,
          email: 'lector@corchetes.es',
          displayName: 'Lector Astuto',
        },
      })

      expect(mergeRes.statusCode).toBe(200)
      const body = mergeRes.json<{
        success: boolean
        userId: string
        anonymousId: string
        mergedSessionsCount: number
        stats: {
          totalPlays: number
          totalWins: number
          streakCurrent: number
          streakMax: number
        }
      }>()

      expect(body.success).toBe(true)
      expect(body.userId).toBe(targetUserId)
      expect(body.anonymousId).toBe(anonId)
      expect(body.mergedSessionsCount).toBe(2)
      expect(body.stats.totalPlays).toBe(2)
      expect(body.stats.totalWins).toBe(1)
      expect(body.stats.streakCurrent).toBeGreaterThanOrEqual(1)
      expect(body.stats.streakMax).toBeGreaterThanOrEqual(1)

      // Verificar que las sesiones en memoria ahora tienen userId
      expect(memorySessions.get(s1)?.userId).toBe(targetUserId)
      expect(memorySessions.get(s2)?.userId).toBe(targetUserId)
    })

    it('rechaza con 400 si faltan campos obligatorios', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/merge',
        payload: {
          anonymousId: 'anon-id',
          // falta userId
        },
      })

      expect(res.statusCode).toBe(400)
    })
  })
})

