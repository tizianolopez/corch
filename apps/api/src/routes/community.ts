/**
 * @module routes/community
 *
 * Endpoints para retos creados por la comunidad (UGC):
 * - POST /api/community/create : Compila y guarda un puzle de la comunidad
 * - GET  /api/community/:shortId : Obtiene el puzle por su identificador corto
 *
 * Fuente de verdad: docs/tasks.md §6.2 y docs/arquitectura_corchetes.md §7.4 y §8.1
 */

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import { communityPuzzles } from '@corchetes/db'
import { parsePuzzleMarkup, normalize, type ClueType } from '@corchetes/core'
import { compilePuzzlePayload, type RawPuzzle } from '@corchetes/crypto'
import { getTodayDateMadrid } from '../utils/time'

// ── In-Memory fallback para tests o entornos sin conexión PostgreSQL ──────────
export interface MemoryCommunityPuzzle {
  id: string
  creatorAlias: string
  rawMarkup: string
  clientPayload: any
  playsCount: number
  createdAt: Date
  isFlagged: boolean
}

export const memoryCommunityPuzzles = new Map<string, MemoryCommunityPuzzle>()

// ── Generador de identificador corto tipo NanoID (8 caracteres alfanuméricos) ───
export function generateShortId(): string {
  return randomBytes(6)
    .toString('base64url')
    .replace(/[^a-zA-Z0-9]/g, 'x')
    .slice(0, 8)
}

// ── Schemas de validación Zod ────────────────────────────────────────────────
const createCommunitySchema = z.object({
  markup: z.string().min(5, 'El markup debe contener al menos 5 caracteres'),
  creatorAlias: z.string().max(100).optional().default('Lector anónimo'),
  quoteAuthor: z.string().max(200).optional().default('Cita de la comunidad'),
  quoteWork: z.string().max(300).optional().default('Reto creado por un lector'),
  quoteYear: z.number().int().optional().default(new Date().getFullYear()),
  editorialNote: z.string().optional().default('Reto compartido por la comunidad de Corchetes.'),
  nodes: z
    .array(
      z.object({
        id: z.string(),
        solution: z.string().min(1, 'La solución de cada corchete no puede estar vacía'),
        type: z.enum(['definition', 'morphological', 'charade', 'reference']).optional(),
      })
    )
    .optional(),
})

const getCommunityParamSchema = z.object({
  shortId: z.string().min(1).max(20),
})

