/**
 * usePuzzlePersistence — Hook para persistir y restaurar el estado del juego
 * en localStorage.
 *
 * Tarea 1.7:
 * - Serializa el PuzzleState tras cada acción (via subscripción a Zustand)
 * - Restaura el estado al cargar la página si la edición es la de hoy
 * - Limpia estados de días anteriores automáticamente
 *
 * La clave de localStorage es: `corchetes:puzzle:{publishDate}`
 * La clave del índice de ediciones guardadas: `corchetes:editions`
 */

'use client'

import { useEffect } from 'react'
import { usePuzzleStore } from './usePuzzleStore'
import type { PuzzleState } from '@corchetes/core'

// ── Constantes ────────────────────────────────────────────────────────────

const PREFIX = 'corchetes:puzzle:'
const EDITIONS_KEY = 'corchetes:editions'
/** Días máximos de historial que se conservan */
const MAX_EDITIONS = 7

// ── Helpers ───────────────────────────────────────────────────────────────

function getToday(): string {
  return new Date().toISOString().slice(0, 10)
}

export interface PersistedGameData {
  state: PuzzleState
  sessionId: string | null
  percentile: number | null
}

function storageKey(publishDate: string): string {
  return `${PREFIX}${publishDate}`
}

export function saveState(
  state: PuzzleState,
  sessionId: string | null,
  percentile: number | null,
): void {
  if (typeof localStorage === 'undefined') return

  try {
    const key = storageKey(state.publishDate)
    const payload: PersistedGameData = { state, sessionId, percentile }
    localStorage.setItem(key, JSON.stringify(payload))

    // Actualizar el índice de ediciones guardadas
    const raw = localStorage.getItem(EDITIONS_KEY)
    const editions: string[] = raw ? (JSON.parse(raw) as string[]) : []

    if (!editions.includes(state.publishDate)) {
      editions.push(state.publishDate)
    }

    // Ordenar por fecha descendente y conservar solo MAX_EDITIONS
    const sorted = editions.sort((a, b) => b.localeCompare(a)).slice(0, MAX_EDITIONS)
    localStorage.setItem(EDITIONS_KEY, JSON.stringify(sorted))

    // Limpiar ediciones antiguas que ya no están en el índice
    const keysToRemove = editions.filter((d) => !sorted.includes(d))
    for (const date of keysToRemove) {
      localStorage.removeItem(storageKey(date))
    }
  } catch {
    // localStorage lleno o no disponible — ignorar silenciosamente
  }
}

/**
 * Intenta recuperar el estado y metadatos guardados para la fecha de hoy.
 * Devuelve null si no hay datos guardados o si están corrompidos.
 */
export function loadSavedState(publishDate: string): PersistedGameData | null {
  if (typeof localStorage === 'undefined') return null

  try {
    const raw = localStorage.getItem(storageKey(publishDate))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>

    if (parsed.state && typeof parsed.state === 'object') {
      return {
        state: parsed.state as PuzzleState,
        sessionId: (parsed.sessionId as string) ?? null,
        percentile: typeof parsed.percentile === 'number' ? parsed.percentile : null,
      }
    }

    // Compatibilidad retroactiva: formato anterior que guardaba directamente el PuzzleState
    if (parsed.nodes && typeof parsed.nodes === 'object') {
      return {
        state: parsed as unknown as PuzzleState,
        sessionId: null,
        percentile: null,
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Limpia todos los estados de ediciones anteriores a `keepDate`.
 */
export function clearOldEditions(keepDate: string): void {
  if (typeof localStorage === 'undefined') return

  try {
    const raw = localStorage.getItem(EDITIONS_KEY)
    const editions: string[] = raw ? (JSON.parse(raw) as string[]) : []

    const toRemove = editions.filter((d) => d < keepDate)
    for (const date of toRemove) {
      localStorage.removeItem(storageKey(date))
    }

    const remaining = editions.filter((d) => d >= keepDate)
    localStorage.setItem(EDITIONS_KEY, JSON.stringify(remaining))
  } catch {
    // Ignorar
  }
}

// ── Hook principal ────────────────────────────────────────────────────────

/**
 * Hook que activa la persistencia automática del estado del juego.
 * Debe llamarse UNA SOLA VEZ en el componente raíz del juego.
 *
 * Al montar:
 * 1. Limpia ediciones de más de MAX_EDITIONS días
 * 2. Se suscribe al store y serializa en cada cambio de puzzleState, sessionId o percentile
 */
export function usePuzzlePersistence(): void {
  useEffect(() => {
    const today = getToday()

    // Limpiar ediciones antiguas al arrancar
    clearOldEditions(today)

    // Suscripción granular: serializa cuando cambia puzzleState, sessionId o percentile
    const unsub = usePuzzleStore.subscribe(
      (state) => ({
        puzzleState: state.puzzleState,
        sessionId: state.sessionId,
        percentile: state.percentile,
      }),
      ({ puzzleState, sessionId, percentile }) => {
        if (puzzleState) {
          saveState(puzzleState, sessionId, percentile)
        }
      },
    )

    return unsub
  }, [])
}

/**
 * Restaura el estado de hoy desde localStorage e inicializa el store.
 * Devuelve el registro guardado o null si no existe.
 */
export function restoreTodayState(): PersistedGameData | null {
  const today = getToday()
  return loadSavedState(today)
}
