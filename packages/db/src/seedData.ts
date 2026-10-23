/**
 * @module seedData
 *
 * Definición canónica de los 7 puzles de la semana de lanzamiento de Corchetes.
 * Obras literarias cumbre en lengua española adaptadas al formato claudàtor.
 *
 * Cumplen estrictamente:
 *  - Sin definiciones escolares de diccionario
 *  - Profundidad de anidamiento entre 2 y 4 niveles
 *  - Al menos 2 nodos hoja activos al comenzar
 *  - Soluciones únicas normalizadas (preservando 'ñ')
 *  - Criptografía segura (SHA-256 + AES-GCM) sin soluciones en claro en clientPayload
 *
 * Fuente de verdad: docs/tasks.md §7.4
 */

import { parsePuzzleMarkup, normalize, type ClueType } from '@corchetes/core'
import { compilePuzzlePayload, type RawPuzzle, type RawPuzzleNode } from '@corchetes/crypto'
import type { NewPuzzle } from './schema/puzzles'

export interface LaunchPuzzleDefinition {
  editionNumber: number
  publishDate: string
  quoteAuthor: string
  quoteWork: string
  quoteYear: number
  editorialNote: string
  difficultyScore: number
  rawMarkup: string
  solutions: Record<string, { solution: string; type: ClueType }>
}

