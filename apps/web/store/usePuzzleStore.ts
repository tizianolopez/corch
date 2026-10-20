/**
 * usePuzzleStore — Estado global del juego con Zustand
 *
 * Contiene el PuzzleState de @corchetes/core y expone las acciones principales:
 *   - loadPuzzle: carga el puzzle desde un ClientPayload
 *   - submitAnswer: valida la respuesta del jugador (hash en cliente)
 *   - requestHint: solicita ayuda ('matrix' | 'reveal')
 *   - resetGame: reinicia a estado vacío
 *   - setSelectedNode: actualiza el nodo actualmente seleccionado
 *
 * La persistencia en localStorage se implementa en la Tarea 1.7.
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import {
  onSubmit,
  applyHint,
  recalculateActiveNodes,
  getActiveNodes,
  initPuzzleState,
  type PuzzleState,
  type ClueNode,
  type ClientPayload,
  type HashFn,
  type DecryptFn,
  type SubmitResult,
} from '@corchetes/core'

// ── Contexto criptográfico (inyectado al cargar el puzzle) ─────────────────

interface CryptoCtx {
  dailySalt: string
  hashFn: HashFn
  decryptFn: DecryptFn
}

// ── Tipos del store ────────────────────────────────────────────────────────

export interface GameStore {
  /** Estado completo del puzzle (null si no hay puzzle cargado) */
  puzzleState: PuzzleState | null

  /** Contexto criptográfico del día (salt + funciones) */
  cryptoCtx: CryptoCtx | null

  /** ID del nodo actualmente seleccionado por el jugador */
  selectedNodeId: string | null

  /** ID del nodo que acaba de resolverse (para animación linotipia) */
  justResolvedId: string | null

  /** ID del nodo que acaba de desbloquearse (para animación cascade) */
  justUnlockedId: string | null

  /** Último intento fue incorrecto (para animación shake del InputBar) */
  lastAnswerWrong: boolean

  // ── Acciones ────────────────────────────────────────────────────────────

  /**
   * Carga un puzzle desde el ClientPayload recibido del servidor.
   * Inicializa el estado con los nodos activos calculados.
   */
  loadPuzzle: (payload: ClientPayload, hashFn: HashFn, decryptFn: DecryptFn) => void

  /**
   * Valida la respuesta del jugador para el nodo seleccionado.
   * Actualiza el estado, anima la resolución y desbloquea padres si corresponde.
   */
  submitAnswer: (input: string) => Promise<SubmitResult>

  /**
   * Solicita una ayuda para el nodo seleccionado.
   * 'matrix' → letra inicial (se conectará al backend en Fase 2)
   * 'reveal' → revela el término con penalización; requiere resolvedText del backend
   */
  requestHint: (type: 'matrix' | 'reveal', resolvedText?: string) => void

  /** Reinicia el juego a estado vacío */
  resetGame: () => void

  /** Actualiza el nodo seleccionado */
  setSelectedNode: (nodeId: string | null) => void

  /** Limpia los flags de animación (llamado tras el timeout de animación) */
  clearAnimationFlags: () => void
}

// ── Store ──────────────────────────────────────────────────────────────────

