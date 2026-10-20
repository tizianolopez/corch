/**
 * Motor de estado del juego de Corchetes.
 *
 * Gestiona el ciclo de vida de la partida:
 * - onSubmit: validación de respuesta del jugador (via hash en cliente)
 * - applyHint: aplicación de ayudas
 * - generateCronica: generación del texto tipográfico para compartir
 *
 * Fuente de verdad: arquitectura_corchetes.md §5.3 y §12.1
 *
 * IMPORTANTE: La validación se hace comparando el hash de la respuesta
 * normalizada con el solutionHash del nodo. La solución NUNCA viaja
 * en texto plano. Ver packages/crypto para los detalles de seguridad.
 */

import { getActiveNodes, isPuzzleComplete, recalculateActiveNodes, resolveNode } from './parser'
import { normalize } from './normalize'
import { applyMistakePenalty, calculateScore, getRank } from './scoring'
import type { HintType, PlayerRank, PuzzleState, SubmitResult } from './types'

// ─── Tipo de la función de hash (inyectada para evitar side-effects en tests) ─

/**
 * Función de hash SHA-256 inyectable.
 * En producción: packages/crypto sha256().
 * En tests: función síncrona simple o mock.
 */
export type HashFn = (input: string) => Promise<string>

/**
 * Función de descifrado AES-GCM inyectable.
 * En producción: packages/crypto aesGcmDecrypt().
 * En tests: función que devuelve el plaintext directamente (sin cifrado real).
 */
export type DecryptFn = (cipher: string, key: string) => Promise<string>

// ─── onSubmit ─────────────────────────────────────────────────────────────────

/**
 * Procesa el intento de respuesta del jugador.
 *
 * Algoritmo:
 * 1. Normalizar el input.
 * 2. Para cada nodo activo, calcular SHA-256(normalized:puzzleId:nodeId:dailySalt).
 * 3. Si el hash coincide con node.solutionHash:
 *    a. Descifrar node.solutionCipher con la respuesta normalizada como clave.
 *    b. Marcar el nodo como resuelto.
 *    c. Recalcular nodos activos (cascade upward).
 *    d. Si el puzle está completo, calcular score final.
 * 4. Si no coincide con ningún nodo: incrementar errores, penalizar score.
 *
 * @param input - Texto escrito por el jugador
 * @param state - Estado actual de la partida
 * @param dailySalt - Salt público del día (del ClientPayload)
 * @param hashFn - Función de hash SHA-256
 * @param decryptFn - Función de descifrado AES-GCM
 * @returns [SubmitResult, PuzzleState actualizado]
 */
export async function onSubmit(
  input: string,
  state: PuzzleState,
  dailySalt: string,
  hashFn: HashFn,
  decryptFn: DecryptFn,
): Promise<[SubmitResult, PuzzleState]> {
  const normalized = normalize(input)

  if (normalized.length === 0) {
    return [{ success: false }, state]
  }

  const activeNodes = getActiveNodes(state)

  for (const node of activeNodes) {
    // Construir el candidato de hash igual que el servidor en compilePuzzlePayload
    const candidate = `${normalized}:${state.puzzleId}:${node.id}:${dailySalt}`
    const candidateHash = await hashFn(candidate)

    if (candidateHash === node.solutionHash) {
      // ✓ ACIERTO: descifrar el texto original y resolver el nodo
      const resolvedText = await decryptFn(node.solutionCipher, normalized)

      let newState = resolveNode(state, node.id, resolvedText)
      newState = recalculateActiveNodes(newState)

      const isComplete = isPuzzleComplete(newState)

      if (isComplete) {
        const completedAt = Date.now()
        newState = { ...newState, completedAt }
        const finalScore = calculateScore(newState)
        newState = { ...newState, score: finalScore }
      }

      return [
        { success: true, resolvedNodeId: node.id, resolvedText, isComplete },
        newState,
      ]
    }
  }

  // ✗ ERROR: ningún nodo activo coincide
  const newMistakesCount = state.mistakesCount + 1
  const newScore = applyMistakePenalty(state.score, newMistakesCount)

  return [
    { success: false },
    { ...state, mistakesCount: newMistakesCount, score: newScore },
  ]
}

// ─── applyHint ────────────────────────────────────────────────────────────────

/**
 * Aplica una ayuda al nodo especificado.
 *
 * Para 'matrix': registra el evento de ayuda y descuenta puntos.
 *   El texto de la matriz (patrón de letras) se devuelve por el servidor.
 *
 * Para 'reveal': marca el nodo como resuelto con revealedWithHint=true.
 *   El resolvedText lo proporciona el servidor (único momento donde llega en claro).
 *
 * @param nodeId - ID del nodo al que aplicar la ayuda
 * @param hintType - 'matrix' o 'reveal'
 * @param resolvedText - Solo para 'reveal': texto descifrado recibido del servidor
 * @param state - Estado actual
 * @returns Nuevo PuzzleState
 */