// ── Plugin de rutas ──────────────────────────────────────────────────────────
export const communityRoutes: FastifyPluginAsync = async (fastify) => {
  // ── 1. POST /api/community/create ──────────────────────────────────────────
  fastify.post('/api/community/create', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createCommunitySchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Datos del reto de comunidad inválidos',
        issues: parseResult.error.issues,
      })
    }

    const data = parseResult.data

    // 1. Parsear el árbol de corchetes
    let parsedTree
    try {
      parsedTree = parsePuzzleMarkup(data.markup)
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: err.message || 'El markup de corchetes es inválido o no está balanceado',
      })
    }

    const nodeIds = Object.keys(parsedTree.nodes)
    if (nodeIds.length === 0) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: 'El puzle debe contener al menos un corchete con pista [pista]',
      })
    }

    // 2. Resolver soluciones para cada nodo
    const rawNodes: RawPuzzle['nodes'] = {}
    const nodeSolutionMap = new Map<string, { solution: string; type?: ClueType }>()

    if (data.nodes) {
      for (const n of data.nodes) {
        nodeSolutionMap.set(n.id, {
          solution: n.solution,
          type: n.type as ClueType | undefined,
        })
      }
    }

    for (const [id, parsedNode] of Object.entries(parsedTree.nodes)) {
      let solution = nodeSolutionMap.get(id)?.solution
      let clueType: ClueType = nodeSolutionMap.get(id)?.type ?? 'definition'
      let cleanClueText = parsedNode.clueText

      // Soporte alternativo inline: si el usuario escribió [pista|solución]
      if (!solution && cleanClueText.includes('|')) {
        const parts = cleanClueText.split('|')
        cleanClueText = parts[0]?.trim() ?? ''
        solution = parts.slice(1).join('|').trim()
      }

      if (!solution || solution.trim().length === 0) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Validation Error',
          message: `Falta especificar la solución para el corchete "${id}" (${cleanClueText || 'sin pista'}).`,
        })
      }

      rawNodes[id] = {
        id,
        clueText: cleanClueText,
        children: parsedNode.children,
        parent: parsedNode.parent,
        type: clueType,
        solution: solution.trim(),
      }
    }

    const shortId = generateShortId()
    const today = getTodayDateMadrid()
    const salt = `salt-community-${shortId}`

    const rawPuzzle: RawPuzzle = {
      puzzleId: shortId,
      editionNumber: 0, // 0 indica edición de comunidad
      publishDate: today,
      rootTemplate: parsedTree.rootTemplate,
      nodes: rawNodes,
      quoteAuthor: data.quoteAuthor ?? 'Cita de la comunidad',
      quoteWork: data.quoteWork ?? 'Reto creado por un lector',
      quoteYear: data.quoteYear ?? new Date().getFullYear(),
      editorialNote: data.editorialNote ?? 'Reto compartido por la comunidad de Corchetes.',
    }

    // 3. Compilación criptográfica segura (SHA-256 + AES-GCM)
    const clientPayload = await compilePuzzlePayload(rawPuzzle, salt, normalize)

    const creatorAlias = data.creatorAlias?.trim() || 'Lector anónimo'
    const now = new Date()

    // 4. Persistir en PostgreSQL o en memoria como fallback
    const record: MemoryCommunityPuzzle = {
      id: shortId,
      creatorAlias,
      rawMarkup: data.markup,
      clientPayload,
      playsCount: 0,
      createdAt: now,
      isFlagged: false,
    }

    memoryCommunityPuzzles.set(shortId, record)

    if (fastify.db) {
      try {
        await fastify.db.insert(communityPuzzles).values({
          id: shortId,
          creatorAlias,
          rawMarkup: data.markup,
          clientPayload: clientPayload as any,
          playsCount: 0,
          isFlagged: false,
        })
      } catch (dbErr) {
        fastify.log.warn({ err: dbErr }, 'No se pudo guardar community_puzzle en PostgreSQL, usando fallback en memoria')
      }
    }

    return reply.status(201).send({
      shortId,
      url: `/r/${shortId}`,
      creatorAlias,
    })
  })

  // ── 2. GET /api/community/:shortId ─────────────────────────────────────────
  fastify.get('/api/community/:shortId', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseParams = getCommunityParamSchema.safeParse(request.params)
    if (!parseParams.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Identificador de reto inválido',
      })
    }

    const { shortId } = parseParams.data

    let puzzleRecord: MemoryCommunityPuzzle | undefined

    if (fastify.db) {
      try {
        const rows = await fastify.db
          .select()
          .from(communityPuzzles)
          .where(eq(communityPuzzles.id, shortId))
          .limit(1)

        if (rows[0] && !rows[0].isFlagged) {
          puzzleRecord = {
            id: rows[0].id,
            creatorAlias: rows[0].creatorAlias || 'Lector anónimo',
            rawMarkup: rows[0].rawMarkup,
            clientPayload: rows[0].clientPayload,
            playsCount: rows[0].playsCount ?? 0,
            createdAt: rows[0].createdAt || new Date(),
            isFlagged: Boolean(rows[0].isFlagged),
          }

          // Incrementar contador de partidas en background
          fastify.db
            .update(communityPuzzles)
            .set({ playsCount: sql`${communityPuzzles.playsCount} + 1` })
            .where(eq(communityPuzzles.id, shortId))
            .catch(() => {})
        }
      } catch (err) {
        fastify.log.warn({ err }, 'Error al consultar community_puzzle en PostgreSQL')
      }
    }

    if (!puzzleRecord) {
      puzzleRecord = memoryCommunityPuzzles.get(shortId)
      if (puzzleRecord) {
        puzzleRecord.playsCount += 1
      }
    }

    if (!puzzleRecord || puzzleRecord.isFlagged) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'El reto de la comunidad no existe o ha sido retirado.',
      })
    }

    return reply.send({
      id: puzzleRecord.id,
      creatorAlias: puzzleRecord.creatorAlias,
      clientPayload: puzzleRecord.clientPayload,
      playsCount: puzzleRecord.playsCount,
      createdAt: puzzleRecord.createdAt,
    })
  })
}
