/**
 * Tipos del motor de juego de Corchetes.
 * Fuente de verdad: arquitectura_corchetes.md §5.1
 */

// ─── Tipos de pistas ─────────────────────────────────────────────────────────

export type ClueType =
  | 'definition' // Definición directa
  | 'anagram' // Letras desordenadas
  | 'reverse' // Se lee al revés
  | 'palindrome' // Simétrico
  | 'container' // La solución está escondida dentro de otra palabra
  | 'morphological' // Extremos de palabras
  | 'reference' // Referencia cultural
  | 'polysemy' // Doble sentido / polisemia

export type HintType = 'matrix' | 'reveal'

// ─── Nodo del árbol de pistas ─────────────────────────────────────────────────

export interface ClueNode {
  /** Identificador único: "n1", "n2", "n3"... */
  id: string
  /** Texto de la pista tal como lo ve el jugador */
  clueText: string
  /** IDs de los nodos hijo (pistas internas) */
  children: string[]
  /** ID del nodo padre. null = nodo raíz o nodo de nivel 0 */
  parent: string | null
  /** Tipo de pista (para uso del editor y analíticas) */
  type: ClueType
  /** SHA-256(normalizado + ":" + puzzleId + ":" + nodeId + ":" + salt) */
  solutionHash: string
  /** AES-GCM(solución_original, key=normalizado) */
  solutionCipher: string

  // ── Estado en runtime (NO viaja desde el servidor) ──────────────────────
  /** true cuando todos los hijos están resueltos (o no tiene hijos) y puede intentarse */
  isActive: boolean
  /** true cuando el jugador ha resuelto este nodo */
  isResolved: boolean
  /** true si se resolvió mediante "Revelar término" */
  revealedWithHint: boolean
  /** Texto original descifrado (solo disponible tras acertar) */
  resolvedText: string | null
}

// ─── Estado global de la partida ─────────────────────────────────────────────

export interface HintEvent {
  nodeId: string
  type: HintType
  /** Date.now() en el momento de usar la ayuda */
  at: number
}

export interface PuzzleState {
  puzzleId: string
  editionNumber: number
  /** ISO date string "YYYY-MM-DD" */
  publishDate: string
  /**
   * Plantilla del texto raíz con placeholders: {{n1}}, {{n2}}...
   * El texto entre placeholders es texto fijo de la cita.
   */
  rootTemplate: string
  /** Mapa de todos los nodos del puzle */
  nodes: Record<string, ClueNode>

  // ── Estado temporal ──────────────────────────────────────────────────────
  /** Date.now() al iniciar la partida */
  startedAt: number
  /** Date.now() al resolver el último nodo. null si no ha terminado */
  completedAt: number | null
  /** Lista de ayudas usadas (para puntuación y compartición) */
  hintsUsed: HintEvent[]
  /** Número de respuestas incorrectas enviadas */
  mistakesCount: number
  /** Puntuación final (0-100). Se calcula al terminar */
  score: number

  // ── Metadata (revelada SOLO al completar la partida) ─────────────────────
  quoteAuthor: string
  quoteWork: string
  quoteYear: number
  editorialNote: string
}

// ─── Payload seguro que viaja del servidor al cliente ────────────────────────

export interface ClientClueNode {
  id: string
  clueText: string
  children: string[]
  parent: string | null
  type: ClueType
  solutionHash: string
  solutionCipher: string
}

export interface ClientPayload {
  puzzleId: string
  editionNumber: number
  publishDate: string
  rootTemplate: string
  nodes: Record<string, ClientClueNode>
  /** Salt público del día para la validación del hash */
  dailySalt: string
  /** Metadatos cifrados — solo se revelan al terminar */
  quoteAuthor: string
  quoteWork: string
  quoteYear: number
  editorialNote: string
}

// ─── Resultado del intento de respuesta ──────────────────────────────────────

export type SubmitResult =
  | { success: true; resolvedNodeId: string; resolvedText: string; isComplete: boolean }
  | { success: false }

// ─── Rango del jugador ────────────────────────────────────────────────────────

export type PlayerRank = 'Gran Maestro' | 'Maestro' | 'Cronista' | 'Escriba' | 'Aprendiz'
