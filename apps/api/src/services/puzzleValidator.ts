/**
 * @module puzzleValidator
 *
 * Validador determinista de puzles generados por IA o CMS manual.
 * Verifica estrictamente:
 *  - Balanceo sintáctico de corchetes (mediante parsePuzzleMarkup)
 *  - Correspondencia exacta entre los nodos del markup y las soluciones
 *  - Ausencia de soluciones duplicadas (normalizadas con la función oficial de @corchetes/core)
 *  - Profundidad de anidamiento entre 2 y 5 (garantiza anidamiento real)
 *  - Al menos 2 nodos hoja iniciales activos
 *  - Rango de nodos totales razonable (entre 3 y 8)
 *
 * Fuente de verdad: docs/tasks.md §3.3 y docs/architecture.md
 */

import { parsePuzzleMarkup, normalize, type ClueType, type ParseResult } from '@corchetes/core'
import type { RawPuzzle, RawPuzzleNode } from '@corchetes/crypto'

// ─── Tipos del borrador generado ──────────────────────────────────────────────

export interface GeneratedNode {
  /** Identificador del nodo coincidente con el orden del parser ("n1", "n2", ...) */
  id: string
  /** Palabra o término solución en texto plano */
  solution: string
  /** Tipo de pista lingüística */
  type: ClueType
  /** Razón enigmística o justificación del autor (opcional) */
  reasoning?: string
}

export interface GeneratedPuzzleDraft {
  /** Frase histórica original completa y fluida (sin corchetes) */
  originalQuote: string
  /** Frase con corchetes anidados: «Texto [pista A [pista B]]...» */
  markup: string
  /** Lista ordenada de soluciones correspondientes a cada corchete */
  nodes: GeneratedNode[]
  /** Autor o figura histórica principal */
  quoteAuthor?: string
  /** Contexto u obra histórica */
  quoteWork?: string
  /** Año del evento */
  quoteYear: number
  /** Nota editorial explicativa para el jugador */
  editorialNote: string
}

// ─── Resultado de validación ──────────────────────────────────────────────────

export interface ValidationSuccess {
  valid: true
  errors: []
  parseResult: ParseResult
  rawPuzzle: RawPuzzle
  maxDepth: number
  totalNodes: number
  initialLeaves: number
}

export interface ValidationFailure {
  valid: false
  errors: string[]
}

export type ValidationResult = ValidationSuccess | ValidationFailure

// ─── Configuración de restricciones ───────────────────────────────────────────

export interface ValidatorConstraints {
  minNodes?: number
  maxNodes?: number
  minDepth?: number
  maxDepth?: number
  minInitialLeaves?: number
}

const DEFAULT_CONSTRAINTS: Required<ValidatorConstraints> = {
  minNodes: 3,
  maxNodes: 8,
  minDepth: 2,
  maxDepth: 5,
  minInitialLeaves: 2,
}

// ─── Función de validación ────────────────────────────────────────────────────

/**
 * Valida un borrador de puzle de forma determinista.
 *
 * @param draft Borrador con markup, soluciones y metadatos
 * @param constraints Restricciones de complejidad opcionales
 * @param puzzleMeta Identificadores opcionales para la construcción de RawPuzzle
 */
