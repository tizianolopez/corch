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

function storageKey(publishDate: string): string {
  return `${PREFIX}${publishDate}`
}

function saveState(state: PuzzleState): void {
  if (typeof localStorage === 'undefined') return

  try {
    const key = storageKey(state.publishDate)
    localStorage.setItem(key, JSON.stringify(state))

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
 * Intenta recuperar el estado guardado para la fecha de hoy.
 * Devuelve null si no hay estado guardado o si está corrompido.
 */
export function loadSavedState(publishDate: string): PuzzleState | null {
  if (typeof localStorage === 'undefined') return null

  try {
    const raw = localStorage.getItem(storageKey(publishDate))
    if (!raw) return null
    return JSON.parse(raw) as PuzzleState
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
 * 2. Se suscribe al store y serializa en cada cambio de puzzleState
 */
export function usePuzzlePersistence(): void {
  useEffect(() => {
    const today = getToday()

    // Limpiar ediciones antiguas al arrancar
    clearOldEditions(today)

    // Suscripción granular: solo reacciona cuando puzzleState cambia
    const unsub = usePuzzleStore.subscribe(
      (state) => state.puzzleState,
      (puzzleState) => {
        if (puzzleState) {
          saveState(puzzleState)
        }
      },
    )

    return unsub
  }, [])
}

/**
 * Restaura el estado de hoy desde localStorage e inicializa el store.
 * Devuelve true si se restauró un estado previo, false en caso contrario.
 *
 * Debe llamarse desde el servidor o en el useEffect inicial del componente
 * de juego, ANTES de llamar a loadPuzzle si el estado ya existe.
 */
export function restoreTodayState(): PuzzleState | null {
  const today = getToday()
  return loadSavedState(today)
}