export function applyHint(
  nodeId: string,
  hintType: HintType,
  state: PuzzleState,
  resolvedText?: string,
): PuzzleState {
  const hintEvent = { nodeId, type: hintType, at: Date.now() }

  let newState: PuzzleState = {
    ...state,
    hintsUsed: [...state.hintsUsed, hintEvent],
  }

  if (hintType === 'reveal' && resolvedText !== undefined) {
    newState = resolveNode(newState, nodeId, resolvedText, true)
    newState = recalculateActiveNodes(newState)

    if (isPuzzleComplete(newState)) {
      const completedAt = Date.now()
      newState = { ...newState, completedAt }
      const finalScore = calculateScore(newState)
      newState = { ...newState, score: finalScore }
    }
  }

  return newState
}

// ─── generateCronica ──────────────────────────────────────────────────────────

/**
 * Genera el texto tipográfico para compartir el resultado de la partida.
 *
 * Formato (arquitectura_corchetes.md §12.1):
 *
 *   CORCHETES — Edición N.º 142
 *   Martes, 20 de octubre de 2026
 *   ──────────────────────────────
 *   Estructura · [ [ · ] [ [ · ] † ] ]
 *   Precisión  · 92 %  (1 consulta al archivo)
 *   Tiempo     · 02m 18s
 *   Rango      · Maestro
 *   ──────────────────────────────
 *   corchetes.es
 *
 * Leyenda de "Estructura":
 *   · = nodo resuelto limpiamente
 *   † = nodo resuelto con "Revelar término"
 *   Las pistas de tipo 'matrix' NO aparecen en la estructura
 *   (solo afectan a la precisión).
 *
 * IMPORTANTE: No se revela ninguna palabra de la solución.
 *
 * @param state - PuzzleState completado
 * @returns Cadena de texto lista para copiar al portapapeles
 */
export function generateCronica(state: PuzzleState): string {
  if (state.completedAt === null) {
    throw new Error('generateCronica: la partida no ha terminado')
  }

  const rank: PlayerRank = getRank(state.score)
  const durationMs = state.completedAt - state.startedAt
  const timeStr = formatDuration(durationMs)
  const date = new Date(state.publishDate + 'T00:00:00')
  const dateStr = formatSpanishDate(date)
  const editionStr = state.editionNumber.toString().padStart(3, '0')

  // Calcular estructura del árbol como esqueleto de corchetes
  const estructura = buildEstructura(state)

  // Calcular precisión
  const totalAttempts = state.mistakesCount + Object.values(state.nodes).length
  const precision = Math.round((Object.values(state.nodes).length / totalAttempts) * 100)
  const matrixHints = state.hintsUsed.filter((h) => h.type === 'matrix').length
  const precisionNote = matrixHints > 0 ? ` (${matrixHints.toString()} consulta${matrixHints > 1 ? 's' : ''} al archivo)` : ''

  const divider = '──────────────────────────────'

  return [
    `CORCHETES — Edición N.º ${editionStr}`,
    dateStr,
    divider,
    `Estructura · ${estructura}`,
    `Precisión  · ${precision.toString()} %${precisionNote}`,
    `Tiempo     · ${timeStr}`,
    `Rango      · ${rank}`,
    divider,
    'corchetes.es',
  ].join('\n')
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

/**
 * Construye el esqueleto de corchetes para la línea "Estructura".
 * Recorre el árbol en profundidad y genera la representación sin revelar palabras.
 */
function buildEstructura(state: PuzzleState): string {
  // Encontrar los nodos raíz (sin padre)
  const rootNodeIds = Object.keys(state.nodes).filter(
    (id) => state.nodes[id]?.parent === null,
  )

  function renderNode(nodeId: string): string {
    const node = state.nodes[nodeId]
    if (node === undefined) return ''

    const symbol = node.revealedWithHint ? '†' : '·'

    if (node.children.length === 0) {
      return `[ ${symbol} ]`
    }

    const childrenStr = node.children.map((childId) => renderNode(childId)).join(' ')
    return `[ ${childrenStr} ${symbol} ]`
  }

  return rootNodeIds.map((id) => renderNode(id)).join(' ')
}

/**
 * Formatea una duración en milisegundos como "02m 18s".
 */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
}

/**
 * Formatea una fecha como "Martes, 20 de octubre de 2026" en español.
 */
function formatSpanishDate(date: Date): string {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  const dayName = days[date.getDay()] ?? ''
  const month = months[date.getMonth()] ?? ''
  return `${dayName}, ${date.getDate().toString()} de ${month} de ${date.getFullYear().toString()}`
}