export const LAUNCH_PUZZLES: LaunchPuzzleDefinition[] = [
  {
    editionNumber: 1,
    publishDate: '2026-10-23',
    quoteAuthor: 'Miguel de Cervantes',
    quoteWork: 'Don Quijote de la Mancha',
    quoteYear: 1605,
    editorialNote:
      'Edición inaugural: el hidalgo manchego y su geografía literaria en la obra cumbre de la novela moderna.',
    difficultyScore: 3.5,
    rawMarkup:
      'En un lugar de la [región histórica donde cabalgaba el [hidalgo que desafió a los [gigantes con aspas de viento]]], de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía un caballero con su [escudo de cuero de forma ovalada] y lanza en astillero.',
    solutions: {
      n1: { solution: 'Mancha', type: 'definition' },
      n2: { solution: 'Quijote', type: 'reference' },
      n3: { solution: 'molinos', type: 'definition' },
      n4: { solution: 'adarga', type: 'definition' },
    },
  },
  {
    editionNumber: 2,
    publishDate: '2026-10-24',
    quoteAuthor: 'Federico García Lorca',
    quoteWork: 'Romance Sonámbulo',
    quoteYear: 1928,
    editorialNote:
      'El lirismo gitano y surrealista de Lorca condensado en sus versos más universales de verde y mar.',
    difficultyScore: 3.8,
    rawMarkup:
      '[Tono de la esperanza que baña el [soplo de aire invisible]] que te quiero verde. El [navío de madera que navega la [inmensidad salina]] y el corcel en la montaña.',
    solutions: {
      n1: { solution: 'Verde', type: 'definition' },
      n2: { solution: 'viento', type: 'definition' },
      n3: { solution: 'barco', type: 'definition' },
      n4: { solution: 'mar', type: 'definition' },
    },
  },
  {
    editionNumber: 3,
    publishDate: '2026-10-25',
    quoteAuthor: 'Jorge Luis Borges',
    quoteWork: 'El Aleph',
    quoteYear: 1949,
    editorialNote:
      'El punto del espacio que contiene todos los puntos del universo según el gran maestro de la literatura fantástica.',
    difficultyScore: 4.2,
    rawMarkup:
      'Vi el populoso mar, vi el [primer resplandor del día antes de que [despunte el astro rey]] y la tarde, vi en el [monumento funerario de Egipto de [color del carbón]] una plateada telaraña.',
    solutions: {
      n1: { solution: 'alba', type: 'definition' },
      n2: { solution: 'amanezca', type: 'charade' },
      n3: { solution: 'pirámide', type: 'reference' },
      n4: { solution: 'negro', type: 'definition' },
    },
  },
  {
    editionNumber: 4,
    publishDate: '2026-10-26',
    quoteAuthor: 'Antonio Machado',
    quoteWork: 'Campos de Castilla (Proverbios y cantares)',
    quoteYear: 1912,
    editorialNote:
      'La meditación filosófica sobre el tiempo, el destino y la creación del propio camino a través del paso.',
    difficultyScore: 3.6,
    rawMarkup:
      '[Aquel que recorre a pie la [senda que conduce al [santuario gallego de Compostela]]], son tus huellas el camino y nada más; caminante, no hay camino, se hace camino al [desplazar los pasos con el movimiento].',
    solutions: {
      n1: { solution: 'Caminante', type: 'definition' },
      n2: { solution: 'ruta', type: 'definition' },
      n3: { solution: 'peregrino', type: 'reference' },
      n4: { solution: 'andar', type: 'definition' },
    },
  },
  {
    editionNumber: 5,
    publishDate: '2026-10-27',
    quoteAuthor: 'Julio Cortázar',
    quoteWork: 'Rayuela',
    quoteYear: 1963,
    editorialNote:
      'La búsqueda laberíntica de Oliveira y la Maga por los puentes y adoquines del París contracultural.',
    difficultyScore: 4.0,
    rawMarkup:
      'Andábamos sin buscarnos pero sabiendo que [recorríamos las calles de la [capital francesa bañada por el [río que divide París]]] para encontrarnos. ¡Oh amor, [juego infantil de casillas dibujadas con tiza] sobre la acera!',
    solutions: {
      n1: { solution: 'paseábamos', type: 'charade' },
      n2: { solution: 'ciudad', type: 'definition' },
      n3: { solution: 'Sena', type: 'reference' },
      n4: { solution: 'rayuela', type: 'definition' },
    },
  },
  {
    editionNumber: 6,
    publishDate: '2026-10-28',
    quoteAuthor: 'Francisco de Quevedo',
    quoteWork: 'Poderoso caballero es don Dinero',
    quoteYear: 1603,
    editorialNote:
      'La sátira conceptista del Siglo de Oro español sobre el poder corruptor de las riquezas y el oro colonial.',
    difficultyScore: 4.4,
    rawMarkup:
      'Madre, yo al [metal precioso y brillante codiciado por el [monarca con corona de [reino castellano]]] me humillo; que pues doblón o sencillo hace todo cuanto quiero, poderoso caballero es don [moneda de cambio universal].',
    solutions: {
      n1: { solution: 'oro', type: 'definition' },
      n2: { solution: 'rey', type: 'reference' },
      n3: { solution: 'Castilla', type: 'reference' },
      n4: { solution: 'Dinero', type: 'definition' },
    },
  },
  {
    editionNumber: 7,
    publishDate: '2026-10-29',
    quoteAuthor: 'Benito Pérez Galdós',
    quoteWork: 'Fortunata y Jacinta',
    quoteYear: 1887,
    editorialNote:
      'El retrato realista y magistral del Madrid castizo y decimonónico a través del drama de dos mujeres inolvidables.',
    difficultyScore: 3.9,
    rawMarkup:
      'Las dos mujeres se miraron frente a frente en las [vías empedradas de la [capital del oso y el [árbol de frutos rojos silvestres]]], reconociéndose como dos [extremos geográficos del planeta] de una misma pasión.',
    solutions: {
      n1: { solution: 'calles', type: 'definition' },
      n2: { solution: 'villa', type: 'definition' },
      n3: { solution: 'madroño', type: 'reference' },
      n4: { solution: 'polos', type: 'definition' },
    },
  },
]

/**
 * Calcula la profundidad máxima de un árbol de nodos parseados.
 */
