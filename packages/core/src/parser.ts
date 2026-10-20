/**
 * Parser de markup de Corchetes.
 *
 * Convierte una cadena con corchetes anidados en un árbol de ClueNode.
 * Usa un algoritmo de pila (stack) para construir la jerarquía.
 *
 * Formato del markup:
 *   "Texto fijo [pista externa [pista interna]] más texto"
 *
 * El texto entre los corchetes es el texto de la pista (clueText).
 * Las soluciones se añaden después de parsear (en el servidor).
 *
 * Fuente de verdad: arquitectura_corchetes.md §5.2
 */

import type { ClueNode, ClueType, PuzzleState, ClientPayload } from './types'

// ─── Tipos internos del parser ────────────────────────────────────────────────

interface ParsedNode {
  id: string
  /** Texto de la pista, puede contener referencias a hijos: {{n3}} */
  clueText: string
  children: string[]
  parent: string | null
}

export interface ParseResult {
  /** Plantilla del texto raíz con placeholders {{n1}}, {{n2}}... */
  rootTemplate: string
  /** Nodos parseados, sin soluciones (las añade el servidor) */
  nodes: Record<string, ParsedNode>
}

// ─── Parser principal ─────────────────────────────────────────────────────────

/**
 * Parsea el markup escrito por el editor y devuelve la estructura del árbol.
 *
 * @param markup - Cadena con corchetes anidados, ej:
 *   "«Texto [pista A [pista B]] más texto»"
 * @returns ParseResult con rootTemplate y nodos
 * @throws Error si los corchetes no están balanceados
 *
 * @example
 * parsePuzzleMarkup("El [río [que pasa por Gerona]] es largo")
 * // → rootTemplate: "El {{n1}} es largo"
 * //   nodes: { n1: { clueText: "río {{n2}}", children: ["n2"], parent: null },
 * //            n2: { clueText: "que pasa por Gerona", children: [], parent: "n1" } }
 */
export function parsePuzzleMarkup(markup: string): ParseResult {
  const nodes: Record<string, ParsedNode> = {}
  // Stack de nodos actualmente abiertos (pendientes de cerrar con ']')
  const stack: ParsedNode[] = []
  let nodeCounter = 0
  // Acumulador del texto que estamos leyendo actualmente
  let currentText = ''

  for (let i = 0; i < markup.length; i++) {
    const char = markup[i]

    if (char === '[') {
      // Abrimos un nuevo nivel: crear un nodo y apilar
      const newNode: ParsedNode = {
        id: `n${++nodeCounter}`,
        clueText: '',
        children: [],
        parent: stack.length > 0 ? (stack[stack.length - 1]?.id ?? null) : null,
      }

      // Si hay un nodo padre en el stack, registrar este como hijo suyo
      // y añadir el placeholder en el texto del padre
      if (stack.length > 0) {
        const parent = stack[stack.length - 1]
        if (parent !== undefined) {
          parent.children.push(newNode.id)
          parent.clueText += currentText + `{{${newNode.id}}}`
        }
      } else {
        // Estamos en el nivel raíz: acumular el texto previo al corchete
        // (se integrará en rootTemplate al final)
      }

      stack.push(newNode)
      currentText = ''
    } else if (char === ']') {
      // Cerramos el nivel actual: desapilar y registrar el nodo
      if (stack.length === 0) {
        throw new Error(
          `Parser: corchete de cierre ']' inesperado en posición ${i.toString()}. El markup no está balanceado.`,
        )
      }

      const closedNode = stack.pop()
      if (!closedNode) {
        throw new Error(
          `Parser: corchete de cierre ']' inesperado en posición ${i.toString()}. El markup no está balanceado.`,
        )
      }
      closedNode.clueText += currentText
      nodes[closedNode.id] = closedNode
      currentText = ''

      // Si tras cerrar el stack queda vacío, el siguiente texto va al rootTemplate
    } else {
      currentText += char
    }
  }

  // Al terminar de recorrer el markup, si el stack no está vacío hay un '[' sin cerrar
  if (stack.length > 0) {
    const unclosed = stack.map((n) => n.id).join(', ')
    throw new Error(
      `Parser: ${stack.length.toString()} corchete(s) sin cerrar. Nodos afectados: ${unclosed}`,
    )
  }

  // El rootTemplate es el texto que quedó fuera de todos los corchetes,
  // con los nodos de nivel 0 sustituidos por placeholders
  const rootTemplate = buildRootTemplate(markup)

  return { rootTemplate, nodes }
}