export function validatePuzzleDraft(
  draft: GeneratedPuzzleDraft,
  constraints: ValidatorConstraints = {},
  puzzleMeta: { puzzleId?: string; editionNumber?: number; publishDate?: string } = {},
): ValidationResult {
  const cfg = { ...DEFAULT_CONSTRAINTS, ...constraints }
  const errors: string[] = []

  // 1. Validar presencia de texto básico
  if (!draft.markup || typeof draft.markup !== 'string' || draft.markup.trim().length === 0) {
    errors.push('El markup del puzle está vacío.')
  }

  if (!draft.originalQuote || typeof draft.originalQuote !== 'string' || draft.originalQuote.trim().length === 0) {
    errors.push('La frase original resuelta está vacía.')
  }

  if (typeof draft.quoteYear !== 'number' || isNaN(draft.quoteYear)) {
    errors.push('El año histórico (quoteYear) es obligatorio y debe ser numérico.')
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  // 2. Invocar parsePuzzleMarkup de @corchetes/core
  let parseResult: ParseResult
  try {
    parseResult = parsePuzzleMarkup(draft.markup)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      valid: false,
      errors: [`Error de sintaxis en el markup: ${msg}`],
    }
  }

  const parsedNodeIds = Object.keys(parseResult.nodes)
  const totalNodes = parsedNodeIds.length

  // 3. Verificar cantidad total de nodos
  if (totalNodes < cfg.minNodes) {
    errors.push(
      `Cantidad insuficiente de nodos (${totalNodes}). Se requieren al menos ${cfg.minNodes} corchetes en el puzle.`,
    )
  }
  if (totalNodes > cfg.maxNodes) {
    errors.push(
      `Demasiados nodos (${totalNodes}). El máximo permitido es de ${cfg.maxNodes} corchetes.`,
    )
  }

  // 4. Mapear y validar correspondencia con draft.nodes
  const solutionMap = new Map<string, GeneratedNode>()
  for (const node of draft.nodes ?? []) {
    if (node && node.id) {
      solutionMap.set(node.id, node)
    }
  }

  for (const id of parsedNodeIds) {
    const nodeDef = solutionMap.get(id)
    if (!nodeDef) {
      errors.push(`Falta la solución para el corchete con identificador '${id}'.`)
      continue
    }
    if (!nodeDef.solution || typeof nodeDef.solution !== 'string' || nodeDef.solution.trim().length === 0) {
      errors.push(`El corchete '${id}' tiene una solución vacía.`)
    }
  }

  // 5. Verificar que no haya soluciones duplicadas (normalizadas)
  const normalizedSolutions = new Map<string, string>() // normalized -> id
  for (const id of parsedNodeIds) {
    const nodeDef = solutionMap.get(id)
    if (!nodeDef || !nodeDef.solution) continue

    const norm = normalize(nodeDef.solution)
    if (!norm) {
      errors.push(`La solución del corchete '${id}' ('${nodeDef.solution}') es inválida tras normalizar.`)
      continue
    }

    if (normalizedSolutions.has(norm)) {
      const existingId = normalizedSolutions.get(norm)!
      errors.push(
        `Solución duplicada detectada: los corchetes '${existingId}' y '${id}' tienen la misma solución ('${nodeDef.solution}'). Todas las soluciones deben ser diferentes.`,
      )
    } else {
      normalizedSolutions.set(norm, id)
    }
  }

  // 6. Calcular profundidad del árbol y nodos hoja iniciales
  let maxDepth = 0
  let initialLeaves = 0

  for (const id of parsedNodeIds) {
    const node = parseResult.nodes[id]!
    if (node.children.length === 0) {
      initialLeaves++
    }

    // Calcular profundidad subiendo por la cadena de padres
    let depth = 1
    let curr = node.parent
    const visited = new Set<string>([id])

    while (curr) {
      if (visited.has(curr)) {
        errors.push(`Ciclo de dependencias detectado en el árbol a partir del nodo '${curr}'.`)
        break
      }
      visited.add(curr)
      depth++
      curr = parseResult.nodes[curr]?.parent ?? null
    }

    if (depth > maxDepth) {
      maxDepth = depth
    }
  }

  // 7. Validar profundidad y hojas iniciales
  if (maxDepth < cfg.minDepth) {
    errors.push(
      `Profundidad de anidamiento insuficiente (${maxDepth}). Debe haber al menos un corchete dentro de otro corchete (profundidad mínima: ${cfg.minDepth}).`,
    )
  }
  if (maxDepth > cfg.maxDepth) {
    errors.push(
      `Profundidad de anidamiento excesiva (${maxDepth}). El máximo permitido es de ${cfg.maxDepth} niveles.`,
    )
  }

  if (initialLeaves < cfg.minInitialLeaves) {
    errors.push(
      `Solo hay ${initialLeaves} nodo(s) inicial(es) activo(s). Debe haber al menos ${cfg.minInitialLeaves} pistas hoja para que el jugador tenga opciones de inicio.`,
    )
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  // 8. Construir RawPuzzle listo para compilación criptográfica
  const rawNodes: Record<string, RawPuzzleNode> = {}
  for (const id of parsedNodeIds) {
    const parsed = parseResult.nodes[id]!
    const nodeDef = solutionMap.get(id)!

    rawNodes[id] = {
      id,
      clueText: parsed.clueText,
      children: [...parsed.children],
      parent: parsed.parent,
      type: nodeDef.type ?? 'definition',
      solution: nodeDef.solution.trim(),
    }
  }

  const rawPuzzle: RawPuzzle = {
    puzzleId: puzzleMeta.puzzleId ?? 'generated-draft',
    editionNumber: puzzleMeta.editionNumber ?? 0,
    publishDate: puzzleMeta.publishDate ?? '',
    rootTemplate: parseResult.rootTemplate,
    nodes: rawNodes,
    quoteAuthor: draft.quoteAuthor ?? 'Efeméride histórica',
    quoteWork: draft.quoteWork ?? 'Un día como hoy',
    quoteYear: draft.quoteYear,
    editorialNote: draft.editorialNote ?? '',
  }

  return {
    valid: true,
    errors: [],
    parseResult,
    rawPuzzle,
    maxDepth,
    totalNodes,
    initialLeaves,
  }
}