function calculateMaxDepth(nodes: Record<string, { children: string[] }>): number {
  function getDepth(nodeId: string): number {
    const node = nodes[nodeId]
    if (!node || node.children.length === 0) return 1
    return 1 + Math.max(...node.children.map(getDepth))
  }

  const rootNodes = Object.entries(nodes)
    .filter(([_, n]) => !(n as { parent: string | null }).parent)
    .map(([id]) => id)

  if (rootNodes.length === 0) return 0
  return Math.max(...rootNodes.map(getDepth))
}

/**
 * Compila y construye una fila NewPuzzle para la base de datos a partir de una definición de puzle.
 */
export async function compileLaunchPuzzle(
  def: LaunchPuzzleDefinition,
): Promise<NewPuzzle> {
  const parseResult = parsePuzzleMarkup(def.rawMarkup)
  const nodeIds = Object.keys(parseResult.nodes)

  // 1. Validar correspondencia estricta de nodos
  for (const id of nodeIds) {
    if (!def.solutions[id]) {
      throw new Error(
        `Puzle Edición ${def.editionNumber}: falta solución para el nodo ${id}`,
      )
    }
  }

  // 2. Validar soluciones únicas
  const normalizedSolutions = new Set<string>()
  for (const [id, s] of Object.entries(def.solutions)) {
    const norm = normalize(s.solution)
    if (normalizedSolutions.has(norm)) {
      throw new Error(
        `Puzle Edición ${def.editionNumber}: solución duplicada '${s.solution}' en nodo ${id}`,
      )
    }
    normalizedSolutions.add(norm)
  }

  // 3. Métricas estructurales
  const totalNodes = nodeIds.length
  const initialLeaves = Object.values(parseResult.nodes).filter(
    (n) => n.children.length === 0,
  ).length
  const maxDepth = calculateMaxDepth(parseResult.nodes)

  if (totalNodes < 3 || totalNodes > 8) {
    throw new Error(
      `Puzle Edición ${def.editionNumber}: total de nodos inválido (${totalNodes})`,
    )
  }
  if (initialLeaves < 2) {
    throw new Error(
      `Puzle Edición ${def.editionNumber}: debe tener al menos 2 hojas iniciales (tiene ${initialLeaves})`,
    )
  }
  if (maxDepth < 2) {
    throw new Error(
      `Puzle Edición ${def.editionNumber}: profundidad de anidamiento insuficiente (${maxDepth})`,
    )
  }

  // 4. Construir RawPuzzle
  const rawNodes: Record<string, RawPuzzleNode> = {}
  for (const [id, parsedNode] of Object.entries(parseResult.nodes)) {
    rawNodes[id] = {
      id,
      clueText: parsedNode.clueText,
      children: parsedNode.children,
      parent: parsedNode.parent,
      type: def.solutions[id].type,
      solution: def.solutions[id].solution,
    }
  }

  const puzzleId = `corchetes-daily-${def.publishDate}`
  const dailySalt = `salt-${def.publishDate}`

  const rawPuzzle: RawPuzzle = {
    puzzleId,
    editionNumber: def.editionNumber,
    publishDate: def.publishDate,
    rootTemplate: parseResult.rootTemplate,
    nodes: rawNodes,
    quoteAuthor: def.quoteAuthor,
    quoteWork: def.quoteWork,
    quoteYear: def.quoteYear,
    editorialNote: def.editorialNote,
  }

  // 5. Compilar payload seguro con SHA-256 y AES-GCM
  const clientPayload = await compilePuzzlePayload(rawPuzzle, dailySalt, normalize)

  return {
    editionNumber: def.editionNumber,
    publishDate: def.publishDate,
    rawMarkup: def.rawMarkup,
    compiledAst: parseResult.nodes,
    clientPayload,
    quoteAuthor: def.quoteAuthor,
    quoteWork: def.quoteWork,
    quoteYear: def.quoteYear,
    editorialNote: def.editorialNote,
    difficultyScore: def.difficultyScore,
    maxDepth,
    totalNodes,
    initialLeaves,
    status: 'PUBLISHED',
    publishedAt: new Date(def.publishDate),
  }
}
