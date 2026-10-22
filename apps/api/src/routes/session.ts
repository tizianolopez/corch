import { randomUUID } from 'crypto'
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { playSessions, puzzles, users } from '@corchetes/db'
import { calculateStreak } from '@corchetes/core'
import { getTodayDateMadrid, getTimesRedisKey } from '../utils/time'

// ── Esquemas de validación con Zod ──────────────────────────────────────────

export const startSessionSchema = z.object({
  puzzleId: z.string().min(1),
  userId: z.string().uuid().optional().nullable(),
  anonymousId: z.string().optional().nullable(),
})

export const hintSessionSchema = z.object({
  sessionId: z.string().min(1),
  nodeId: z.string().min(1),
  hintType: z.enum(['matrix', 'reveal']),
})

export const completeSessionSchema = z.object({
  sessionId: z.string().min(1),
  durationMs: z.number().int().nonnegative(),
  mistakesCount: z.number().int().nonnegative().default(0),
  hintsUsed: z
    .array(
      z.object({
        nodeId: z.string(),
        type: z.enum(['matrix', 'reveal']),
        at: z.number(),
      }),
    )
    .default([]),
  score: z.number().int().min(0).max(100),
  rankAchieved: z.string().min(1),
})

export const mergeSessionSchema = z.object({
  anonymousId: z.string().min(1),
  userId: z.string().min(1),
  email: z.string().email().optional().nullable(),
  displayName: z.string().optional().nullable(),
})

// ── Tipos y Almacén en memoria (Fallback para offline/demo) ────────────────

export interface SessionRecord {
  id: string
  puzzleId: string
  userId: string | null
  anonymousId: string | null
  startedAt: Date
  completedAt: Date | null
  durationMs: number | null
  mistakesCount: number
  hintsUsed: { nodeId: string; type: 'matrix' | 'reveal'; at: number }[]
  score: number | null
  rankAchieved: string | null
  isComplete: boolean
}

/** Fallback en memoria de sesiones para desarrollo local y tests */
export const memorySessions = new Map<string, SessionRecord>()

/** Soluciones de demo conocidas cuando no hay BD */
const DEMO_SOLUTIONS: Record<string, { solution: string; initialLetter: string }> = {
  n1: { solution: 'Mancha', initialLetter: 'M' },
  n2: { solution: 'Quijote', initialLetter: 'Q' },
  n3: { solution: 'molinos', initialLetter: 'M' },
}

// ── Plugin de rutas de sesión ───────────────────────────────────────────────

