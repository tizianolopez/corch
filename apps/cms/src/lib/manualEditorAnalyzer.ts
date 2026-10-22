/**
 * @module manualEditorAnalyzer
 *
 * Analizador y validador en tiempo real para el Editor Manual de Corchetes.
 * Utiliza @corchetes/core (parsePuzzleMarkup y normalize) para proporcionar:
 *  - Detección reactiva de nodos y sincronización de IDs
 *  - Métricas de complejidad (profundidad máxima, nodos hoja iniciales, total)
 *  - Alertas deterministas:
 *      * «Solo 1 nodo activo inicial»
 *      * «2 nodos con solución idéntica»
 *      * Corchetes desbalanceados o sin cerrar
 *      * Profundidad fuera de rango (2-5)
 *      * Cantidad de nodos fuera de rango (3-8)
 *      * Soluciones faltantes o vacías
 *
 * Fuente de verdad: docs/tasks.md §4.4 y docs/reglesIA.md
 */

import { parsePuzzleMarkup, normalize, type ClueType, type ParseResult } from '@corchetes/core'

export interface EditorNodeInput {
  id: string
  solution: string
  type: ClueType
  reasoning?: string
}

export interface AnalyzerAlert {
  id: string
  level: 'error' | 'warning' | 'info'
  message: string
}

export interface EditorAnalysis {
  isValid: boolean
  hasSyntaxError: boolean
  syntaxErrorMessage?: string
  totalNodes: number
  maxDepth: number
  initialLeaves: number
  nodeIds: string[]
  leafNodeIds: string[]
  parseResult?: ParseResult
  alerts: AnalyzerAlert[]
}

export function analyzeManualPuzzle(
  markup: string,
  nodes: EditorNodeInput[],
): EditorAnalysis {
  const alerts: AnalyzerAlert[] = []

  // 1. Validar texto no vacío
  if (!markup || markup.trim().length === 0) {
    return {
      isValid: false,
      hasSyntaxError: false,
      totalNodes: 0,
      maxDepth: 0,
      initialLeaves: 0,
      nodeIds: [],
      leafNodeIds: [],
      alerts: [
        {
          id: 'empty_markup',
          level: 'info',
          message: 'Introduce una frase con corchetes anidados [ejemplo [pista]].',
        },
      ],
    }
  }

  // 2. Parsear markup con @corchetes/core
  let parseResult: ParseResult
  try {
    parseResult = parsePuzzleMarkup(markup)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      isValid: false,
      hasSyntaxError: true,
      syntaxErrorMessage: msg,
      totalNodes: 0,
      maxDepth: 0,
      initialLeaves: 0,
      nodeIds: [],
      leafNodeIds: [],
      alerts: [
        {
          id: 'syntax_error',
          level: 'error',
          message: `Error de sintaxis en corchetes: ${msg}`,
        },
      ],
    }
  }

  const parsedNodeIds = Object.keys(parseResult.nodes)
  const totalNodes = parsedNodeIds.length

  // Si no hay ningún corchete en el texto
  if (totalNodes === 0) {
    return {
      isValid: false,
      hasSyntaxError: false,
      totalNodes: 0,
      maxDepth: 0,
      initialLeaves: 0,
      nodeIds: [],
      leafNodeIds: [],
      alerts: [
        {
          id: 'no_brackets',
          level: 'warning',
          message: 'La frase no contiene ningún corchete. Usa corchetes [como este] para definir enigmas.',
        },
      ],
    }
  }

  // 3. Calcular profundidad y nodos hoja iniciales
  let maxDepth = 0
  const leafNodeIds: string[] = []

  for (const id of parsedNodeIds) {
    const node = parseResult.nodes[id]
    if (!node) continue
    if (node.children.length === 0) {
      leafNodeIds.push(id)
    }

    let depth = 1
    let curr = node.parent
    while (curr) {
      depth++
      curr = parseResult.nodes[curr]?.parent ?? null
    }
    if (depth > maxDepth) {
      maxDepth = depth
    }
  }

  const initialLeaves = leafNodeIds.length

  // 4. Evaluar restricciones de complejidad
  if (totalNodes < 3) {
    alerts.push({
      id: 'min_nodes',
      level: 'warning',
      message: `Cantidad de corchetes reducida (${totalNodes}). Se recomiendan entre 3 y 8 corchetes para un puzle balanceado.`,
    })
  } else if (totalNodes > 8) {
    alerts.push({
      id: 'max_nodes',
      level: 'warning',
      message: `Demasiados corchetes (${totalNodes}). El límite recomendado es de 8 para evitar fatiga cognitiva.`,
    })
  }

  if (maxDepth < 2) {
    alerts.push({
      id: 'min_depth',
      level: 'error',
      message: 'Profundidad de anidamiento insuficiente (actual: 1). El juego exige al menos un nivel de corchetes dentro de otros [ej [anidado]].',
    })
  } else if (maxDepth > 5) {
    alerts.push({
      id: 'max_depth',
      level: 'error',
      message: `Profundidad excesiva (${maxDepth}). El máximo permitido por diseño es 5 niveles.`,
    })
  }

  // Alerta requerida por especificación: «Solo 1 nodo activo inicial»
  if (initialLeaves < 2) {
    alerts.push({
      id: 'single_leaf',
      level: 'error',
      message: 'Solo 1 nodo activo inicial. El juego requiere al menos 2 pistas hoja independientes para permitir deducción en paralelo.',
    })
  }

  // 5. Evaluar correspondencia de soluciones
  const nodeInputMap = new Map<string, EditorNodeInput>()
  for (const n of nodes) {
    nodeInputMap.set(n.id, n)
  }

  let hasEmptySolution = false
  for (const id of parsedNodeIds) {
    const nodeInput = nodeInputMap.get(id)
    if (!nodeInput || !nodeInput.solution || nodeInput.solution.trim().length === 0) {
      hasEmptySolution = true
      alerts.push({
        id: `missing_solution_${id}`,
        level: 'warning',
        message: `El corchete '${id}' no tiene una solución asignada todavía.`,
      })
    }
  }

  // Alerta requerida por especificación: «2 nodos con solución idéntica»
  const normalizedMap = new Map<string, { id: string; raw: string }>()
  for (const id of parsedNodeIds) {
    const nodeInput = nodeInputMap.get(id)
    if (!nodeInput || !nodeInput.solution.trim()) continue

    const norm = normalize(nodeInput.solution)
    if (!norm) continue

    const existing = normalizedMap.get(norm)
    if (existing) {
      alerts.push({
        id: `duplicate_solution_${existing.id}_${id}`,
        level: 'error',
        message: `2 nodos con solución idéntica: '${existing.id}' y '${id}' coinciden en «${nodeInput.solution}». Todas las soluciones deben ser diferentes.`,
      })
    } else {
      normalizedMap.set(norm, { id, raw: nodeInput.solution })
    }
  }

  const hasBlockingErrors = alerts.some((a) => a.level === 'error')
  const isValid = !hasBlockingErrors && !hasEmptySolution && totalNodes >= 3 && totalNodes <= 8

  return {
    isValid,
    hasSyntaxError: false,
    totalNodes,
    maxDepth,
    initialLeaves,
    nodeIds: parsedNodeIds,
    leafNodeIds,
    parseResult,
    alerts,
  }
}