/**
 * Reconstruye el rootTemplate a partir del markup original.
 * Reemplaza cada grupo [...] de nivel 0 (sin padre) con {{nX}}.
 *
 * @internal
 */
function buildRootTemplate(markup: string): string {
  let result = ''
  let depth = 0
  let currentNodeId = 1

  for (const char of markup) {
    if (char === '[') {
      depth++
      if (depth === 1) {
        // Nodo de nivel 0: sustituir por placeholder
        result += `{{n${currentNodeId.toString()}}}`
        currentNodeId++
      }
    } else if (char === ']') {
      depth--
    } else if (depth === 0) {
      // Texto fuera de corchetes: va directamente al template
      result += char
    }
  }

  return result
}

// ─── Inicialización del estado de partida ─────────────────────────────────────

/**
 * Construye el PuzzleState inicial a partir del ClientPayload recibido del servidor.
 * Los nodos hoja (sin hijos) se marcan como ACTIVE.
 * Ninguna solución viaja en este objeto; solo hashes y ciphers.
 *
 * @param payload - ClientPayload recibido del API
 * @returns PuzzleState con todos los nodos inicializados
 */
export function initPuzzleState(payload: ClientPayload): PuzzleState {
  const nodes: Record<string, ClueNode> = {}

  for (const [id, node] of Object.entries(payload.nodes)) {
    const isLeaf = node.children.length === 0
    nodes[id] = {
      ...node,
      type: node.type as ClueType,
      isActive: isLeaf, // Las hojas son activas desde el inicio
      isResolved: false,
      revealedWithHint: false,
      resolvedText: null,
    }
  }

  return {
    puzzleId: payload.puzzleId,
    editionNumber: payload.editionNumber,
    publishDate: payload.publishDate,
    rootTemplate: payload.rootTemplate,
    nodes,
    startedAt: Date.now(),
    completedAt: null,
    hintsUsed: [],
    mistakesCount: 0,
    score: 100,
    quoteAuthor: payload.quoteAuthor,
    quoteWork: payload.quoteWork,
    quoteYear: payload.quoteYear,
    editorialNote: payload.editorialNote,
  }
}

// ─── Consultas sobre el estado del árbol ─────────────────────────────────────

/**
 * Devuelve los nodos actualmente activos (hojas sin resolver).
 * Solo se itera sobre estos al validar una respuesta del jugador.
 */
export function getActiveNodes(state: PuzzleState): ClueNode[] {
  return Object.values(state.nodes).filter((node) => node.isActive && !node.isResolved)
}

/**
 * Devuelve true si todos los nodos del puzle están resueltos.
 */
export function isPuzzleComplete(state: PuzzleState): boolean {
  return Object.values(state.nodes).every((node) => node.isResolved)
}

/**
 * Recalcula los estados ACTIVE del árbol tras resolver un nodo.
 *
 * Un nodo padre se vuelve ACTIVE cuando todos sus hijos están resueltos.
 * Esta función se llama después de cada acierto (cascade upward).
 *
 * @param state - Estado actualizado (con el nodo recién resuelto marcado como isResolved)
 * @returns Nuevo PuzzleState con los nodos activos actualizados
 */
export function recalculateActiveNodes(state: PuzzleState): PuzzleState {
  const updatedNodes = { ...state.nodes }

  for (const node of Object.values(updatedNodes)) {
    if (node.isResolved) continue // Los ya resueltos no cambian

    // Un nodo se activa si TODOS sus hijos están resueltos
    const allChildrenResolved = node.children.every(
      (childId) => updatedNodes[childId]?.isResolved === true,
    )

    updatedNodes[node.id] = {
      ...node,
      isActive: allChildrenResolved,
    }
  }

  return { ...state, nodes: updatedNodes }
}

/**
 * Marca un nodo como resuelto e integra el texto descifrado.
 * No recalcula los activos; eso lo hace recalculateActiveNodes().
 */
export function resolveNode(
  state: PuzzleState,
  nodeId: string,
  resolvedText: string,
  revealedWithHint = false,
): PuzzleState {
  const node = state.nodes[nodeId]
  if (node === undefined) {
    throw new Error(`resolveNode: nodo "${nodeId}" no existe en el estado`)
  }

  return {
    ...state,
    nodes: {
      ...state.nodes,
      [nodeId]: {
        ...node,
        isResolved: true,
        isActive: false,
        revealedWithHint,
        resolvedText,
      },
    },
  }
}