export const sessionRoutes: FastifyPluginAsync = async (fastify) => {
  // ── 1. POST /api/session/start ───────────────────────────────────────────
  const startHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = startSessionSchema.parse(request.body)
    const sessionId = randomUUID()
    const now = new Date()

    const effectiveAnonymousId = body.userId
      ? null
      : body.anonymousId || randomUUID()

    const newSession: SessionRecord = {
      id: sessionId,
      puzzleId: body.puzzleId,
      userId: body.userId ?? null,
      anonymousId: effectiveAnonymousId,
      startedAt: now,
      completedAt: null,
      durationMs: null,
      mistakesCount: 0,
      hintsUsed: [],
      score: null,
      rankAchieved: null,
      isComplete: false,
    }

    // Guardar en memoria siempre como fallback
    memorySessions.set(sessionId, newSession)

    // Intentar persistir en PostgreSQL si hay base de datos conectada
    if (fastify.db) {
      try {
        await fastify.db.insert(playSessions).values({
          id: sessionId,
          puzzleId: body.puzzleId,
          userId: body.userId ?? null,
          anonymousId: effectiveAnonymousId,
          startedAt: now,
          isComplete: false,
          mistakesCount: 0,
          hintsUsed: [],
        })
      } catch (err) {
        fastify.log.warn(
          { err },
          'No se pudo registrar la sesión en PostgreSQL (usando almacén en memoria)',
        )
      }
    }

    return reply.status(201).send({
      sessionId,
      puzzleId: body.puzzleId,
      startedAt: now.toISOString(),
      anonymousId: effectiveAnonymousId,
    })
  }

  // ── 2. POST /api/session/hint ────────────────────────────────────────────
  const hintHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = hintSessionSchema.parse(request.body)
    const { sessionId, nodeId, hintType } = body

    // 1. Verificar si la sesión existe
    let session = memorySessions.get(sessionId) ?? null

    if (!session && fastify.db) {
      try {
        const rows = await fastify.db
          .select()
          .from(playSessions)
          .where(eq(playSessions.id, sessionId))
          .limit(1)
        if (rows[0]) {
          const r = rows[0]
          session = {
            id: r.id,
            puzzleId: r.puzzleId,
            userId: r.userId,
            anonymousId: r.anonymousId,
            startedAt: r.startedAt,
            completedAt: r.completedAt,
            durationMs: r.durationMs,
            mistakesCount: r.mistakesCount ?? 0,
            hintsUsed: (r.hintsUsed as { nodeId: string; type: 'matrix' | 'reveal'; at: number }[]) ?? [],
            score: r.score,
            rankAchieved: r.rankAchieved,
            isComplete: r.isComplete ?? false,
          }
        }
      } catch (err) {
        fastify.log.warn({ err }, 'Error al verificar sesión en PostgreSQL')
      }
    }

    if (!session) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Sesión de juego '${sessionId}' no encontrada`,
      })
    }

    // 2. Obtener la solución o matriz del nodo
    let solutionText: string | null = null
    let initialLetter: string | null = null

    // Intentar leer de compiledAst en la base de datos
    if (fastify.db) {
      try {
        const pRows = await fastify.db
          .select()
          .from(puzzles)
          .where(eq(puzzles.id, session.puzzleId))
          .limit(1)

        const puzzleRow = pRows[0]
        if (puzzleRow?.compiledAst) {
          const ast = puzzleRow.compiledAst as Record<string, unknown>
          const astNodes = (ast['nodes'] ?? ast) as Record<string, Record<string, unknown>>
          const targetNode = astNodes[nodeId]
          if (targetNode) {
            solutionText = (targetNode['solution'] ?? targetNode['plaintext'] ?? null) as string | null
            initialLetter = (targetNode['initialLetter'] ?? (solutionText ? solutionText[0]?.toUpperCase() : null)) as string | null
          }
        }
      } catch (err) {
        fastify.log.warn({ err }, 'Error al leer compiledAst en base de datos')
      }
    }

    // Fallback a soluciones conocidas de demo
    if (!solutionText && DEMO_SOLUTIONS[nodeId]) {
      const demo = DEMO_SOLUTIONS[nodeId]
      solutionText = demo.solution
      initialLetter = demo.initialLetter
    }

    if (!solutionText && hintType === 'reveal') {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `No se encontró solución para el nodo '${nodeId}'`,
      })
    }

    // 3. Registrar el evento de ayuda en la sesión
    const hintEvent = {
      nodeId,
      type: hintType,
      at: Date.now(),
    }
    session.hintsUsed.push(hintEvent)

    if (fastify.db) {
      try {
        await fastify.db
          .update(playSessions)
          .set({ hintsUsed: session.hintsUsed })
          .where(eq(playSessions.id, sessionId))
      } catch (err) {
        fastify.log.warn({ err }, 'Error al actualizar hints en PostgreSQL')
      }
    }

    if (hintType === 'matrix') {
      return reply.send({
        success: true,
        hintType: 'matrix',
        nodeId,
        initialLetter: initialLetter ?? (solutionText ? solutionText[0]?.toUpperCase() : '?'),
      })
    }

    // Tipo 'reveal': único momento donde el servidor envía la solución en claro
    return reply.send({
      success: true,
      hintType: 'reveal',
      nodeId,
      solution: solutionText,
    })
  }

  // ── 3. POST /api/session/complete ────────────────────────────────────────
  const completeHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = completeSessionSchema.parse(request.body)
    const { sessionId, durationMs, mistakesCount, hintsUsed, score, rankAchieved } = body

    const now = new Date()

    // 1. Actualizar en memoria
    const session = memorySessions.get(sessionId)
    if (session) {
      session.completedAt = now
      session.durationMs = durationMs
      session.mistakesCount = mistakesCount
      session.hintsUsed = hintsUsed
      session.score = score
      session.rankAchieved = rankAchieved
      session.isComplete = true
    }

    // 2. Actualizar en PostgreSQL si hay base de datos
    if (fastify.db) {
      try {
        await fastify.db
          .update(playSessions)
          .set({
            completedAt: now,
            durationMs,
            mistakesCount,
            hintsUsed,
            score,
            rankAchieved,
            isComplete: true,
          })
          .where(eq(playSessions.id, sessionId))
      } catch (err) {
        fastify.log.warn({ err }, 'Error al actualizar resultado en PostgreSQL')
      }
    }

    // 3. Registrar puntuación en Redis con ZADD y calcular percentil
    const today = getTodayDateMadrid()
    const redisKey = getTimesRedisKey(today)
    const durationSec = Math.max(1, Math.floor(durationMs / 1000))

    await fastify.redis.zadd(redisKey, {
      score: durationSec,
      member: sessionId,
    })

    // Calcular percentil: jugadores con tiempo mayor (más lentos) / total de jugadores
    let percentile = 99
    try {
      const totalPlayers = await fastify.redis.zcount(redisKey, '-inf', '+inf')
      const slowerPlayers = await fastify.redis.zcount(redisKey, durationSec + 1, '+inf')

      if (totalPlayers > 1) {
        // Porcentaje de lectores superados (más lentos)
        percentile = Math.min(
          99,
          Math.max(1, Math.round((slowerPlayers / (totalPlayers - 1)) * 100)),
        )
      } else {
        percentile = 99 // Primer jugador del día
      }
    } catch (err) {
      fastify.log.warn({ err }, 'Error al calcular percentil con Redis')
    }

    return reply.send({
      success: true,
      sessionId,
      isComplete: true,
      score,
      rankAchieved,
      percentile,
    })
  }

  // ── 4. POST /api/auth/merge ──────────────────────────────────────────────
  const mergeHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = mergeSessionSchema.parse(request.body)
    const { anonymousId, userId, email, displayName } = body

    let mergedCount = 0

    // 1. Fusión en memoria (para modo desarrollo/test y persistencia local)
    for (const session of memorySessions.values()) {
      if (session.anonymousId === anonymousId) {
        session.userId = userId
        mergedCount++
      }
    }

    let stats = {
      totalPlays: 0,
      totalWins: 0,
      streakCurrent: 0,
      streakMax: 0,
    }

    // 2. Fusión y cálculo en PostgreSQL si hay base de datos conectada
    if (fastify.db) {
      try {
        // Asegurar que el usuario existe en users
        const existingUsers = await fastify.db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)

        if (existingUsers.length === 0) {
          await fastify.db.insert(users).values({
            id: userId,
            email: email ?? null,
            displayName: displayName ?? null,
            anonymousId: anonymousId,
          })
        }

        // Obtener sesiones anónimas a fusionar
        const anonSessions = await fastify.db
          .select()
          .from(playSessions)
          .where(eq(playSessions.anonymousId, anonymousId))

        // Obtener sesiones ya existentes del usuario para evitar violar unique(puzzle_id, user_id)
        const userExistingSessions = await fastify.db
          .select()
          .from(playSessions)
          .where(eq(playSessions.userId, userId))

        const existingPuzzleIds = new Set(userExistingSessions.map((s) => s.puzzleId))

        let dbMerged = 0
        for (const anonSess of anonSessions) {
          if (!existingPuzzleIds.has(anonSess.puzzleId)) {
            await fastify.db
              .update(playSessions)
              .set({ userId: userId })
              .where(eq(playSessions.id, anonSess.id))
            dbMerged++
          }
        }
        if (dbMerged > 0) {
          mergedCount = Math.max(mergedCount, dbMerged)
        }

        // Consultar todas las sesiones completas del usuario para calcular racha y estadísticas
        const allUserSessions = await fastify.db
          .select()
          .from(playSessions)
          .where(eq(playSessions.userId, userId))

        const totalPlays = allUserSessions.length
        const totalWins = allUserSessions.filter((s) => s.isComplete).length
        const completedDates: string[] = []
        for (const s of allUserSessions) {
          if (s.isComplete && s.completedAt) {
            completedDates.push(s.completedAt.toISOString().slice(0, 10))
          }
        }

        const streak = calculateStreak(completedDates, getTodayDateMadrid())
        stats = {
          totalPlays,
          totalWins,
          streakCurrent: streak.streakCurrent,
          streakMax: streak.streakMax,
        }

        // Actualizar estadísticas acumuladas en la tabla users
        await fastify.db
          .update(users)
          .set({
            streakCurrent: stats.streakCurrent,
            streakMax: stats.streakMax,
            totalPlays: stats.totalPlays,
            totalWins: stats.totalWins,
          })
          .where(eq(users.id, userId))
      } catch (err) {
        fastify.log.warn({ err }, 'Error durante la transacción de fusión en PostgreSQL')
      }
    }

    // Si no había DB, calcular estadísticas a partir de memorySessions
    if (!fastify.db) {
      const userSessions = Array.from(memorySessions.values()).filter(
        (s) => s.userId === userId,
      )
      const totalPlays = userSessions.length
      const totalWins = userSessions.filter((s) => s.isComplete).length
      const completedDates: string[] = []
      for (const s of userSessions) {
        if (s.isComplete && s.completedAt) {
          completedDates.push(s.completedAt.toISOString().slice(0, 10))
        }
      }

      const streak = calculateStreak(completedDates, getTodayDateMadrid())
      stats = {
        totalPlays,
        totalWins,
        streakCurrent: streak.streakCurrent,
        streakMax: streak.streakMax,
      }
    }

    return reply.send({
      success: true,
      userId,
      anonymousId,
      mergedSessionsCount: mergedCount,
      stats,
    })
  }

  // ── Registro de endpoints y aliases ───────────────────────────────────────
  fastify.post('/api/session/start', startHandler)
  fastify.post('/session/start', startHandler)

  // Rate limiting específico para hint (máximo 60 peticiones por minuto por IP)
  const hintRouteConfig = {
    config: {
      rateLimit: {
        max: 60,
        timeWindow: '1 minute',
      },
    },
  }

  fastify.post('/api/session/hint', hintRouteConfig, hintHandler)
  fastify.post('/session/hint', hintRouteConfig, hintHandler)

  fastify.post('/api/session/complete', completeHandler)
  fastify.post('/session/complete', completeHandler)

  fastify.post('/api/auth/merge', mergeHandler)
  fastify.post('/auth/merge', mergeHandler)
}

