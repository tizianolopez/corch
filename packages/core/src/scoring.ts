/**
 * Sistema de puntuación y rangos de Corchetes.
 * Fuente de verdad: arquitectura_corchetes.md §5.5 y §5.6
 *
 * Puntuación base: 100 puntos
 * Penalizaciones:
 *   - Error de respuesta: -5 pts (máx. acumulable: -40)
 *   - Solicitar matriz:   -8 pts
 *   - Revelar término:   -15 pts
 *   - Por tiempo:        -1 pt por cada 30s tras los 3 min (máx. -10)
 *
 * Rangos:
 *   100       → Gran Maestro
 *   85 – 99   → Maestro
 *   65 – 84   → Cronista
 *   40 – 64   → Escriba
 *   0  – 39   → Aprendiz
 */

import type { PuzzleState, PlayerRank } from './types'

// ─── Constantes de penalización ───────────────────────────────────────────────

export const SCORING = {
  BASE: 100,
  MISTAKE: -5,
  MAX_MISTAKE_PENALTY: -40,
  HINT_MATRIX: -8,
  HINT_REVEAL: -15,
  TIME_PENALTY_PER_UNIT: -1,
  TIME_PENALTY_MAX: -10,
  /** Segundos de gracia antes de empezar a penalizar por tiempo */
  TIME_GRACE_SECONDS: 180,
  /** Cada cuántos segundos se aplica 1 punto de penalización de tiempo */
  TIME_PENALTY_INTERVAL_SECONDS: 30,
} as const

// ─── Cálculo de puntuación ────────────────────────────────────────────────────

/**
 * Calcula la puntuación final al completar una partida.
 *
 * @param state - PuzzleState con completedAt definido
 * @returns Puntuación de 0 a 100
 */
export function calculateScore(state: PuzzleState): number {
  if (state.completedAt === null) {
    throw new Error('calculateScore: la partida no ha terminado (completedAt es null)')
  }

  let score = SCORING.BASE

  // ── Penalización por errores ─────────────────────────────────────────────
  const mistakePenalty = Math.max(
    state.mistakesCount * SCORING.MISTAKE,
    SCORING.MAX_MISTAKE_PENALTY,
  )
  score += mistakePenalty

  // ── Penalización por ayudas ──────────────────────────────────────────────
  for (const hint of state.hintsUsed) {
    if (hint.type === 'matrix') {
      score += SCORING.HINT_MATRIX
    } else {
      score += SCORING.HINT_REVEAL
    }
  }

  // ── Penalización por tiempo ──────────────────────────────────────────────
  const durationSeconds = Math.floor((state.completedAt - state.startedAt) / 1000)
  const overtimeSeconds = Math.max(0, durationSeconds - SCORING.TIME_GRACE_SECONDS)
  const timeUnits = Math.floor(overtimeSeconds / SCORING.TIME_PENALTY_INTERVAL_SECONDS)
  const timePenalty = Math.max(
    timeUnits * SCORING.TIME_PENALTY_PER_UNIT,
    SCORING.TIME_PENALTY_MAX,
  )
  score += timePenalty

  // La puntuación nunca puede ser negativa
  return Math.max(0, score)
}

/**
 * Aplica la penalización de un error al score en curso.
 * Se usa durante la partida (no al final) para mostrar el score en tiempo real.
 *
 * @param currentScore - Puntuación actual
 * @param mistakesCount - Número total de errores (incluyendo el nuevo)
 * @returns Nueva puntuación
 */
export function applyMistakePenalty(currentScore: number, mistakesCount: number): number {
  // Solo aplicamos penalización si no hemos llegado al máximo acumulable
  // El máximo de penalización por errores equivale a SCORING.MAX_MISTAKE_PENALTY / SCORING.MISTAKE errores
  const maxMistakesForPenalty = Math.abs(SCORING.MAX_MISTAKE_PENALTY / SCORING.MISTAKE)
  if (mistakesCount > maxMistakesForPenalty) return currentScore

  return Math.max(0, currentScore + SCORING.MISTAKE)
}

// ─── Sistema de rangos ────────────────────────────────────────────────────────

/**
 * Devuelve el rango del jugador según su puntuación final.
 *
 * @param score - Puntuación de 0 a 100
 * @returns PlayerRank
 */
export function getRank(score: number): PlayerRank {
  if (score === 100) return 'Gran Maestro'
  if (score >= 85) return 'Maestro'
  if (score >= 65) return 'Cronista'
  if (score >= 40) return 'Escriba'
  return 'Aprendiz'
}