export const usePuzzleStore = create<GameStore>()(
  subscribeWithSelector((set, get) => ({
    // ── Estado inicial ───────────────────────────────────────────────────
    puzzleState: null,
    cryptoCtx: null,
    selectedNodeId: null,
    justResolvedId: null,
    justUnlockedId: null,
    lastAnswerWrong: false,

    // ── loadPuzzle ───────────────────────────────────────────────────────
    loadPuzzle: (payload, hashFn, decryptFn) => {
      const initialState = initPuzzleState(payload)
      const withActive = recalculateActiveNodes(initialState)
      const activeNodes = getActiveNodes(withActive)
      const firstActive = activeNodes[0]?.id ?? null

      set({
        puzzleState: withActive,
        cryptoCtx: { dailySalt: payload.dailySalt, hashFn, decryptFn },
        selectedNodeId: firstActive,
        justResolvedId: null,
        justUnlockedId: null,
        lastAnswerWrong: false,
      })
    },

    // ── submitAnswer ─────────────────────────────────────────────────────
    submitAnswer: async (input) => {
      const { puzzleState, cryptoCtx } = get()
      if (!puzzleState || !cryptoCtx) return { success: false }

      const [result, nextState] = await onSubmit(
        input,
        puzzleState,
        cryptoCtx.dailySalt,
        cryptoCtx.hashFn,
        cryptoCtx.decryptFn,
      )

      if (result.success) {
        const { resolvedNodeId } = result

        // Detectar qué padre se desbloqueó en cascada
        const parentId = puzzleState.nodes[resolvedNodeId]?.parent ?? null
        let unlockedParentId: string | null = null

        if (parentId) {
          const parentAfter = nextState.nodes[parentId]
          const parentBefore = puzzleState.nodes[parentId]
          if (parentAfter?.isActive && !parentBefore?.isActive) {
            unlockedParentId = parentId
          }
        }

        const activeNodes = getActiveNodes(nextState)
        const nextSelected = unlockedParentId ?? activeNodes[0]?.id ?? null

        set({
          puzzleState: nextState,
          justResolvedId: resolvedNodeId,
          justUnlockedId: unlockedParentId,
          selectedNodeId: nextSelected,
          lastAnswerWrong: false,
        })

        setTimeout(() => set({ justResolvedId: null, justUnlockedId: null }), 2000)
      } else {
        // Respuesta incorrecta
        set({
          puzzleState: nextState,
          lastAnswerWrong: true,
        })
        setTimeout(() => set({ lastAnswerWrong: false }), 600)
      }

      return result
    },

    // ── requestHint ──────────────────────────────────────────────────────
    requestHint: (type, resolvedText) => {
      const { puzzleState, selectedNodeId } = get()
      if (!puzzleState || !selectedNodeId) return

      const nextState = applyHint(selectedNodeId, type, puzzleState, resolvedText)

      if (type === 'reveal' && resolvedText !== undefined) {
        const parentId = puzzleState.nodes[selectedNodeId]?.parent ?? null
        let unlockedParentId: string | null = null

        if (parentId) {
          const parentAfter = nextState.nodes[parentId]
          const parentBefore = puzzleState.nodes[parentId]
          if (parentAfter?.isActive && !parentBefore?.isActive) {
            unlockedParentId = parentId
          }
        }

        const activeNodes = getActiveNodes(nextState)
        const nextSelected = unlockedParentId ?? activeNodes[0]?.id ?? null

        set({
          puzzleState: nextState,
          justResolvedId: selectedNodeId,
          justUnlockedId: unlockedParentId,
          selectedNodeId: nextSelected,
        })

        setTimeout(() => set({ justResolvedId: null, justUnlockedId: null }), 2000)
      } else {
        // 'matrix': solo actualiza el contador de ayudas
        set({ puzzleState: nextState })
      }
    },

    // ── resetGame ────────────────────────────────────────────────────────
    resetGame: () => {
      set({
        puzzleState: null,
        cryptoCtx: null,
        selectedNodeId: null,
        justResolvedId: null,
        justUnlockedId: null,
        lastAnswerWrong: false,
      })
    },

    // ── setSelectedNode ──────────────────────────────────────────────────
    setSelectedNode: (nodeId) => {
      set({ selectedNodeId: nodeId })
    },

    // ── clearAnimationFlags ───────────────────────────────────────────────
    clearAnimationFlags: () => {
      set({ justResolvedId: null, justUnlockedId: null, lastAnswerWrong: false })
    },
  })),
)

// ── Selectores de conveniencia ─────────────────────────────────────────────

/** Devuelve true si el puzzle está completado */
export const selectIsCompleted = (s: GameStore): boolean =>
  s.puzzleState?.completedAt != null

/** Devuelve los nodos activos actuales */
export const selectActiveNodes = (s: GameStore): ClueNode[] =>
  s.puzzleState ? getActiveNodes(s.puzzleState) : []

/** Devuelve el nodo seleccionado actualmente */
export const selectSelectedNode = (s: GameStore): ClueNode | null =>
  s.selectedNodeId && s.puzzleState
    ? (s.puzzleState.nodes[s.selectedNodeId] ?? null)
    : null
