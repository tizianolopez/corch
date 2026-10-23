/**
 * @module seedData
 *
 * Definición canónica de los 7 puzles de la semana de lanzamiento de Corchetes.
 * Basados rigurosamente en el formato histórico oficial: «Un día como hoy, pero en {año}...»
 * extraídos del archivo hemerográfico de Wikimedia / Wikipedia.
 *
 * Cumplen estrictamente:
 *  - Formato de efemérides: "Un día como hoy, pero en [año]..."
 *  - Sin definiciones escolares de diccionario
 *  - Profundidad de anidamiento entre 2 y 4 niveles
 *  - Al menos 2 nodos hoja activos al comenzar
 *  - Soluciones únicas normalizadas (preservando 'ñ')
 *  - Criptografía segura (SHA-256 + AES-GCM) sin soluciones en claro en clientPayload
 *
 * Fuente de verdad: docs/tasks.md §7.4 y docs/prompt_enigma.md
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
    quoteAuthor: 'Efeméride deportiva y cultural',
    quoteWork: 'Nacimiento de Edson Arantes do Nascimento (Pelé)',
    quoteYear: 1940,
    editorialNote:
      'Un día como hoy en 1940 nace Pelé en Três Corações, coronado como "O Rei" y tricampeón mundial.',
    difficultyScore: 3.5,
    rawMarkup:
      'Un día como hoy, pero en 1940, nace en [la patria de la samba y el carnaval] el [delantero de Santos que alzó tres [campeonatos universales de selecciones de fútbol]], recordado por anotar más de mil [tantos introducidos en la portería].',
    solutions: {
      n1: { solution: 'Brasil', type: 'reference' },
      n2: { solution: 'Pelé', type: 'reference' },
      n3: { solution: 'mundiales', type: 'definition' },
      n4: { solution: 'goles', type: 'definition' },
    },
  },
  {
    editionNumber: 2,
    publishDate: '2026-10-24',
    quoteAuthor: 'Efeméride de la moda y el arte',
    quoteWork: 'Fallecimiento de Christian Dior',
    quoteYear: 1957,
    editorialNote:
      'Un día como hoy en 1957 fallece Christian Dior, el modisto que inauguró la era dorada de la alta costura con el New Look.',
    difficultyScore: 3.7,
    rawMarkup:
      'Un día como hoy, pero en 1957, fallece en Italia [el modisto francés que revolucionó la [confección artesanal y exclusiva de prendas]], creando una influyente firma de [el arte del diseño de pasarela] que transformó la silueta femenina.',
    solutions: {
      n1: { solution: 'Dior', type: 'reference' },
      n2: { solution: 'costura', type: 'definition' },
      n3: { solution: 'moda', type: 'definition' },
    },
  },
  {
    editionNumber: 3,
    publishDate: '2026-10-25',
    quoteAuthor: 'Efeméride histórica internacional',
    quoteWork: 'Pacto de amistad y origen del Eje Roma-Berlín',
    quoteYear: 1936,
    editorialNote:
      'Un día como hoy en 1936, Alemania e Italia formalizan su acuerdo diplomático precursor del Pacto del Eje de la Segunda Guerra Mundial.',
    difficultyScore: 4.0,
    rawMarkup:
      'Un día como hoy, pero en 1936, [la potencia germana de Europa central] e Italia sellan el [acuerdo diplomático y militar de [naciones unidas por tratados]] que dio origen al fatídico bloque del [eje de rotación sobre el que gira el planeta].',
    solutions: {
      n1: { solution: 'Alemania', type: 'reference' },
      n2: { solution: 'pacto', type: 'definition' },
      n3: { solution: 'estados', type: 'definition' },
      n4: { solution: 'Eje', type: 'definition' },
    },
  },
  {
    editionNumber: 4,
    publishDate: '2026-10-26',
    quoteAuthor: 'Efeméride de la diplomacia y la paz',
    quoteWork: 'Tratado de Paz entre Israel y Jordania',
    quoteYear: 1994,
    editorialNote:
      'Un día como hoy en 1994, Isaac Rabin y el rey Hussein sellaron el histórico acuerdo de paz en el valle de Aravá.',
    difficultyScore: 3.8,
    rawMarkup:
      'Un día como hoy, pero en 1994, [el mandatario israelí condecorado con el Nobel tras liderar el [acuerdo diplomático que cesó las hostilidades]] y el monarca jordano firman la histórica concordia en la frontera de [dos pueblos vecinos de Oriente].',
    solutions: {
      n1: { solution: 'Rabin', type: 'reference' },
      n2: { solution: 'pacto', type: 'definition' },
      n3: { solution: 'naciones', type: 'definition' },
    },
  },
  {
    editionNumber: 5,
    publishDate: '2026-10-27',
    quoteAuthor: 'Efeméride de la Guerra de la Independencia',
    quoteWork: 'Tratado de Fontainebleau (Napoleón y Godoy)',
    quoteYear: 1807,
    editorialNote:
      'Un día como hoy en 1807, la España borbónica y la Francia napoleónica firman el tratado secreto que permitió la entrada de tropas francesas.',
    difficultyScore: 4.1,
    rawMarkup:
      'Un día como hoy, pero en 1807, [el emperador francés coronado en Notre Dame que lideraba la [gran armada de soldados imperiales]] y Manuel Godoy firman el acuerdo para invadir el [país luso con capital en Lisboa].',
    solutions: {
      n1: { solution: 'Napoleón', type: 'reference' },
      n2: { solution: 'tropa', type: 'definition' },
      n3: { solution: 'Portugal', type: 'reference' },
    },
  },
  {
    editionNumber: 6,
    publishDate: '2026-10-28',
    quoteAuthor: 'Efeméride de la poesía española',
    quoteWork: 'Fallecimiento de Rafael Alberti',
    quoteYear: 1999,
    editorialNote:
      'Un día como hoy en 1999 fallece en El Puerto de Santa María Rafael Alberti, último gran representante de la Generación del 27.',
    difficultyScore: 3.6,
    rawMarkup:
      'Un día como hoy, pero en 1999, fallece en [la bahía andaluza que mira al océano] el [poeta marinero en tierra que perteneció a la [mítica promoción de poetas del veintisiete]], autor de inolvidables [estrofas rimadas con talento lírico].',
    solutions: {
      n1: { solution: 'Cádiz', type: 'reference' },
      n2: { solution: 'Alberti', type: 'reference' },
      n3: { solution: 'generación', type: 'definition' },
      n4: { solution: 'versos', type: 'definition' },
    },
  },
  {
    editionNumber: 7,
    publishDate: '2026-10-29',
    quoteAuthor: 'Efeméride de la exploración espacial',
    quoteWork: 'La sonda Galileo sobrevuela el asteroide Gaspra',
    quoteYear: 1991,
    editorialNote:
      'Un día como hoy en 1991, la sonda Galileo de la NASA realiza el primer encuentro cercano de la humanidad con un asteroide.',
    difficultyScore: 4.3,
    rawMarkup:
      'Un día como hoy, pero en 1991, [la nave espacial bautizada en honor al [sabio astrónomo toscano del telescopio]] sobrevuela por primera vez en la historia un [cuerpo rocoso y menor del sistema solar] en la inmensidad del cosmos.',
    solutions: {
      n1: { solution: 'Galileo', type: 'reference' },
      n2: { solution: 'científico', type: 'definition' },
      n3: { solution: 'asteroide', type: 'definition' },
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
