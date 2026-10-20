/**
 * @corchetes/core — Motor de juego de Corchetes
 *
 * Exports públicos del paquete:
 * - Tipos TypeScript del dominio
 * - Parser de markup y gestión del árbol
 * - Normalización de input en español
 * - Motor de estado (onSubmit, applyHint)
 * - Puntuación y rangos
 * - Generador de crónica para compartir
 */

// Tipos
export type {
  ClueType,
  HintType,
  ClueNode,
  PuzzleState,
  ClientClueNode,
  ClientPayload,
  SubmitResult,
  PlayerRank,
  HintEvent,
} from './types'

// Parser y árbol
export {
  parsePuzzleMarkup,
  initPuzzleState,
  getActiveNodes,
  isPuzzleComplete,
  recalculateActiveNodes,
  resolveNode,
} from './parser'

export type { ParseResult } from './parser'

// Normalización
export { normalize, normalizedEquals } from './normalize'

// Motor de estado
export { onSubmit, applyHint, generateCronica } from './engine'
export type { HashFn, DecryptFn } from './engine'

// Puntuación y rangos
export { calculateScore, getRank, applyMistakePenalty, SCORING } from './scoring'
