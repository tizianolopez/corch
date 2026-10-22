/**
 * @module puzzleCompiler
 *
 * Servicio de compilación y orquestación del pipeline completo de puzles:
 *  1. Extracción de efemérides (Wikimedia API con caché Redis)
 *  2. Generación con IA (Gemini Structured Outputs con reintentos)
 *  3. Validación determinista del árbol AST
 *  4. Compilación criptográfica segura (SHA-256 + AES-GCM) vía compilePuzzlePayload()
 *  5. Guardado en base de datos PostgreSQL/Drizzle como DRAFT (fuente: 'AI')
 *
 * Fuente de verdad: docs/tasks.md §3.4
 */

import { randomUUID } from 'node:crypto'
import { normalize, type ClientPayload } from '@corchetes/core'
import { compilePuzzlePayload, type RawPuzzle } from '@corchetes/crypto'
import { puzzles, type DbClient } from '@corchetes/db'
import { getEphemerisEvents, type EphemerisEvent } from './ephemeris'
import {
  generatePuzzleFromEvent,
  type ILlmModel,
  type GenerationResult,
} from './puzzleGenerator'
import type { IRedisClient } from '../plugins/redis'

// ─── Tipos e interfaces ───────────────────────────────────────────────────────

export interface PipelineOptions {
  /** Fecha en formato YYYY-MM-DD */
  publishDate: string
  /** Número de edición correlativo */
  editionNumber: number
  /** Salt criptográfico diario (opcional) */
  dailySalt?: string
  /** Cliente de base de datos Drizzle (opcional en desarrollo/test) */
  db?: DbClient | null
  /** Cliente Redis para caché de efemérides */
  redis: IRedisClient
  /** Índice del evento histórico a seleccionar de las efemérides (por defecto 0) */
  eventIndex?: number
  /** Evento preexistente inyectable (evita llamada a Wikimedia en tests) */
  mockEvent?: EphemerisEvent
  /** Modelo LLM inyectable (para tests unitarios) */
  model?: ILlmModel
  /** API key de Gemini */
  apiKey?: string
}

export interface PipelineResultSuccess {
  success: true
  puzzleId: string
  editionNumber: number
  publishDate: string
  status: 'DRAFT'
  source: 'AI'
  rawMarkup: string
  compiledAst: RawPuzzle & { source: 'AI' }
  clientPayload: ClientPayload
  meta: {
    maxDepth: number
    totalNodes: number
    initialLeaves: number
    attempts: number
  }
}

export interface PipelineResultFailure {
  success: false
  errors: string[]
  attempts?: number
}

export type PipelineResult = PipelineResultSuccess | PipelineResultFailure

/** Almacén en memoria de puzles generados para tests o modo sin PostgreSQL */
export const memoryGeneratedPuzzles = new Map<string, PipelineResultSuccess>()

// ─── Pipeline principal ───────────────────────────────────────────────────────

/**
 * Ejecuta el pipeline completo de generación, validación, compilación y guardado.
 */
export async function runGeneratePipeline(
  options: PipelineOptions,
): Promise<PipelineResult> {
  const {
    publishDate,
    editionNumber,
    dailySalt = `salt-${publishDate}`,
    db,
    redis,
    eventIndex = 0,
    mockEvent,
    model,
    apiKey,
  } = options

  // 1. Obtener efeméride
  let event: EphemerisEvent
  if (mockEvent) {
    event = mockEvent
  } else {
    const parts = publishDate.split('-')
    const month = parseInt(parts[1] ?? '1', 10)
    const day = parseInt(parts[2] ?? '1', 10)

    const events = await getEphemerisEvents(month, day, { redis })
    if (!events || events.length === 0) {
      return {
        success: false,
        errors: [`No se encontraron efemérides históricas para la fecha ${publishDate}`],
      }
    }

    const idx = Math.min(Math.max(0, eventIndex), events.length - 1)
    event = events[idx]!
  }

  // 2. Generación con IA y validación determinista con reintentos
  const genResult: GenerationResult = await generatePuzzleFromEvent(event, {
    model,
    apiKey,
  })

  if (!genResult.success) {
    return {
      success: false,
      errors: genResult.errors,
      attempts: genResult.attempts,
    }
  }

  const { draft, validation, attempts } = genResult
  const puzzleId = randomUUID()

  // 3. Preparar RawPuzzle
  const rawPuzzle: RawPuzzle = {
    ...validation.rawPuzzle,
    puzzleId,
    editionNumber,
    publishDate,
  }

  // 4. Compilar payload seguro (cifrado SHA-256 + AES-GCM)
  const clientPayload = await compilePuzzlePayload(rawPuzzle, dailySalt, normalize)

  // 5. Estructurar el resultado
  const compiledAstWithSource = {
    ...rawPuzzle,
    source: 'AI' as const,
  }

  const resultSuccess: PipelineResultSuccess = {
    success: true,
    puzzleId,
    editionNumber,
    publishDate,
    status: 'DRAFT',
    source: 'AI',
    rawMarkup: draft.markup,
    compiledAst: compiledAstWithSource,
    clientPayload,
    meta: {
      maxDepth: validation.maxDepth,
      totalNodes: validation.totalNodes,
      initialLeaves: validation.initialLeaves,
      attempts,
    },
  }

  // 6. Guardar en memoria siempre
  memoryGeneratedPuzzles.set(puzzleId, resultSuccess)

  // 7. Guardar en PostgreSQL si hay conexión a DB
  if (db) {
    try {
      await db.insert(puzzles).values({
        id: puzzleId,
        editionNumber,
        publishDate,
        rawMarkup: draft.markup,
        compiledAst: compiledAstWithSource,
        clientPayload,
        quoteAuthor: draft.quoteAuthor ?? 'Efeméride histórica',
        quoteWork: draft.quoteWork ?? 'Un día como hoy',
        quoteYear: draft.quoteYear,
        editorialNote: draft.editorialNote,
        maxDepth: validation.maxDepth,
        totalNodes: validation.totalNodes,
        initialLeaves: validation.initialLeaves,
        status: 'DRAFT',
      })
    } catch (dbError) {
      // Registrar error pero no perder el objeto compilado ya almacenado en memoria
      const msg = dbError instanceof Error ? dbError.message : String(dbError)
      return {
        success: false,
        errors: [`Error al guardar en base de datos: ${msg}`],
      }
    }
  }

  return resultSuccess
}
