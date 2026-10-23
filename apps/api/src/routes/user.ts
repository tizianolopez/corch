/**
 * @module routes/user
 *
 * Endpoints para consulta de estadísticas de usuario e historial de partidas:
 * - GET /api/user/:userId/stats
 * - GET /api/user/:userId/history
 *
 * Fuente de verdad: docs/tasks.md §5.4 y docs/architecture.md
 */

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { eq, desc } from 'drizzle-orm'
import { playSessions, puzzles, users } from '@corchetes/db'
import { calculateStreak } from '@corchetes/core'
import { getTodayDateMadrid } from '../utils/time'
import { memorySessions } from './session'

const userIdParamSchema = z.object({
  userId: z.string().min(1),
})

export interface UserStatsResponse {
  userId: string
  email: string | null
  displayName: string | null
  streakCurrent: number
  streakMax: number
  totalPlays: number
  totalWins: number
  winRate: number
}

export interface UserHistoryItem {
  sessionId: string
  puzzleId: string
  editionNumber: number | null
  publishDate: string | null
  quoteAuthor: string | null
  quoteWork: string | null
  score: number | null
  rankAchieved: string | null
  durationMs: number | null
  mistakesCount: number
  hintsCount: number
  isComplete: boolean
  completedAt: string | null
  startedAt: string
}

export interface UserHistoryResponse {
  userId: string
  history: UserHistoryItem[]
}

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  // ── 1. GET /api/user/:userId/stats ─────────────────────────────────────────
  const getStatsHandler = async (
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply,
  ) => {
    const { userId } = userIdParamSchema.parse(request.params)

    // Breve caché HTTP de 15 segundos
    reply.header('Cache-Control', 'private, max-age=15')

    // 1. Intentar leer desde PostgreSQL si hay base de datos conectada
    if (fastify.db) {
      try {
        const userRows = await fastify.db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)

        const user = userRows[0]
        if (user) {
          const totalPlays = user.totalPlays ?? 0
          const totalWins = user.totalWins ?? 0
          const winRate = totalPlays > 0 ? Math.round((totalWins / totalPlays) * 100) / 100 : 0

          return reply.send({
            userId: user.id,
            email: user.email,
            displayName: user.displayName,
            streakCurrent: user.streakCurrent ?? 0,
            streakMax: user.streakMax ?? 0,
            totalPlays,
            totalWins,
            winRate,
          } satisfies UserStatsResponse)
        }
      } catch (err) {
        fastify.log.warn({ err }, 'Error al consultar stats de usuario en PostgreSQL')
      }
    }

    // 2. Fallback con sesiones en memoria
    const userSessions = Array.from(memorySessions.values()).filter(
      (s) => s.userId === userId,
    )
    const totalPlays = userSessions.length
    const totalWins = userSessions.filter((s) => s.isComplete).length
    const winRate = totalPlays > 0 ? Math.round((totalWins / totalPlays) * 100) / 100 : 0

    const completedDates: string[] = []
    for (const s of userSessions) {
      if (s.isComplete && s.completedAt) {
        completedDates.push(s.completedAt.toISOString().slice(0, 10))
      }
    }

    const streak = calculateStreak(completedDates, getTodayDateMadrid())

    return reply.send({
      userId,
      email: null,
      displayName: null,
      streakCurrent: streak.streakCurrent,
      streakMax: streak.streakMax,
      totalPlays,
      totalWins,
      winRate,
    } satisfies UserStatsResponse)
  }

  // ── 2. GET /api/user/:userId/history ───────────────────────────────────────
  const getHistoryHandler = async (
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply,
  ) => {
    const { userId } = userIdParamSchema.parse(request.params)

    reply.header('Cache-Control', 'private, max-age=15')

    // 1. Intentar consultar PostgreSQL
    if (fastify.db) {
      try {
        const rows = await fastify.db
          .select({
            sessionId: playSessions.id,
            puzzleId: playSessions.puzzleId,
            editionNumber: puzzles.editionNumber,
            publishDate: puzzles.publishDate,
            quoteAuthor: puzzles.quoteAuthor,
            quoteWork: puzzles.quoteWork,
            score: playSessions.score,
            rankAchieved: playSessions.rankAchieved,
            durationMs: playSessions.durationMs,
            mistakesCount: playSessions.mistakesCount,
            hintsUsed: playSessions.hintsUsed,
            isComplete: playSessions.isComplete,
            completedAt: playSessions.completedAt,
            startedAt: playSessions.startedAt,
          })
          .from(playSessions)
          .leftJoin(puzzles, eq(playSessions.puzzleId, puzzles.id))
          .where(eq(playSessions.userId, userId))
          .orderBy(desc(playSessions.startedAt))

        const history: UserHistoryItem[] = rows.map((r) => {
          const hintsArray = Array.isArray(r.hintsUsed) ? r.hintsUsed : []
          return {
            sessionId: r.sessionId,
            puzzleId: r.puzzleId,
            editionNumber: r.editionNumber ?? null,
            publishDate: r.publishDate ?? null,
            quoteAuthor: r.quoteAuthor ?? null,
            quoteWork: r.quoteWork ?? null,
            score: r.score ?? null,
            rankAchieved: r.rankAchieved ?? null,
            durationMs: r.durationMs ?? null,
            mistakesCount: r.mistakesCount ?? 0,
            hintsCount: hintsArray.length,
            isComplete: r.isComplete ?? false,
            completedAt: r.completedAt ? r.completedAt.toISOString() : null,
            startedAt: r.startedAt.toISOString(),
          }
        })

        return reply.send({
          userId,
          history,
        } satisfies UserHistoryResponse)
      } catch (err) {
        fastify.log.warn({ err }, 'Error al consultar historial de usuario en PostgreSQL')
      }
    }

    // 2. Fallback de historial con sesiones en memoria
    const userSessions = Array.from(memorySessions.values())
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())

    const history: UserHistoryItem[] = userSessions.map((s) => ({
      sessionId: s.id,
      puzzleId: s.puzzleId,
      editionNumber: 142,
      publishDate: getTodayDateMadrid(),
      quoteAuthor: 'Miguel de Cervantes',
      quoteWork: 'Don Quijote de la Mancha',
      score: s.score,
      rankAchieved: s.rankAchieved,
      durationMs: s.durationMs,
      mistakesCount: s.mistakesCount,
      hintsCount: s.hintsUsed.length,
      isComplete: s.isComplete,
      completedAt: s.completedAt ? s.completedAt.toISOString() : null,
      startedAt: s.startedAt.toISOString(),
    }))

    return reply.send({
      userId,
      history,
    } satisfies UserHistoryResponse)
  }

  fastify.get('/api/user/:userId/stats', getStatsHandler)
  fastify.get('/user/:userId/stats', getStatsHandler)

  fastify.get('/api/user/:userId/history', getHistoryHandler)
  fastify.get('/user/:userId/history', getHistoryHandler)
}
